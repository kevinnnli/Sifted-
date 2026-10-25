import fs from 'fs';
import path from 'path';
import type { RemoteStore } from './storage';
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
    if (key !== 'version' && !Array.isArray(data[key])) (data as any)[key] = [];
  }
  data.version = SCHEMA_VERSION;
  return data as DatabaseShape;
}

/**
 * All data lives in memory and is written to a JSON file after every change. Requests are handled
 * on a single thread and every mutation is synchronous, so there are no interleaved writes.
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
    this.save();
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
    if (this.store) {
      this.dirty = true;
      return;
    }
    if (!this.file) return;
    // Write to a temporary file and rename it over the real one, so a crash mid-write can't corrupt the data
    const tmp = path.join(path.dirname(this.file), `.${path.basename(this.file)}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  /** Writes pending changes to the remote store; writes run one at a time, newest data wins. */
  flush(): Promise<void> {
    const store = this.store;
    if (!store) return Promise.resolve();
    const run = this.writing.then(async () => {
      if (!this.dirty) return;
      this.dirty = false;
      const revision = this.revision + 1;
      try {
        await store.write({ revision, data: this.data });
        this.revision = revision;
      } catch (e) {
        this.dirty = true;
        throw e;
      }
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
