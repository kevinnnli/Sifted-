import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { ensureTestAccounts } from '../testAccounts';
import { ADMIN_EMAIL, ADMIN_PASSWORD, createProfessor, startTestServer, studentSignup, TestClient } from './helpers';

describe('test accounts', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let admin: TestClient;
  let accounts: Record<string, { id: string; email: string; testPassword: string; role: string }>;

  before(async () => {
    server = await startTestServer();
    assert.equal(await ensureTestAccounts(server.db), true);
    assert.equal(await ensureTestAccounts(server.db), false, 'created only once');
    admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const overview = await admin.get('/api/admin/overview');
    accounts = Object.fromEntries(overview.data.testAccounts.map((a: any) => [a.email.split('@')[0], a]));
  });
  after(() => server.close());

  test('the admin overview lists the sandbox accounts with their passwords', async () => {
    assert.deepEqual(Object.keys(accounts).sort(), ['interview.student', 'new.student', 'professor', 'ready.student', 'submitted.student']);
    for (const account of Object.values(accounts)) assert.match(account.testPassword, /^Test-/);
    const overview = await admin.get('/api/admin/overview');
    assert.equal(overview.data.testAccountsEnabled, true);
    // The general account list never carries passwords
    assert.ok(overview.data.accounts.every((a: any) => a.testPassword === undefined));
  });

  test('each sandbox account signs in and is in the stage it describes', async () => {
    const prof = server.client();
    await prof.login(accounts.professor.email, accounts.professor.testPassword);
    const ws = await prof.get('/api/professor/workspace');
    assert.equal(ws.status, 200);
    assert.equal(ws.data.assessments.length, 1);
    assert.equal(ws.data.submissions.length, 2);
    assert.ok(ws.data.submissions.some((s: any) => s.professorDecision === 'Interview'));

    const ready = server.client();
    await ready.login(accounts['ready.student'].email, accounts['ready.student'].testPassword);
    const readyPortal = await ready.get('/api/student/portal');
    assert.equal(readyPortal.data.invitations.length, 1);
    assert.equal(readyPortal.data.invitations[0].blocker, null);

    const interview = server.client();
    await interview.login(accounts['interview.student'].email, accounts['interview.student'].testPassword);
    const interviewPortal = await interview.get('/api/student/portal');
    assert.equal(interviewPortal.data.submissions[0].decision, 'Interview');

    const fresh = server.client();
    await fresh.login(accounts['new.student'].email, accounts['new.student'].testPassword);
    const me = await fresh.get('/api/auth/me');
    assert.equal(me.data.user.isVerified, false);
    assert.equal(me.data.user.testPassword, undefined, 'a test account never sees its stored password');
    assert.equal(me.data.testSession, false);
  });

  test('the admin can open a test account and switch back', async () => {
    const browser = server.client();
    await browser.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const opened = await browser.post(`/api/admin/accounts/${accounts.professor.id}/sign-in-as`);
    assert.equal(opened.status, 200);
    let me = await browser.get('/api/auth/me');
    assert.equal(me.data.user.email, accounts.professor.email);
    assert.equal(me.data.testSession, true);
    assert.equal((await browser.get('/api/admin/overview')).status, 403, 'inside the test account there is no admin access');

    const back = await browser.post('/api/auth/return-to-admin');
    assert.equal(back.status, 200);
    me = await browser.get('/api/auth/me');
    assert.equal(me.data.user.role, 'admin');
    assert.equal((await browser.get('/api/admin/overview')).status, 200);
  });

  test('only test accounts can be opened, and only by the admin', async () => {
    const realProf = server.client();
    const real = await createProfessor(admin, realProf, 'real.prof@uni.edu');
    const refused = await admin.post(`/api/admin/accounts/${real.id}/sign-in-as`);
    assert.equal(refused.status, 403);

    const student = server.client();
    await student.post('/api/auth/register', studentSignup({ email: 'opener@uni.edu' }));
    assert.equal((await student.post(`/api/admin/accounts/${accounts.professor.id}/sign-in-as`)).status, 403);
  });

  test('"return to admin" never grants admin access without a parked admin session', async () => {
    const ready = server.client();
    await ready.login(accounts['ready.student'].email, accounts['ready.student'].testPassword);
    assert.equal((await ready.post('/api/auth/return-to-admin')).status, 401);
    // Planting the student's own token in the return cookie doesn't work either
    ready.cookies.set('sifted_admin_return', ready.cookies.get('sifted_session')!);
    assert.equal((await ready.post('/api/auth/return-to-admin')).status, 401);
    const me = await ready.get('/api/auth/me');
    assert.notEqual(me.data.user?.role, 'admin');
  });

  test('signing out of a test account also ends the parked admin session', async () => {
    const browser = server.client();
    await browser.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await browser.post(`/api/admin/accounts/${accounts['ready.student'].id}/sign-in-as`);
    const parked = browser.cookies.get('sifted_admin_return')!;
    await browser.post('/api/auth/logout');
    const replay = server.client();
    replay.cookie = `sifted_session=${parked}`;
    assert.equal((await replay.get('/api/admin/overview')).status, 401);
  });

  test('reset rebuilds the sandbox and remove turns it off', async () => {
    const before = accounts.professor.testPassword;
    assert.equal((await admin.post('/api/admin/test-accounts/reset')).status, 200);
    let overview = await admin.get('/api/admin/overview');
    assert.equal(overview.data.testAccounts.length, 5);
    assert.notEqual(overview.data.testAccounts.find((a: any) => a.role === 'professor').testPassword, before);

    assert.equal((await admin.del('/api/admin/test-accounts')).status, 200);
    overview = await admin.get('/api/admin/overview');
    assert.equal(overview.data.testAccounts.length, 0);
    assert.equal(overview.data.testAccountsEnabled, false);
    assert.equal(server.db.data.users.some((u) => u.email.endsWith('sandbox.sifted.test')), false);
    assert.equal(server.db.data.invitations.some((i) => i.applicantEmail.endsWith('sandbox.sifted.test')), false);
    assert.equal(await ensureTestAccounts(server.db), false, 'stays off after a restart');
  });
});
