import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { ensureEnvAdmin } from '../bootstrap';
import { Database } from '../db';
import { ADMIN_EMAIL, ADMIN_PASSWORD, createProfessor, startTestServer, studentSignup, TestClient } from './helpers';

describe('authentication and access control', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  before(async () => {
    server = await startTestServer();
  });
  after(() => server.close());

  it('exposes no data without signing in', async () => {
    const anon = server.client();
    assert.equal((await anon.get('/api/auth/me')).data.user, null);
    assert.equal((await anon.get('/api/professor/workspace')).status, 401);
    assert.equal((await anon.get('/api/student/portal')).status, 401);
    assert.equal((await anon.get('/api/admin/overview')).status, 401);
    // The old unauthenticated "dump everything" endpoint is gone
    assert.equal((await anon.get('/api/data')).status, 404);
  });

  it('blocks cross-site requests', async () => {
    const anon = server.client();
    const noHeader = await anon.request('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { 'X-Sifted-Request': '' });
    assert.equal(noHeader.status, 403);
    const foreignOrigin = await anon.request('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, { Origin: 'https://evil.example' });
    assert.equal(foreignOrigin.status, 403);
  });

  it('signs the configured admin in with an HttpOnly session cookie and rejects wrong passwords', async () => {
    const admin = server.client();
    const bad = await admin.post('/api/auth/login', { email: ADMIN_EMAIL, password: 'wrong-password' });
    assert.equal(bad.status, 401);
    assert.equal(bad.data.error, 'Incorrect email or password');
    const unknown = await admin.post('/api/auth/login', { email: 'nobody@uni.edu', password: 'whatever-123' });
    assert.equal(unknown.data.error, 'Incorrect email or password');

    const res = await admin.post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.role, 'admin');
    assert.equal(res.data.user.passwordHash, undefined);
    const cookie = res.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.equal((await admin.get('/api/admin/overview')).status, 200);
    // Password hashes never appear in API output
    assert.ok(!JSON.stringify((await admin.get('/api/admin/overview')).data).includes('scrypt$'));
  });

  it('rate-limits repeated failed sign-ins', async () => {
    const attacker = server.client();
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await attacker.post('/api/auth/login', { email: 'victim@uni.edu', password: `guess-${i}-xx` })).status;
    assert.equal(last, 429);
  });

  it('only lets students self-register, never as staff', async () => {
    const student = server.client();
    const res = await student.post('/api/auth/register', { ...studentSignup({ email: 'reg@uni.edu' }), role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.data.user.role, 'applicant');
    assert.equal(res.data.user.isVerified, false);
    assert.equal((await student.get('/api/admin/overview')).status, 403);
    assert.equal((await student.get('/api/professor/workspace')).status, 403);
    // Same email can't be registered twice, and the admin email can't be claimed
    assert.equal((await server.client().post('/api/auth/register', studentSignup({ email: 'reg@uni.edu' }))).status, 409);
    assert.equal((await server.client().post('/api/auth/register', studentSignup({ email: ADMIN_EMAIL }))).status, 409);
    // Weak passwords are refused
    assert.equal((await server.client().post('/api/auth/register', studentSignup({ email: 'weak@uni.edu', password: 'short' }))).status, 400);
  });

  it('signs out by destroying the session server-side', async () => {
    const student = server.client();
    await student.post('/api/auth/register', studentSignup({ email: 'logout@uni.edu' }));
    const stolenCookie = student.cookie;
    await student.post('/api/auth/logout');
    const replay = new TestClient(server.base);
    replay.cookie = stolenCookie;
    assert.equal((await replay.get('/api/student/portal')).status, 401);
  });

  it('forces professors created by the admin to replace their temporary password', async () => {
    const admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.post('/api/admin/professors', {
      name: 'Dr. Temp',
      email: 'temp.prof@uni.edu',
      department: 'CS',
      labName: 'Lab',
      temporaryPassword: 'temporary-pass-1',
    });
    const prof = server.client();
    const user = await prof.login('temp.prof@uni.edu', 'temporary-pass-1');
    assert.equal(user.mustChangePassword, true);
    assert.equal((await prof.get('/api/professor/workspace')).status, 403);
    await prof.post('/api/auth/change-password', { currentPassword: 'temporary-pass-1', newPassword: 'my-own-password-1' });
    assert.equal((await prof.get('/api/professor/workspace')).status, 200);
  });

  it('lets the admin disable an account, which ends its sessions', async () => {
    const admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const student = server.client();
    const created = await student.post('/api/auth/register', studentSignup({ email: 'disable.me@uni.edu' }));
    await admin.patch(`/api/admin/accounts/${created.data.user.id}`, { disabled: true });
    assert.equal((await student.get('/api/student/portal')).status, 401);
    assert.equal((await student.post('/api/auth/login', { email: 'disable.me@uni.edu', password: 'student-pass-123' })).status, 403);
  });

  it('protects the configured admin account from changes through the UI', async () => {
    const admin = server.client();
    const me = await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert.equal((await admin.patch(`/api/admin/accounts/${me.id}`, { disabled: true })).status, 400);
    assert.equal((await admin.del(`/api/admin/accounts/${me.id}`)).status, 400);
    assert.equal((await admin.post('/api/auth/change-password', { currentPassword: ADMIN_PASSWORD, newPassword: 'another-password-1' })).status, 400);
  });

  it('a professor cannot create another professor or reach the admin API', async () => {
    const admin = server.client();
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const prof = server.client();
    await createProfessor(admin, prof, 'no.admin@uni.edu');
    assert.equal((await prof.get('/api/admin/overview')).status, 403);
    assert.equal((await prof.post('/api/admin/professors', { name: 'X', email: 'x@uni.edu', department: 'X', labName: 'X', temporaryPassword: 'temporary-pass-1' })).status, 403);
  });
});

describe('administrator bootstrap', () => {
  it('creates no admin when ADMIN_EMAIL / ADMIN_PASSWORD are missing or weak', async () => {
    const db = new Database(null);
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    assert.match((await ensureEnvAdmin(db))!, /No administrator is configured/);
    Object.assign(process.env, { ADMIN_EMAIL: 'boss@uni.edu', ADMIN_PASSWORD: 'short' });
    assert.match((await ensureEnvAdmin(db))!, /at least 12 characters/);
    assert.equal(db.data.users.filter((u) => u.role === 'admin').length, 0);
  });

  it('never promotes an existing non-admin account to admin', async () => {
    const db = new Database(null);
    db.data.users.push({ id: 'student-1', name: 'S', email: 'boss@uni.edu', role: 'applicant', createdAt: new Date().toISOString() });
    Object.assign(process.env, { ADMIN_EMAIL: 'boss@uni.edu', ADMIN_PASSWORD: 'long-enough-password' });
    assert.match((await ensureEnvAdmin(db))!, /already belongs to a applicant account/);
    assert.equal(db.findUser('student-1')!.role, 'applicant');
  });

  it('disables the previous admin when ADMIN_EMAIL changes', async () => {
    const db = new Database(null);
    Object.assign(process.env, { ADMIN_EMAIL: 'first@uni.edu', ADMIN_PASSWORD: 'long-enough-password' });
    await ensureEnvAdmin(db);
    Object.assign(process.env, { ADMIN_EMAIL: 'second@uni.edu' });
    await ensureEnvAdmin(db);
    assert.equal(db.findUserByEmail('first@uni.edu')!.disabled, true);
    assert.equal(db.findUserByEmail('second@uni.edu')!.role, 'admin');
  });
});

describe('database file', () => {
  it('migrates the old unauthenticated format with every account locked', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sifted-'));
    const file = path.join(dir, 'database.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        userAccounts: [
          { id: 'a1', name: 'Old Admin', email: 'Admin@University.edu', role: 'admin' },
          { id: 's1', name: 'Student', email: 'student@uni.edu', role: 'applicant' },
        ],
        questionBank: [{ id: 'q1' }],
        submissions: [],
      })
    );
    const db = new Database(file);
    assert.equal(db.data.version, 2);
    assert.equal(db.findUser('a1')!.disabled, true);
    assert.equal(db.findUser('a1')!.email, 'admin@university.edu');
    assert.equal(db.findUser('s1')!.passwordHash, undefined);
    assert.equal(db.data.questions.length, 1);
    // Written back atomically in the new format
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf-8')).version, 2);
    assert.deepEqual(fs.readdirSync(dir), ['database.json']);
  });

  it('refuses to start on an unreadable file instead of wiping it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sifted-'));
    const file = path.join(dir, 'database.json');
    fs.writeFileSync(file, '{ not json');
    assert.throws(() => new Database(file), /Could not read/);
    assert.equal(fs.readFileSync(file, 'utf-8'), '{ not json');
    assert.equal(fs.readdirSync(dir).filter((f) => f.includes('unreadable')).length, 1);
  });
});
