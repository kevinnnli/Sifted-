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
 * All data lives in memory. Mutations are synchronous (single thread, no interleaving) and call
 * save(), which only marks the data as changed. flush() then writes it out: to the JSON file as a
 * group commit (one write at a time, each covering every change made before it started), or to
 * the remote store. Requests that changed something wait for their flush before they get a
 * response (see persistBeforeResponding), so an acknowledged change is always on disk.
 * Pass `file: null` for a purely in-memory database (tests).
 *
 * With a remote store (serverless hosting, see Database.connect) changes are instead collected and
 * written by flush() before each response, and refresh() picks up writes from other instances.
 */
export class Database {
  data: DatabaseShape;
  isNew: boolean;
  private store: RemoteStore | null = null;
  private revision = 0;
  private dirty = false;
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
    if (this.file) this.writeFileNow(JSON.stringify(this.data));
  }

  /** True when changes are written to a local file (as opposed to memory only or a remote store). */
  get writesToFile() {
    return Boolean(this.file) && !this.store;
  }

  // Write to a temporary file and rename it over the real one, so a crash mid-write can't corrupt the data
  private tempPath() {
    return path.join(path.dirname(this.file!), `.${path.basename(this.file!)}.${process.pid}.tmp`);
  }

  private writeFileNow(json: string) {
    const tmp = this.tempPath();
    fs.writeFileSync(tmp, json, { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, this.file!);
  }

  private async writeFile(json: string) {
    const tmp = this.tempPath();
    await fs.promises.writeFile(tmp, json, { encoding: 'utf-8', mode: 0o600 });
    await fs.promises.rename(tmp, this.file!);
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
    this.dirty = false;
    const json = JSON.stringify(this.data);
    this.fileWrite = this.writeFile(json)
      .catch((e) => {
        this.dirty = true;
        throw e;
      })
      .finally(() => {
        this.fileWrite = null;
      });
    return this.fileWrite;
  }

  private load(): { data: DatabaseShape; isNew: boolean } {
    if (!this.file || !fs.existsSync(this.file)) return { data: emptyDatabase(), isNew: true };
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      return { data: migrate(raw), isNew: false };
    } catch (e) {
      // Never silently overwrite a database we couldn't read: keep a copy for recovery and refuse to start
      const backup = `${this.file}.unreadable-${Date.now()}`;
      try {
        fs.copyFileSync(this.file, backup);
      } catch {
        // best effort
      }
      throw new Error(`Could not read ${this.file} (a copy was saved to ${backup}): ${(e as Error).message}`);
    }
  }

  save() {
    this.generation++;
    if (this.store || this.file) this.dirty = true;
  }

  /** Writes pending changes to the file or remote store (see the class comment). */
  flush(): Promise<void> {
    if (this.writesToFile) return this.flushFile();
    const store = this.store;
    if (!store) return Promise.resolve();
    const run = this.writing.then(async () => {
      if (!this.dirty) return;
      this.dirty = false;
      const revision = this.revision + 1;
      let stored: boolean;
      try {
        stored = await store.write({ revision, data: this.data }, this.revision);
      } catch (e) {
        this.dirty = true;
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
