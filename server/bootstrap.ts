import crypto from 'crypto';
import type { Database } from './db';
import { emptyDatabase } from './db';
import { MOCK_ASSESSMENTS, MOCK_INVITATIONS, MOCK_PROFESSORS, MOCK_QUESTIONS, MOCK_SUBMISSIONS, MOCK_USER_ACCOUNTS } from './demoData';
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './security';
import type { StoredUser } from './types';

export const isDemoMode = () => process.env.SEED_DEMO_DATA === 'true';

/**
 * The administrator account is defined only by the server configuration (ADMIN_EMAIL and
 * ADMIN_PASSWORD, e.g. in .env.local). Nobody can create or promote an admin from the web app.
 * The configured password is authoritative and is re-applied on every start.
 */
export async function ensureEnvAdmin(db: Database): Promise<string | null> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  // An admin email that is no longer configured loses its admin access
  for (const user of db.data.users) {
    if (user.managedByEnv && user.email !== email) {
      user.managedByEnv = false;
      user.disabled = true;
    }
  }

  if (!email || !password) {
    db.save();
    return 'No administrator is configured. Set ADMIN_EMAIL and ADMIN_PASSWORD (for example in .env.local) and restart to enable the admin portal.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'ADMIN_EMAIL is not a valid email address; the admin portal is disabled.';
  if (password.length < 12) return 'ADMIN_PASSWORD must be at least 12 characters; the admin portal is disabled.';

  const existing = db.findUserByEmail(email);
  if (existing && existing.role !== 'admin') {
    return `ADMIN_EMAIL (${email}) already belongs to a ${existing.role} account, so it was not turned into an administrator. Use a different email.`;
  }
  if (existing) {
    if (!(await verifyPassword(password, existing.passwordHash))) {
      existing.passwordHash = await hashPassword(password);
      db.data.sessions = db.data.sessions.filter((s) => s.userId !== existing.id);
    }
    existing.managedByEnv = true;
    existing.disabled = false;
    existing.mustChangePassword = false;
  } else {
    db.data.users.push({
      id: crypto.randomUUID(),
      name: process.env.ADMIN_NAME?.trim() || 'Administrator',
      email,
      role: 'admin',
      adminTitle: 'Platform Administrator',
      isVerified: true,
      managedByEnv: true,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
  }
  db.save();
  return null;
}

/**
 * Optional sample data for trying Sifted out (SEED_DEMO_DATA=true). Every sample account uses
 * DEMO_PASSWORD; there is deliberately no built-in default password.
 */
export async function seedDemoData(db: Database, opts: { keepUserId?: string } = {}) {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_DEMO_DATA=true requires DEMO_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters) for the sample accounts`);
  }
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const kept = opts.keepUserId ? db.data.users.filter((u) => u.id === opts.keepUserId || u.managedByEnv) : db.data.users.filter((u) => u.managedByEnv);
  const keptIds = new Set(kept.map((u) => u.id));

  const demoUsers: StoredUser[] = structuredClone(MOCK_USER_ACCOUNTS).map((u) => ({ ...u, passwordHash, createdAt: now }));
  const data = emptyDatabase();
  data.users = [...kept, ...demoUsers.filter((u) => !kept.some((k) => k.email === u.email))];
  data.professors = structuredClone(MOCK_PROFESSORS);
  data.assessments = structuredClone(MOCK_ASSESSMENTS);
  data.questions = structuredClone(MOCK_QUESTIONS);
  data.invitations = structuredClone(MOCK_INVITATIONS);
  data.submissions = structuredClone(MOCK_SUBMISSIONS).map((s) => {
    const student = data.users.find((u) => u.email === s.applicantEmail.toLowerCase() && u.role === 'applicant');
    return student ? { ...s, studentId: student.id } : s;
  });
  data.sessions = db.data.sessions.filter((s) => keptIds.has(s.userId));
  db.replaceAll(data);
}
