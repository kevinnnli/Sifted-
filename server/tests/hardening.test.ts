import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { securityHeaderList } from '../securityHeaders.mjs';
import { ensureTestAccounts } from '../testAccounts';
import { ADMIN_EMAIL, ADMIN_PASSWORD, assessmentBody, createProfessor, mcQuestion, startTestServer, studentSignup, TestClient } from './helpers';

const DAY = 24 * 60 * 60 * 1000;

describe('session lifetime', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => (server = await startTestServer()));
  after(() => server.close());

  const sessionFor = (userId: string) => server.db.data.sessions.find((s) => s.userId === userId)!;

  test('activity renews a session, up to the absolute limit, and expired sessions are refused', async () => {
    const student = server.client();
    const signup = await student.post('/api/auth/register', studentSignup({ email: 'renew@uni.edu' }));
    const session = sessionFor(signup.data.user.id);

    // Signed in 2 days ago and about to expire: a request pushes expiry ~7 days out
    session.createdAt = new Date(Date.now() - 2 * DAY).toISOString();
    session.expiresAt = new Date(Date.now() + 60_000).toISOString();
    const me = await student.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.ok(Date.parse(session.expiresAt) > Date.now() + 6.9 * DAY, 'renewed');
    assert.match(me.headers.getSetCookie().join(';'), /sifted_session=.*Max-Age=\d+/);

    // Signed in 29.5 days ago: renewal stops at 30 days after sign-in
    session.createdAt = new Date(Date.now() - 29.5 * DAY).toISOString();
    session.expiresAt = new Date(Date.now() + 60_000).toISOString();
    await student.get('/api/auth/me');
    assert.ok(Date.parse(session.expiresAt) <= Date.parse(session.createdAt) + 30 * DAY + 1000, 'capped at 30 days');

    // Expired: no longer signed in
    session.expiresAt = new Date(Date.now() - 1000).toISOString();
    assert.equal((await student.get('/api/auth/me')).data.user, null);
    assert.equal((await student.get('/api/student/portal')).status, 401);
  });

  test('a session is not renewed on every request', async () => {
    const student = server.client();
    const signup = await student.post('/api/auth/register', studentSignup({ email: 'quiet@uni.edu' }));
    const before = sessionFor(signup.data.user.id).expiresAt;
    const res = await student.get('/api/auth/me');
    assert.equal(sessionFor(signup.data.user.id).expiresAt, before);
    assert.equal(res.headers.getSetCookie().length, 0);
  });

  test('registering replaces any earlier session cookie', async () => {
    const client = server.client();
    await client.post('/api/auth/register', studentSignup({ email: 'first@uni.edu' }));
    const firstToken = client.cookies.get('sifted_session')!;
    await client.post('/api/auth/register', studentSignup({ email: 'second@uni.edu' }));
    const replay = server.client();
    replay.cookie = `sifted_session=${firstToken}`;
    assert.equal((await replay.get('/api/auth/me')).data.user, null, 'the earlier session was ended');
  });
});

describe('passwords and abuse limits', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => (server = await startTestServer()));
  after(() => server.close());

  test('common passwords and passwords containing the email name are refused', async () => {
    const client = server.client();
    for (const password of ['password123', 'qwerty123', 'mallory-2026']) {
      const res = await client.post('/api/auth/register', studentSignup({ email: 'mallory@uni.edu', password }));
      assert.equal(res.status, 400, password);
    }
  });

  test('guessing the current password is limited', async () => {
    const student = server.client();
    await student.post('/api/auth/register', studentSignup({ email: 'guess@uni.edu' }));
    for (let i = 0; i < 5; i++) {
      const res = await student.post('/api/auth/change-password', { currentPassword: `wrong-${i}-pass`, newPassword: 'a-new-secret-9' });
      assert.equal(res.status, 400);
    }
    const blocked = await student.post('/api/auth/change-password', { currentPassword: 'student-pass-123', newPassword: 'a-new-secret-9' });
    assert.equal(blocked.status, 429);
  });
});

describe('deleting a student account', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let admin: TestClient;
  let prof: TestClient;
  let assessmentId: string;
  before(async () => {
    server = await startTestServer({ STUDENT_VERIFICATION: 'auto' });
    admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    prof = server.client();
    await createProfessor(admin, prof, 'del.prof@uni.edu');
    const q = await prof.post('/api/professor/questions', { question: mcQuestion });
    const a = await prof.post('/api/professor/assessments', { assessment: assessmentBody([q.data.question.id]) });
    assessmentId = a.data.assessment.id;
  });
  after(() => server.close());

  async function studentWithSubmission(email: string) {
    const student = server.client();
    const signup = await student.post('/api/auth/register', studentSignup({ email }));
    await prof.post('/api/professor/invitations', { assessmentId, emails: [email] });
    const invitation = (await student.get('/api/student/portal')).data.invitations[0];
    const started = await student.post(`/api/student/invitations/${invitation.id}/attempt`, {
      lockdown: false,
      details: { secondaryEmail: 'me@personal.test', university: 'State', degreeProgram: 'BS' },
    });
    await student.post(`/api/student/attempts/${started.data.attempt.id}/submit`, {});
    // Still signed in after submitting
    assert.equal((await student.get('/api/student/portal')).status, 200);
    return { student, id: signup.data.user.id as string };
  }

  const traces = (email: string) => ({
    users: server.db.data.users.filter((u) => u.email === email).length,
    submissions: server.db.data.submissions.filter((s) => s.applicantEmail === email).length,
    invitations: server.db.data.invitations.filter((i) => i.applicantEmail === email).length,
  });

  test('a student can delete their own account, which removes all of their data', async () => {
    const { student } = await studentWithSubmission('leaving@uni.edu');
    assert.deepEqual(traces('leaving@uni.edu'), { users: 1, submissions: 1, invitations: 1 });
    assert.equal((await student.request('DELETE', '/api/student/account', { password: 'wrong-password-1' })).status, 400);
    const res = await student.request('DELETE', '/api/student/account', { password: 'student-pass-123' });
    assert.equal(res.status, 200);
    assert.deepEqual(traces('leaving@uni.edu'), { users: 0, submissions: 0, invitations: 0 });
    assert.equal((await student.get('/api/auth/me')).data.user, null, 'signed out');
    assert.equal((await prof.get('/api/professor/workspace')).data.submissions.some((s: any) => s.applicantEmail === 'leaving@uni.edu'), false);
  });

  test("an administrator's deletion of a student removes the same data", async () => {
    const { id } = await studentWithSubmission('erased@uni.edu');
    const res = await admin.del(`/api/admin/accounts/${id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.removed, { submissions: 1, invitations: 1, attempts: 0 });
    assert.deepEqual(traces('erased@uni.edu'), { users: 0, submissions: 0, invitations: 0 });
  });
});

describe('test accounts stay separate from real ones', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => {
    server = await startTestServer();
    await ensureTestAccounts(server.db);
  });
  after(() => server.close());

  test('sandbox and real accounts cannot invite each other, and the sandbox domain is reserved', async () => {
    const admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const overview = (await admin.get('/api/admin/overview')).data;
    const testProf = overview.testAccounts.find((a: any) => a.role === 'professor');

    const real = server.client();
    await createProfessor(admin, real, 'real.one@uni.edu');
    const q = await real.post('/api/professor/questions', { question: mcQuestion });
    const a = await real.post('/api/professor/assessments', { assessment: assessmentBody([q.data.question.id]) });
    const invite = await real.post('/api/professor/invitations', { assessmentId: a.data.assessment.id, emails: ['ready.student@sandbox.sifted.test'] });
    assert.equal(invite.data.created.length, 0);

    const sandbox = server.client();
    await sandbox.login(testProf.email, testProf.testPassword);
    const ws = (await sandbox.get('/api/professor/workspace')).data;
    const sandboxInvite = await sandbox.post('/api/professor/invitations', { assessmentId: ws.assessments[0].id, emails: ['someone.real@uni.edu'] });
    assert.equal(sandboxInvite.data.created.length, 0);
    const shared = await sandbox.post('/api/professor/questions', { question: { ...mcQuestion, isPublic: true } });
    assert.equal(shared.data.question.isPublic, false, 'sandbox questions stay out of the shared bank');
    const realBank = (await real.get('/api/professor/workspace')).data.questions;
    assert.equal(realBank.some((x: any) => x.id === shared.data.question.id), false);

    const register = await server.client().post('/api/auth/register', studentSignup({ email: 'intruder@sandbox.sifted.test' }));
    assert.equal(register.status, 400);
  });
});

describe('security headers', () => {
  test('production responses carry a strict content security policy', () => {
    const headers = securityHeaderList({ production: true, allowEmbedding: false });
    const csp = headers['Content-Security-Policy'];
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.ok(headers['Strict-Transport-Security']);
    assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  });

  test('the server sends them in production mode', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const server = await startTestServer();
    process.env.NODE_ENV = previous;
    const res = await fetch(`${server.base}/api/health`);
    assert.match(res.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    await server.close();
  });
});
