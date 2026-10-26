import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { finalizeAttempt, isBeingSubmitted } from '../services/attempts';
import { ADMIN_EMAIL, ADMIN_PASSWORD, assessmentBody, createProfessor, mcQuestion, startTestServer, studentSignup, TestClient } from './helpers';

describe('malformed cookies', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => (server = await startTestServer()));
  after(() => server.close());

  test('a broken session cookie does not stop anyone from using the site or signing in', async () => {
    const client = server.client();
    client.cookie = 'sifted_session=%E0%A4%A';
    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.user, null);
    await client.post('/api/auth/register', studentSignup({ email: 'broken.cookie@uni.edu' }));
    assert.equal((await client.get('/api/auth/me')).data.user.email, 'broken.cookie@uni.edu');
  });
});

describe('__Host- session cookies over HTTPS', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let previous: string | undefined;
  before(async () => {
    previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    server = await startTestServer();
  });
  after(async () => {
    process.env.NODE_ENV = previous;
    await server.close();
  });

  test('sessions are issued in a __Host- cookie that is Secure, HttpOnly, host-only and site-wide', async () => {
    const client = server.client();
    const res = await client.post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('__Host-sifted_session='))!;
    assert.ok(cookie, 'prefixed cookie set');
    assert.match(cookie, /; Path=\/;/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.doesNotMatch(cookie, /Domain=/i);
    assert.equal((await client.get('/api/auth/me')).data.user.role, 'admin');
  });

  test('a token planted in the unprefixed cookie (e.g. by a sibling subdomain) is refused', async () => {
    const owner = server.client();
    await owner.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const token = owner.cookies.get('__Host-sifted_session')!;
    const victim = server.client();
    victim.cookie = `sifted_session=${token}`;
    assert.equal((await victim.get('/api/auth/me')).data.user, null);
  });

  test('a session from before the prefix keeps working and moves to the prefixed cookie', async () => {
    const client = server.client();
    await client.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const token = client.cookies.get('__Host-sifted_session')!;
    // As stored by the previous version: no hostOnly flag, cookie without prefix
    for (const s of server.db.data.sessions) delete s.hostOnly;
    const legacy = server.client();
    legacy.cookie = `sifted_session=${token}`;
    const res = await legacy.get('/api/auth/me');
    assert.equal(res.data.user.role, 'admin', 'still signed in');
    const setCookies = res.headers.getSetCookie();
    assert.ok(setCookies.some((c) => c.startsWith('__Host-sifted_session=') && !/Max-Age=0/.test(c)), 'moved to the prefixed cookie');
    assert.ok(setCookies.some((c) => c.startsWith('sifted_session=;') && /Max-Age=0/.test(c)), 'old cookie cleared');
    assert.equal(legacy.cookies.has('sifted_session'), false);
    assert.equal((await legacy.get('/api/auth/me')).data.user.role, 'admin');
  });

  test('signing out clears both the prefixed and the old cookie', async () => {
    const client = server.client();
    await client.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const res = await client.post('/api/auth/logout');
    const cleared = res.headers.getSetCookie().filter((c) => /Max-Age=0/.test(c)).map((c) => c.split('=')[0]);
    assert.ok(cleared.includes('__Host-sifted_session'));
    assert.ok(cleared.includes('sifted_session'));
    assert.equal((await client.get('/api/auth/me')).data.user, null);
  });
});

describe('professors and student details', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let professor: TestClient;
  let student: TestClient;
  let assessmentId: string;
  before(async () => {
    server = await startTestServer();
    const admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    professor = server.client();
    await createProfessor(admin, professor, 'ada.lovelace@uni.edu');
    student = server.client();
    const signup = await student.post('/api/auth/register', studentSignup({ name: 'Morgan Private', email: 'morgan@uni.edu', university: 'Private University' }));
    await admin.patch(`/api/admin/accounts/${signup.data.user.id}`, { isVerified: true });
    const question = (await professor.post('/api/professor/questions', { question: mcQuestion })).data.question;
    assessmentId = (await professor.post('/api/professor/assessments', { assessment: assessmentBody([question.id]) })).data.assessment.id;
  });
  after(() => server.close());

  test("inviting an email does not reveal the student's name or university until they take the test", async () => {
    const invited = await professor.post('/api/professor/invitations', { assessmentId, emails: ['morgan@uni.edu'] });
    assert.equal(invited.data.created[0].applicantName, 'morgan');
    let candidate = (await professor.get('/api/professor/workspace')).data.candidates.find((c: any) => c.email === 'morgan@uni.edu');
    assert.equal(candidate.name, 'morgan');
    assert.equal(candidate.university, undefined);
    assert.equal(candidate.degreeProgram, undefined);
    assert.equal(candidate.registered, true);

    const invitationId = invited.data.created[0].id;
    const started = await student.post(`/api/student/invitations/${invitationId}/attempt`, {
      lockdown: false,
      details: { university: 'Private University', degreeProgram: 'B.S.' },
    });
    assert.equal(started.status, 201);
    candidate = (await professor.get('/api/professor/workspace')).data.candidates.find((c: any) => c.email === 'morgan@uni.edu');
    assert.equal(candidate.name, 'Morgan Private');
    assert.equal(candidate.university, 'Private University');
  });

  test('score overrides only accept questions of the submission', async () => {
    const submit = await student.get('/api/student/portal');
    const attemptInvitation = submit.data.invitations[0];
    const attempt = (await student.post(`/api/student/invitations/${attemptInvitation.id}/attempt`, { lockdown: false })).data.attempt;
    await student.post(`/api/student/attempts/${attempt.id}/submit`, {});
    const submissionId = (await professor.get('/api/professor/workspace')).data.submissions[0].id;
    for (const key of ['__proto__', 'constructor', 'toString']) {
      const res = await professor.put(`/api/professor/submissions/${submissionId}/review`, { scoreOverrides: JSON.parse(`{"${key}": 5}`) });
      assert.equal(res.status, 400, key);
    }
  });
});

describe('submitting', () => {
  test('a test is marked as being submitted while it is graded, so autosaves cannot change it', async () => {
    const server = await startTestServer();
    const admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const professor = server.client();
    await createProfessor(admin, professor, 'ada.lovelace@uni.edu');
    const student = server.client();
    const signup = await student.post('/api/auth/register', studentSignup());
    await admin.patch(`/api/admin/accounts/${signup.data.user.id}`, { isVerified: true });
    const question = (await professor.post('/api/professor/questions', { question: mcQuestion })).data.question;
    const assessmentId = (await professor.post('/api/professor/assessments', { assessment: assessmentBody([question.id]) })).data.assessment.id;
    const invitationId = (await professor.post('/api/professor/invitations', { assessmentId, emails: [signup.data.user.email] })).data.created[0].id;
    const attempt = (
      await student.post(`/api/student/invitations/${invitationId}/attempt`, { lockdown: false, details: { university: 'State University', degreeProgram: 'B.S.' } })
    ).data.attempt;

    const grading = finalizeAttempt(server.db, attempt.id, { autoSubmitted: false });
    assert.equal(isBeingSubmitted(server.db, attempt.id), true);
    await grading;
    assert.equal(isBeingSubmitted(server.db, attempt.id), false);
    const save = await student.put(`/api/student/attempts/${attempt.id}`, { responses: { [question.id]: '4' } });
    assert.equal(save.status, 404, 'no longer in progress');
    await server.close();
  });
});
