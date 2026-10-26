import { AsyncLocalStorage } from 'async_hooks';
import fs from 'fs';
import path from 'path';
import { StorageConflictError, type RemoteStore } from './storage';
import type { DatabaseShape, StoredUser } from './types';

export const SCHEMA_VERSION = 2;

export function emptyDatabase(): DatabaseShape {
  return {
    version: SCHEMA_VERSION,
    users: [],
    professors: [],
    assessments: [],
    questions: [],
    invitations: [],
    submissions: [],
    attempts: [],
    sessions: [],
    settings: {},
  };
}

/**
 * Version 1 was the unauthenticated prototype format ({ userAccounts, questionBank, ... }).
 * Its accounts have no passwords, so they are imported locked: an admin must set a password
 * before anyone can sign in to them, and the old shared admin accounts are disabled outright.
 */
function migrateV1(raw: any): DatabaseShape {
  const now = new Date().toISOString();
  const db = emptyDatabase();
  const seenEmails = new Set<string>();
  db.users = (Array.isArray(raw.userAccounts) ? raw.userAccounts : [])
    .filter((a: any) => a && typeof a.email === 'string' && typeof a.id === 'string')
    .filter((a: any) => {
      const email = a.email.toLowerCase();
      if (seenEmails.has(email)) return false;
      seenEmails.add(email);
      return true;
    })
    .map(
      (a: any): StoredUser => ({
        ...a,
        email: a.email.toLowerCase(),
        disabled: a.role === 'admin' ? true : Boolean(a.disabled),
        createdAt: a.createdAt || now,
      })
    );
  db.professors = Array.isArray(raw.professors) ? raw.professors : [];
  db.assessments = Array.isArray(raw.assessments) ? raw.assessments : [];
  db.questions = Array.isArray(raw.questionBank) ? raw.questionBank : [];
  db.invitations = Array.isArray(raw.invitations) ? raw.invitations : [];
  db.submissions = Array.isArray(raw.submissions) ? raw.submissions : [];
  return db;
}

function migrate(raw: any): DatabaseShape {
  if (!raw || typeof raw !== 'object') return emptyDatabase();
  const data = raw.version === undefined ? migrateV1(raw) : raw;
  if (data.version > SCHEMA_VERSION) {
    throw new Error(`database.json was written by a newer version of Sifted (schema ${data.version})`);
  }
  // Fill any collection missing from an older or hand-edited file
  const defaults = emptyDatabase();
  for (const key of Object.keys(defaults) as (keyof DatabaseShape)[]) {
    if (Array.isArray(defaults[key]) && !Array.isArray(data[key])) (data as any)[key] = [];
  }
  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) data.settings = {};
  data.version = SCHEMA_VERSION;
  return data as DatabaseShape;
}

/**
 * Tracks, per request, whether it changed anything and whether a commit() stored its change. The
 * Vercel entry point uses it to tell a request whose change was saved (perhaps after retrying)
 * from one whose change was lost, and to let requests that changed nothing through.
 */
export interface RequestTracking {
  changed: boolean;
  committedEpoch: number | null;
}
export const commitTracker = new AsyncLocalStorage<RequestTracking>();

const markChanged = () => {
  const tracked = commitTracker.getStore();
  if (tracked) tracked.changed = true;
};

const COMMIT_ATTEMPTS = 8;
// Before retrying, wait a random, growing moment so instances that collided don't collide again
const backOff = (attempt: number) => new Promise((r) => setTimeout(r, Math.random() * 30 * attempt));

/** Where in-progress tests are kept next to a database file: database.json → database.attempts.json */
export function attemptsFileFor(file: string) {
  return file.endsWith('.json') ? `${file.slice(0, -'.json'.length)}.attempts.json` : `${file}.attempts.json`;
}

/**
 * All data lives in memory. Mutations are synchronous (single thread, no interleaving) and call
 * save(), which only marks the data as changed. flush() then writes it out: to the JSON file as a
 * group commit (one write at a time, each covering every change made before it started), or to
 * the remote store. Requests that changed something wait for their flush before they get a
 * response (see persistBeforeResponding), so an acknowledged change is always on disk.
 * Pass `file: null` for a purely in-memory database (tests).
 *
 * Tests in progress change every few seconds while the rest of the data rarely does, so with a
 * file they are also kept in a small companion file (see attemptsFileFor): a change that only
 * touches them (saveAttempts) rewrites that file instead of the whole database. Each copy of the
 * attempts carries a revision number and loading takes the newer one, so the main file is always
 * a complete database on its own (older versions of Sifted can still read it).
 *
 * With a remote store (serverless hosting, see Database.connect) changes are instead collected and
 * written by flush() before each response, and refresh() picks up writes from other instances.
 * commit() retries a change when another instance saved first.
 */
export class Database {
  data: DatabaseShape;
  isNew: boolean;
  private store: RemoteStore | null = null;
  private revision = 0;
  // What has changed since the last write: everything, or only tests in progress
  private dirtyMain = false;
  private dirtyAttempts = false;
  private attemptsRevision = 0;
  private writing: Promise<void> = Promise.resolve();
  // File group commit: the write in progress, and the one queued behind it
  private fileWrite: Promise<void> | null = null;
  private queuedFileWrite: Promise<void> | null = null;
  /** Increases on every save(), so callers can tell whether anything changed during a request. */
  generation = 0;
  /** Increases whenever unsaved changes are thrown away after a conflict (see flush). */
  epoch = 0;

  static async connect(store: RemoteStore): Promise<Database> {
    const db = new Database(null);
    const snapshot = await store.read();
    if (snapshot) {
      db.data = migrate(snapshot.data);
      db.revision = snapshot.revision;
      db.isNew = false;
    }
    db.store = store;
    return db;
  }

  constructor(private readonly file: string | null) {
    const { data, isNew } = this.load();
    this.data = data;
    this.isNew = isNew;
    // Persist immediately so a migrated file is upgraded on disk
    if (this.file) {
      this.data.attemptsRevision = this.attemptsRevision;
      this.writeFileNow(this.file, JSON.stringify(this.data));
    }
  }

  private get dirty() {
    return this.dirtyMain || this.dirtyAttempts;
  }

  /** True when changes are written to a local file (as opposed to memory only or a remote store). */
  get writesToFile() {
    return Boolean(this.file) && !this.store;
  }

  // Write to a temporary file and rename it over the real one, so a crash mid-write can't corrupt the data
  private tempPath(target: string) {
    return path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  }

  private writeFileNow(target: string, json: string) {
    const tmp = this.tempPath(target);
    fs.writeFileSync(tmp, json, { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, target);
  }

  private async writeFile(target: string, json: string) {
    const tmp = this.tempPath(target);
    await fs.promises.writeFile(tmp, json, { encoding: 'utf-8', mode: 0o600 });
    await fs.promises.rename(tmp, target);
  }

  private flushFile(): Promise<void> {
    if (this.fileWrite) {
      if (!this.dirty) return this.fileWrite; // everything changed so far is in the write in progress
      // Newer changes: one more write after the current one covers all of them
      this.queuedFileWrite ??= this.fileWrite
        .catch(() => {})
        .then(() => {
          this.queuedFileWrite = null;
          return this.flushFile();
        });
      return this.queuedFileWrite;
    }
    if (!this.dirty) return Promise.resolve();
    const full = this.dirtyMain;
    const attemptsChanged = this.dirtyAttempts;
    this.dirtyMain = this.dirtyAttempts = false;
    if (attemptsChanged) this.attemptsRevision++;
    let target: string;
    let json: string;
    if (full) {
      // The whole database, tests in progress included
      this.data.attemptsRevision = this.attemptsRevision;
      target = this.file!;
      json = JSON.stringify(this.data);
    } else {
      target = attemptsFileFor(this.file!);
      json = JSON.stringify({ revision: this.attemptsRevision, attempts: this.data.attempts });
    }
    this.fileWrite = this.writeFile(target, json)
      .catch((e) => {
        if (full) this.dirtyMain = true;
        if (attemptsChanged) this.dirtyAttempts = true;
        throw e;
      })
      .finally(() => {
        this.fileWrite = null;
      });
    return this.fileWrite;
  }

  private readJson(file: string) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      // Never silently overwrite data we couldn't read: keep a copy for recovery and refuse to start
      const backup = `${file}.unreadable-${Date.now()}`;
      try {
        fs.copyFileSync(file, backup);
      } catch {
        // best effort
      }
      throw new Error(`Could not read ${file} (a copy was saved to ${backup}): ${(e as Error).message}`);
    }
  }

  private load(): { data: DatabaseShape; isNew: boolean } {
    if (!this.file || !fs.existsSync(this.file)) return { data: emptyDatabase(), isNew: true };
    const data = migrate(this.readJson(this.file));
    this.attemptsRevision = Number(data.attemptsRevision) || 0;
    // Tests in progress saved after the last full write
    const sidecar = attemptsFileFor(this.file);
    if (fs.existsSync(sidecar)) {
      const saved = this.readJson(sidecar);
      if (Number(saved?.revision) > this.attemptsRevision && Array.isArray(saved.attempts)) {
        data.attempts = saved.attempts;
        this.attemptsRevision = Number(saved.revision);
      }
    }
    dropFinishedAttempts(data);
    return { data, isNew: false };
  }

  /** Marks the data as changed. */
  save() {
    this.generation++;
    markChanged();
    if (this.store || this.file) this.dirtyMain = this.dirtyAttempts = true;
  }

  /** Marks only tests in progress (data.attempts) as changed; use save() if anything else changed too. */
  saveAttempts() {
    if (this.store) return this.save(); // the remote store keeps a single document
    this.generation++;
    markChanged();
    if (this.file) this.dirtyAttempts = true;
  }

  /** Writes pending changes to the file or remote store (see the class comment). */
  flush(): Promise<void> {
    if (this.writesToFile) return this.flushFile();
    const store = this.store;
    if (!store) return Promise.resolve();
    const run = this.writing.then(async () => {
      if (!this.dirty) return;
      this.dirtyMain = this.dirtyAttempts = false;
      const revision = this.revision + 1;
      let stored: boolean;
      try {
        stored = await store.write({ revision, data: this.data }, this.revision);
      } catch (e) {
        this.dirtyMain = this.dirtyAttempts = true;
        throw e;
      }
      if (stored) {
        this.revision = revision;
        return;
      }
      // Another instance saved first: take its data and drop ours rather than overwrite it
      const snapshot = await store.read();
      this.data = snapshot ? migrate(snapshot.data) : emptyDatabase();
      this.revision = snapshot?.revision ?? 0;
      this.epoch++;
      throw new StorageConflictError();
    });
    this.writing = run.catch(() => {});
    return run;
  }

  /**
   * Applies a change and saves it. `mutate` must be synchronous and look up what it changes in
   * `db.data` afresh (not through objects fetched earlier), because with a remote store it may run
   * more than once: if another instance saved first, the latest data is loaded and `mutate` runs
   * again, so the change is not lost to a conflict. Errors thrown by `mutate` are passed on.
   * With a file or in memory it simply runs once; the request's response waits for the write.
   */
  async commit<T>(mutate: () => T, { attemptsOnly = false } = {}): Promise<T> {
    if (!this.store) {
      const result = mutate();
      if (attemptsOnly) this.saveAttempts();
      else this.save();
      return result;
    }
    for (let attempt = 1; ; attempt++) {
      try {
        await this.flush(); // anything this request changed before, so refresh() can load newer data
      } catch (e) {
        if (!(e instanceof StorageConflictError)) throw e;
      }
      await this.refresh();
      const epoch = this.epoch;
      const result = mutate();
      this.save();
      try {
        await this.flush();
      } catch (e) {
        if (!(e instanceof StorageConflictError) || attempt >= COMMIT_ATTEMPTS) throw e;
        await backOff(attempt);
        continue;
      }
      // Another request on this instance may have lost a race in between, which reloads the data
      // and drops this change too even though this flush found nothing left to write
      if (this.epoch !== epoch) {
        if (attempt >= COMMIT_ATTEMPTS) throw new StorageConflictError();
        await backOff(attempt);
        continue;
      }
      const tracked = commitTracker.getStore();
      if (tracked) tracked.committedEpoch = this.epoch;
      return result;
    }
  }

  /** Loads the latest data if another instance has written since this one last read or wrote. */
  async refresh() {
    if (!this.store || this.dirty) return;
    if ((await this.store.readRevision()) <= this.revision) return;
    const snapshot = await this.store.read();
    if (snapshot && snapshot.revision > this.revision && !this.dirty) {
      this.data = migrate(snapshot.data);
      this.revision = snapshot.revision;
    }
  }

  replaceAll(data: DatabaseShape) {
    this.data = data;
    this.save();
  }

  findUserByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.data.users.find((u) => u.email === normalized);
  }

  findUser(id: string) {
    return this.data.users.find((u) => u.id === id);
  }
}

/**
 * A test that already became a submission is no longer in progress. Normally the two never exist
 * together; this repairs data restored from mismatched copies (for example after a downgrade).
 */
function dropFinishedAttempts(data: DatabaseShape) {
  const submitted = new Set(data.submissions.map((s) => s.invitationId).filter(Boolean));
  const before = data.attempts.length;
  data.attempts = data.attempts.filter((a) => !submitted.has(a.invitationId));
  if (data.attempts.length !== before) console.warn(`Dropped ${before - data.attempts.length} test(s) in progress that were already submitted.`);
}
