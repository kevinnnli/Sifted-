import os from 'os';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app';
import { ensureEnvAdmin, isDemoMode, seedDemoData } from './bootstrap';
import { Database } from './db';
import { ensureTestAccounts } from './testAccounts';
import { pruneExpiredSessions } from './security';
import { sweepExpiredAttempts } from './services/attempts';
import { redisStoreFromEnv, StorageConflictError, storageInfo } from './storage';

/**
 * Vercel Function entry point for every /api request (see scripts/build-vercel.mjs). Each function
 * instance keeps the database in memory, syncs it with Redis before handling a request and writes
 * changes back before the response is sent.
 */

const SWEEP_INTERVAL_MS = 30_000;

let ready: Promise<{ app: ReturnType<typeof createApp>; db: Database }> | null = null;
let lastSweep = 0;

async function init() {
  const store = redisStoreFromEnv();
  let db: Database;
  if (store) {
    // Several instances may start at once; whichever saves second starts over from the stored data
    for (let attempt = 1; ; attempt++) {
      db = await Database.connect(store);
      storageInfo.mode = 'redis';
      try {
        await prepare(db);
        break;
      } catch (e) {
        if (!(e instanceof StorageConflictError) || attempt >= 5) throw e;
      }
    }
  } else {
    // Vercel's disk is wiped whenever an instance is recycled: usable for a quick look only
    db = new Database(path.join(os.tmpdir(), 'sifted-database.json'));
    storageInfo.mode = 'temporary';
    console.warn('⚠️  No Redis store configured (KV_REST_API_URL / KV_REST_API_TOKEN): data will be lost when this instance restarts.');
    await prepare(db);
  }
  return { app: createApp(db), db };
}

async function prepare(db: Database) {
  if (isDemoMode() && db.isNew) await seedDemoData(db);
  const adminWarning = await ensureEnvAdmin(db);
  if (adminWarning) console.warn(`⚠️  ${adminWarning}`);
  await ensureTestAccounts(db);
  await db.flush();
}

function sendError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ success: false, message }));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // The route config rewrites /api/<path> to this function as /api?__sifted_path=<path>
  const url = new URL(req.url || '/', 'http://localhost');
  const original = url.searchParams.get('__sifted_path');
  if (original !== null) {
    url.searchParams.delete('__sifted_path');
    req.url = `/api${original ? `/${original.replace(/^\/+/, '')}` : ''}${url.search}`;
  }

  let context;
  try {
    context = await (ready ??= init());
  } catch (e) {
    ready = null;
    console.error('Failed to start Sifted:', e);
    return sendError(res, 500, 'The server failed to start. Check the deployment logs.');
  }
  const { app, db } = context;

  try {
    await db.refresh();
    if (Date.now() - lastSweep > SWEEP_INTERVAL_MS) {
      lastSweep = Date.now();
      await sweepExpiredAttempts(db);
      pruneExpiredSessions(db);
    }
    await db.flush();
  } catch (e) {
    if (!(e instanceof StorageConflictError)) console.error('Storage error:', e);
    return sendError(res, 503, 'The server was busy. Please try again.');
  }

  // Hold the response until this request's changes are stored, so the instance can't be frozen
  // (or the client move on) before the write lands. If they couldn't be stored, answer with an
  // error instead of the handler's response, so nobody is told a change worked when it didn't.
  const epoch = db.epoch;
  const end = res.end.bind(res) as (...args: unknown[]) => ServerResponse;
  res.end = ((...args: unknown[]) => {
    db.flush()
      .then(
        () => db.epoch === epoch || req.method === 'GET',
        (e) => {
          if (!(e instanceof StorageConflictError)) console.error('Failed to save changes:', e);
          return false;
        }
      )
      .then((saved) => {
        if (saved || res.headersSent) return end(...args);
        res.statusCode = 503;
        res.removeHeader('Set-Cookie');
        res.removeHeader('Content-Length');
        res.setHeader('Content-Type', 'application/json');
        end(JSON.stringify({ success: false, message: 'Your change could not be saved because the server was busy. Please try again.' }));
      });
    return res;
  }) as typeof res.end;

  app(req as any, res as any);
}
