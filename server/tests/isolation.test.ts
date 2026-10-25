import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { sweepExpiredAttempts } from '../services/attempts';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  assessmentBody,
  createProfessor,
  essayQuestion,
  mcQuestion,
  startTestServer,
  studentSignup,
  TestClient,
} from './helpers';

describe('exam flow and data isolation', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let admin: TestClient;
  let profA: TestClient;
  let profB: TestClient;
  let alice: TestClient;
  let bob: TestClient;
  let aliceId: string;
  let assessmentId: string;
  let mcId: string;
  let essayId: string;
  let invitationId: string;

  before(async () => {
    server = await startTestServer();
    admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    profA = server.client();
    profB = server.client();
    await createProfessor(admin, profA, 'prof.a@uni.edu');
    await createProfessor(admin, profB, 'prof.b@uni.edu');
    alice = server.client();
    bob = server.client();
    aliceId = (await alice.post('/api/auth/register', studentSignup({ name: 'Alice', email: 'alice@uni.edu' }))).data.user.id;
    await bob.post('/api/auth/register', studentSignup({ name: 'Bob', email: 'bob@uni.edu', secondaryEmail: 'bob@gmail.com' }));

    mcId = (await profA.post('/api/professor/questions', { question: mcQuestion })).data.question.id;
    essayId = (await profA.post('/api/professor/questions', { question: essayQuestion })).data.question.id;
    const created = await profA.post('/api/professor/assessments', { assessment: assessmentBody([mcId, essayId]) });
    assert.equal(created.status, 201);
    assessmentId = created.data.assessment.id;
    const invited = await profA.post('/api/professor/invitations', { assessmentId, emails: ['alice@uni.edu', 'ALICE@uni.edu'] });
    assert.equal(invited.data.created.length, 1);
    invitationId = invited.data.created[0].id;
  });
  after(() => server.close());

  it('assigns the owner from the session, never from the request', async () => {
    const res = await profA.post('/api/professor/questions', { question: { ...mcQuestion, professorId: 'someone-else' } });
    assert.ok(res.data.question.professorId !== 'someone-else');
  });

  it('keeps professors out of each other\'s assessments, questions and applicants', async () => {
    const workspaceB = (await profB.get('/api/professor/workspace')).data;
    assert.equal(workspaceB.assessments.length, 0);
    assert.ok(!workspaceB.questions.some((q: any) => q.id === mcId), 'private question leaked');
    assert.equal((await profB.put(`/api/professor/assessments/${assessmentId}`, { assessment: assessmentBody([]) })).status, 404);
    assert.equal((await profB.put(`/api/professor/questions/${mcId}`, { question: mcQuestion })).status, 404);
    assert.equal((await profB.post('/api/professor/invitations', { assessmentId, emails: ['x@uni.edu'] })).status, 404);
    // Can't build an assessment out of someone else's private questions
    assert.equal((await profB.post('/api/professor/assessments', { assessment: assessmentBody([mcId]) })).status, 400);
  });

  it('hides invitations from unverified students until an admin verifies them', async () => {
    assert.equal((await alice.get('/api/student/portal')).data.invitations.length, 0);
    assert.equal((await alice.post(`/api/student/invitations/${invitationId}/attempt`, {})).status, 403);
    await admin.patch(`/api/admin/accounts/${aliceId}`, { isVerified: true });
    assert.equal((await alice.get('/api/student/portal')).data.invitations.length, 1);
  });

  it('shows a student only their own invitations', async () => {
    await admin.patch(`/api/admin/accounts/${server.db.findUserByEmail('bob@uni.edu')!.id}`, { isVerified: true });
    const bobPortal = (await bob.get('/api/student/portal')).data;
    assert.equal(bobPortal.invitations.length, 0);
    assert.equal((await bob.post(`/api/student/invitations/${invitationId}/attempt`, {})).status, 404);
  });

  let attemptId: string;
  it('never sends the answer key, rubric or model answer to the student', async () => {
    const res = await alice.post(`/api/student/invitations/${invitationId}/attempt`, {
      details: { secondaryEmail: 'alice@gmail.com', university: 'State', degreeProgram: 'CS', gpa: '3.9' },
    });
    assert.equal(res.status, 201);
    attemptId = res.data.attempt.id;
    const raw = JSON.stringify(res.data);
    for (const secret of ['correctAnswers', 'rubric', 'sampleAnswer', 'Seven is the only prime option', 'memorizes training noise']) {
      assert.ok(!raw.includes(secret), `leaked ${secret}`);
    }
    // Resuming returns the same attempt with the server's start time
    const again = await alice.post(`/api/student/invitations/${invitationId}/attempt`, {});
    assert.equal(again.data.attempt.id, attemptId);
    assert.equal(again.data.attempt.startedAt, res.data.attempt.startedAt);
  });

  it('does not let another student touch the attempt', async () => {
    assert.equal((await bob.put(`/api/student/attempts/${attemptId}`, { responses: {} })).status, 404);
    assert.equal((await bob.post(`/api/student/attempts/${attemptId}/submit`, {})).status, 404);
  });

  it('grades on the server and ignores forged scores', async () => {
    await alice.put(`/api/student/attempts/${attemptId}`, {
      responses: { [mcId]: 'not-an-option', [essayId]: 'x' },
      tabSwitches: 2,
    });
    // Integrity counters can't be lowered
    await alice.put(`/api/student/attempts/${attemptId}`, { tabSwitches: 0 });
    const submitted = await alice.post(`/api/student/attempts/${attemptId}/submit`, {
      responses: { [essayId]: '' },
      overallScore: 100,
      hireabilityLevel: 'Tier 1: Direct Admit / Top Fellow',
    });
    assert.equal(submitted.status, 200);
    const view = submitted.data.submission;
    // Scores are hidden (isScoreVisible: false) and internal fields are never sent
    assert.equal(view.overallScore, undefined);
    for (const field of ['hireabilityLevel', 'integrityReport', 'professorNotes', 'interviewRecommendation', 'responses']) {
      assert.equal(view[field], undefined, `${field} leaked to the student`);
    }
    const stored = server.db.data.submissions.find((s) => s.id === view.id)!;
    assert.equal(stored.overallScore, 0, 'forged score was accepted');
    assert.equal(stored.responses[mcId].answer, '', 'invalid MC option was stored');
    assert.equal(stored.integrityReport.tabSwitchCount, 2);
    assert.equal(stored.studentId, aliceId);
    // A test can only be submitted once
    assert.equal((await alice.post(`/api/student/attempts/${attemptId}/submit`, {})).status, 404);
    assert.equal((await alice.post(`/api/student/invitations/${invitationId}/attempt`, {})).status, 409);
  });

  it('keeps professor notes private and validates meeting links', async () => {
    const submissionId = server.db.data.submissions[0].id;
    const evil = await profA.put(`/api/professor/submissions/${submissionId}/review`, { meetingLink: 'javascript:alert(document.cookie)' });
    assert.equal(evil.status, 400);
    const ok = await profA.put(`/api/professor/submissions/${submissionId}/review`, {
      professorDecision: 'Interview',
      professorNotes: 'PRIVATE: weak on proofs',
      interviewDate: '2030-01-10',
      interviewTime: '10:00 AM EST',
      meetingLink: 'https://meet.example.com/abc',
    });
    assert.equal(ok.status, 200);
    const portal = (await alice.get('/api/student/portal')).data;
    assert.ok(!JSON.stringify(portal).includes('PRIVATE'), 'professor notes leaked');
    assert.equal(portal.submissions[0].decision, 'Interview');
    assert.equal(portal.submissions[0].interview.meetingLink, 'https://meet.example.com/abc');
    // Another professor can't review it; another student can't RSVP to it
    assert.equal((await profB.put(`/api/professor/submissions/${submissionId}/review`, { professorDecision: 'Reject' })).status, 404);
    assert.equal((await bob.post(`/api/student/submissions/${submissionId}/rsvp`, { response: 'Accepted' })).status, 404);
    assert.equal((await alice.post(`/api/student/submissions/${submissionId}/rsvp`, { response: 'Accepted' })).status, 200);
  });

  it('applies professor score overrides on the server', async () => {
    const submissionId = server.db.data.submissions[0].id;
    const res = await profA.put(`/api/professor/submissions/${submissionId}/review`, { scoreOverrides: { [mcId]: 10, [essayId]: 10 } });
    assert.equal(res.data.submission.overallScore, 100);
    assert.equal((await profA.put(`/api/professor/submissions/${submissionId}/review`, { scoreOverrides: { [mcId]: 999 } })).status, 400);
  });

  it('auto-submits a test whose time ran out while the student was away', async () => {
    const profInvite = await profA.post('/api/professor/invitations', { assessmentId, emails: ['bob@uni.edu'] });
    const bobId = server.db.findUserByEmail('bob@uni.edu')!.id;
    const start = await bob.post(`/api/student/invitations/${profInvite.data.created[0].id}/attempt`, {
      details: { secondaryEmail: 'bob@gmail.com', university: 'State', degreeProgram: 'CS' },
    });
    await bob.put(`/api/student/attempts/${start.data.attempt.id}`, { responses: { [mcId]: '7' } });
    // Pretend the attempt started two hours ago
    server.db.data.attempts.find((a) => a.id === start.data.attempt.id)!.startedAt = new Date(Date.now() - 2 * 3600_000).toISOString();
    // Late answers are ignored...
    const late = await bob.put(`/api/student/attempts/${start.data.attempt.id}`, { responses: { [mcId]: '4' } });
    assert.equal(late.status, 409);
    const submission = server.db.data.submissions.find((s) => s.studentId === bobId)!;
    // ...and the last answer saved in time is graded
    assert.equal(submission.responses[mcId].answer, '7');
    assert.equal(submission.responses[mcId].aiScore, 10);
    assert.ok(submission.integrityReport.notes.some((n) => n.includes('automatically')));
    await sweepExpiredAttempts(server.db);
    assert.equal(server.db.data.submissions.filter((s) => s.studentId === bobId).length, 1);
  });

  it('gives the admin read access to every account\'s records', async () => {
    const detail = (await admin.get(`/api/admin/accounts/${aliceId}`)).data;
    assert.equal(detail.account.email, 'alice@uni.edu');
    assert.equal(detail.submissions.length, 1);
    assert.equal(detail.invitations.length, 1);
  });
});
