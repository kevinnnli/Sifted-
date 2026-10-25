import fs from 'fs';
import path from 'path';
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
 */
export class Database {
  data: DatabaseShape;
  readonly isNew: boolean;

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
    if (!this.file) return;
    // Write to a temporary file and rename it over the real one, so a crash mid-write can't corrupt the data
    const tmp = path.join(path.dirname(this.file), `.${path.basename(this.file)}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, this.file);
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
