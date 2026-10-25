import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Database } from '../db';
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
