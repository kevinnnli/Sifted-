import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../app';
import { ensureEnvAdmin } from '../bootstrap';
import { Database } from '../db';
import { ADMIN_EMAIL, ADMIN_PASSWORD, studentSignup, TestClient } from './helpers';

describe('file storage (group commit)', () => {
  let file: string;
  let db: Database;
  let base: string;
  let close: () => Promise<void>;

  before(async () => {
    Object.assign(process.env, { ADMIN_EMAIL, ADMIN_PASSWORD });
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sifted-')), 'database.json');
    db = new Database(file);
    await ensureEnvAdmin(db);
    await db.flush();
    const server = createApp(db).listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => new Promise((r) => server.close(() => r()));
  });
  after(() => close());

  const onDisk = () => JSON.parse(fs.readFileSync(file, 'utf-8'));

  test('a change is on disk by the time its response arrives', async () => {
    const res = await new TestClient(base).post('/api/auth/register', studentSignup({ email: 'durable@uni.edu' }));
    assert.equal(res.status, 201);
    assert.ok(onDisk().users.some((u: any) => u.email === 'durable@uni.edu'));
  });

  test('concurrent changes are all saved, in fewer writes than requests', async () => {
    let writes = 0;
    const original = fs.promises.rename;
    fs.promises.rename = (async (...args: Parameters<typeof original>) => {
      writes++;
      return original(...args);
    }) as typeof original;
    try {
      const results = await Promise.all(
        Array.from({ length: 30 }, (_, i) => new TestClient(base).post('/api/auth/register', studentSignup({ email: `batch${i}@uni.edu` })))
      );
      assert.ok(results.every((r) => r.status === 201));
      const saved = onDisk().users.filter((u: any) => u.email.startsWith('batch')).length;
      assert.equal(saved, 30);
      assert.ok(writes < 30, `expected batched writes, got ${writes} writes for 30 requests`);
    } finally {
      fs.promises.rename = original;
    }
  });

  test('requests that change nothing do not write', async () => {
    const before = fs.statSync(file).mtimeMs;
    await new TestClient(base).get('/api/health');
    await new TestClient(base).get('/api/auth/me');
    assert.equal(fs.statSync(file).mtimeMs, before);
  });
});
