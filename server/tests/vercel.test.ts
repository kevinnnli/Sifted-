import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import express from 'express';
import { commitTracker, Database, type RequestTracking } from '../db';
import type { RemoteStore, Snapshot } from '../storage';
import { createVercelHandler } from '../vercel';
import { ADMIN_EMAIL, ADMIN_PASSWORD, assessmentBody, mcQuestion, essayQuestion, studentSignup, TestClient } from './helpers';

/** Redis stand-in with a little network latency, shared by every simulated function instance. */
function slowStore(latencyMs = 3): RemoteStore {
  let saved: string | null = null;
  const pause = () => new Promise((r) => setTimeout(r, latencyMs));
  const revision = () => (saved ? (JSON.parse(saved) as Snapshot).revision : 0);
  return {
    async readRevision() {
      await pause();
      return revision();
    },
    async read() {
      await pause();
      return saved ? (JSON.parse(saved) as Snapshot) : null;
    },
    async write(snapshot, expectedRevision) {
      await pause();
      // Compare-and-set happens atomically on the server, as in the Lua script
      if (revision() !== expectedRevision) return false;
      saved = JSON.stringify(snapshot);
      return true;
    },
  };
}

describe('several Vercel function instances sharing one store', () => {
  const instances: { base: string; close: () => Promise<void> }[] = [];
  const env = { ADMIN_EMAIL, ADMIN_PASSWORD, STUDENT_VERIFICATION: 'auto', SIFTED_TEST_ACCOUNTS: 'off', GEMINI_API_KEY: '' };
  const previous: Record<string, string | undefined> = {};
  let students: { client: TestClient; email: string; attemptId?: string; questionIds?: string[] }[] = [];

  before(async () => {
    for (const [k, v] of Object.entries(env)) {
      previous[k] = process.env[k];
      process.env[k] = v;
    }
    const store = slowStore();
    for (let i = 0; i < 3; i++) {
      const server = http.createServer(createVercelHandler(() => store));
      server.listen(0);
      await new Promise<void>((r) => server.once('listening', () => r()));
      instances.push({
        base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    }
  });
  after(async () => {
    await Promise.all(instances.map((i) => i.close()));
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  // A client whose requests land on a different instance each time, like a load balancer
  class SpreadClient extends TestClient {
    private n = 0;
    constructor(offset: number) {
      super(instances[0].base);
      this.n = offset;
    }
    override async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      (this as any).base = instances[this.n++ % instances.length].base;
      return super.request(method, path, body, headers);
    }
  }

  test('concurrent autosaves and double submissions are all stored exactly once', async () => {
    const admin = new SpreadClient(0);
    await admin.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const professor = new SpreadClient(1);
    const created = await admin.post('/api/admin/professors', {
      name: 'Dr. Grace Hopper', email: 'grace.hopper@uni.edu', department: 'CS', labName: 'Compilers', temporaryPassword: 'temporary-pass-1',
    });
    assert.equal(created.status, 201);
    await professor.login('grace.hopper@uni.edu', 'temporary-pass-1');
    assert.equal((await professor.post('/api/auth/change-password', { currentPassword: 'temporary-pass-1', newPassword: 'compilers-are-fun-1' })).status, 200);
    const mc = (await professor.post('/api/professor/questions', { question: mcQuestion })).data.question;
    const essay = (await professor.post('/api/professor/questions', { question: essayQuestion })).data.question;
    const assessmentId = (await professor.post('/api/professor/assessments', { assessment: assessmentBody([mc.id, essay.id]) })).data.assessment.id;

    students = Array.from({ length: 24 }, (_, i) => ({ client: new SpreadClient(i), email: `vercel${i}@uni.edu` }));
    for (const s of students) assert.equal((await s.client.post('/api/auth/register', studentSignup({ email: s.email }))).status, 201);
    const invited = await professor.post('/api/professor/invitations', { assessmentId, emails: students.map((s) => s.email) });
    assert.equal(invited.data.created.length, students.length);

    const portals = await Promise.all(students.map((s) => s.client.get('/api/student/portal')));
    await Promise.all(
      students.map(async (s, i) => {
        const started = await s.client.post(`/api/student/invitations/${portals[i].data.invitations[0].id}/attempt`, {
          lockdown: false,
          details: { university: 'State University', degreeProgram: 'B.S.' },
        });
        assert.equal(started.status, 201, JSON.stringify(started.data));
        s.attemptId = started.data.attempt.id;
      })
    );

    // Everyone autosaves at once, three times, each save landing on a different instance
    const failures: number[] = [];
    for (let round = 0; round < 3; round++) {
      const results = await Promise.all(
        students.map((s) => s.client.put(`/api/student/attempts/${s.attemptId}`, { responses: { [mc.id]: '7', [essay.id]: `round ${round} answer about overfitting` } }))
      );
      results.forEach((r) => r.status !== 200 && failures.push(r.status));
    }
    assert.deepEqual(failures, [], 'every autosave was stored');

    // Every student submits twice at once (two tabs), each request on a different instance
    const submits = await Promise.all(
      students.flatMap((s) => [s.client.post(`/api/student/attempts/${s.attemptId}/submit`, {}), s.client.post(`/api/student/attempts/${s.attemptId}/submit`, {})])
    );
    const statuses = submits.map((r) => r.status);
    assert.ok(statuses.every((st) => st === 200 || st === 404), `unexpected statuses: ${statuses.join(',')}`);

    const workspace = (await professor.get('/api/professor/workspace')).data;
    assert.equal(workspace.submissions.length, students.length, 'one submission per student');
    for (const s of students) {
      const mine = workspace.submissions.filter((sub: any) => sub.applicantEmail === s.email);
      assert.equal(mine.length, 1, `${s.email} has exactly one submission`);
      assert.equal(mine[0].responses[essay.id].answer, 'round 2 answer about overfitting', 'the last autosave was graded');
      assert.equal((await s.client.get('/api/auth/me')).data.user?.email, s.email, 'still signed in');
    }
  });
});

describe('request tracking', () => {
  // The Vercel entry point decides whether a response may claim success from what the request
  // changed. That relies on the tracking surviving Express reading the body from the network.
  test('changes made after a large request body is parsed are attributed to that request', async () => {
    const db = new Database(null);
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post('/change', (_req, res) => {
      db.save();
      res.json({ ok: true });
    });
    app.post('/read', (_req, res) => res.json({ ok: true }));
    const seen: RequestTracking[] = [];
    const server = http.createServer((req, res) => {
      const tracked: RequestTracking = { changed: false, committedEpoch: null };
      seen.push(tracked);
      commitTracker.run(tracked, () => app(req, res));
    });
    server.listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const body = JSON.stringify({ answer: 'x'.repeat(300_000) });
    await fetch(`${base}/change`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    await fetch(`${base}/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    await new Promise<void>((r) => server.close(() => r()));
    assert.deepEqual(seen.map((t) => t.changed), [true, false]);
  });
});
