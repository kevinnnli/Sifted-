import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { attemptsFileFor, commitTracker, Database } from '../db';
import { StorageConflictError, type RemoteStore, type Snapshot } from '../storage';

/** In-memory stand-in for Redis, shared by several Database instances like Vercel function instances. */
function memoryStore() {
  let saved: string | null = null;
  let writes = 0;
  const store: RemoteStore = {
    async readRevision() {
      return saved ? (JSON.parse(saved) as Snapshot).revision : 0;
    },
    async read() {
      return saved ? (JSON.parse(saved) as Snapshot) : null;
    },
    async write(snapshot, expectedRevision) {
      const current = saved ? (JSON.parse(saved) as Snapshot).revision : 0;
      if (current !== expectedRevision) return false;
      writes++;
      saved = JSON.stringify(snapshot);
      return true;
    },
  };
  return { store, writes: () => writes };
}

const user = (id: string) => ({ id, name: id, email: `${id}@uni.edu`, role: 'applicant' as const, createdAt: new Date().toISOString() });

describe('remote storage', () => {
  test('a fresh store starts empty and is marked new', async () => {
    const { store } = memoryStore();
    const db = await Database.connect(store);
    assert.equal(db.isNew, true);
    assert.equal(db.data.users.length, 0);
  });

  test('changes are written on flush, not on save', async () => {
    const { store, writes } = memoryStore();
    const db = await Database.connect(store);
    db.data.users.push(user('u1'));
    db.save();
    db.save();
    assert.equal(writes(), 0);
    await db.flush();
    await db.flush();
    assert.equal(writes(), 1);
  });

  test('instances see each other\'s writes after refresh', async () => {
    const { store } = memoryStore();
    const a = await Database.connect(store);
    const b = await Database.connect(store);
    a.data.users.push(user('from-a'));
    a.save();
    await a.flush();
    assert.equal(b.data.users.length, 0);
    await b.refresh();
    assert.deepEqual(b.data.users.map((u) => u.id), ['from-a']);

    b.data.users.push(user('from-b'));
    b.save();
    await b.flush();
    await a.refresh();
    assert.deepEqual(a.data.users.map((u) => u.id), ['from-a', 'from-b']);

    const c = await Database.connect(store);
    assert.equal(c.isNew, false);
    assert.equal(c.data.users.length, 2);
  });

  test('a failed write is retried on the next flush', async () => {
    const { store } = memoryStore();
    let fail = true;
    const flaky: RemoteStore = {
      ...store,
      async write(snapshot, expectedRevision) {
        if (fail) throw new Error('network down');
        return store.write(snapshot, expectedRevision);
      },
    };
    const db = await Database.connect(flaky);
    db.data.users.push(user('u1'));
    db.save();
    await assert.rejects(db.flush());
    fail = false;
    await db.flush();
    assert.equal((await store.read())?.revision, 1);
  });

  test('a write based on stale data is refused instead of overwriting the other instance', async () => {
    const { store } = memoryStore();
    const a = await Database.connect(store);
    const b = await Database.connect(store);
    a.data.users.push(user('from-a'));
    a.save();
    await a.flush();

    // b hasn't refreshed, so its change is based on the old data
    b.data.users.push(user('from-b'));
    b.save();
    const epoch = b.epoch;
    await assert.rejects(b.flush(), StorageConflictError);
    assert.equal(b.epoch, epoch + 1);
    // b reloaded the stored data and a's change survived
    assert.deepEqual(b.data.users.map((u) => u.id), ['from-a']);
    assert.deepEqual(((await store.read())!.data as any).users.map((u: any) => u.id), ['from-a']);

    // After the reload b can save normally again
    b.data.users.push(user('from-b'));
    b.save();
    await b.flush();
    await a.refresh();
    assert.deepEqual(a.data.users.map((u) => u.id), ['from-a', 'from-b']);
  });
});

describe('commit() with a remote store', () => {
  test('a change that loses the race to another instance is re-applied to the newer data, not dropped', async () => {
    const { store } = memoryStore();
    const a = await Database.connect(store);
    const b = await Database.connect(store);
    let runs = 0;
    const result = await a.commit(() => {
      runs++;
      if (runs === 1) {
        // Another instance saves between this instance's read and its write
        b.data.users.push(user('from-b'));
        b.save();
        void b.flush();
      }
      a.data.users.push(user('from-a'));
      return 'stored';
    });
    assert.equal(result, 'stored');
    assert.equal(runs, 2, 'retried once');
    const stored = ((await store.read())!.data as any).users.map((u: any) => u.id).sort();
    assert.deepEqual(stored, ['from-a', 'from-b']);
  });

  test('records the commit for the request it belongs to', async () => {
    const { store } = memoryStore();
    const db = await Database.connect(store);
    const tracked = { changed: false, committedEpoch: null as number | null };
    await commitTracker.run(tracked, () => db.commit(() => db.data.users.push(user('u1'))));
    assert.equal(tracked.committedEpoch, db.epoch);
  });

  test('errors from the change itself are passed on and nothing is stored', async () => {
    const { store, writes } = memoryStore();
    const db = await Database.connect(store);
    await assert.rejects(db.commit(() => {
      throw new Error('not allowed');
    }), /not allowed/);
    assert.equal(writes(), 0);
  });
});

describe('tests in progress next to the database file', () => {
  const attempt = (id: string, invitationId: string, answer = '') =>
    ({
      id, invitationId, assessmentId: 'a1', studentId: 's1', startedAt: new Date().toISOString(), questionOrder: ['q1'], optionOrders: {},
      responses: { q1: answer }, flagged: {}, currentQuestionIndex: 0, timeSpent: {}, tabSwitches: 0, copyPasteAttempts: 0,
      integrityEvents: [], lockdown: false, details: { university: 'U', degreeProgram: 'P' }, updatedAt: new Date().toISOString(),
    }) as any;
  const tempFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sifted-attempts-')), 'database.json');

  test('saving only a test in progress rewrites the small file, not the database', async () => {
    const file = tempFile();
    const db = new Database(file);
    db.data.users.push(user('u1'));
    db.data.attempts.push(attempt('t1', 'i1'));
    db.save();
    await db.flush();
    const mainBefore = fs.readFileSync(file, 'utf-8');

    db.data.attempts[0].responses.q1 = 'newer answer';
    db.saveAttempts();
    await db.flush();
    assert.equal(fs.readFileSync(file, 'utf-8'), mainBefore, 'database file untouched');
    const sidecar = JSON.parse(fs.readFileSync(attemptsFileFor(file), 'utf-8'));
    assert.equal(sidecar.attempts[0].responses.q1, 'newer answer');

    // A restart picks up the newer copy
    assert.equal(new Database(file).data.attempts[0].responses.q1, 'newer answer');
  });

  test('a later full save wins over an older attempts file, and the database file alone is complete', async () => {
    const file = tempFile();
    const db = new Database(file);
    db.data.attempts.push(attempt('t1', 'i1', 'first'));
    db.saveAttempts();
    await db.flush();
    db.data.attempts[0].responses.q1 = 'second';
    db.data.users.push(user('u1'));
    db.save();
    await db.flush();

    assert.equal(new Database(file).data.attempts[0].responses.q1, 'second');
    // What an older version of Sifted (which ignores the attempts file) would read
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf-8')).attempts[0].responses.q1, 'second');
  });

  test('a test that was already submitted is not loaded as still in progress', async () => {
    const file = tempFile();
    const db = new Database(file);
    db.data.attempts.push(attempt('t1', 'i1'), attempt('t2', 'i2'));
    db.data.submissions.push({ id: 'sub1', invitationId: 'i1' } as any);
    db.save();
    await db.flush();
    assert.deepEqual(new Database(file).data.attempts.map((a) => a.id), ['t2']);
  });
});
