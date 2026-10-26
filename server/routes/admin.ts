import crypto from 'crypto';
import { Router } from 'express';
import type { ProfessorProfile } from '../../src/types';
import { seedDemoData, isDemoMode } from '../bootstrap';
import type { Database } from '../db';
import {
  createSession,
  destroyUserSessions,
  hashPassword,
  readSessionToken,
  requireRole,
  setAdminReturnCookie,
  setSessionCookie,
  toPublicUser,
  validatePasswordStrength,
} from '../security';
import { isAiConfigured } from '../services/ai';
import { storageInfo } from '../storage';
import { eraseStudent } from '../services/accounts';
import { ensureTestAccounts, isSandboxEmail, removeTestAccounts, resetTestAccounts, testAccountNote, testAccountsEnabled } from '../testAccounts';
import type { StoredUser } from '../types';
import { asyncHandler, badRequest, conflict, forbidden, notFound, requireBoolean, requireEmail, requireString } from '../validation';
import { studentVerificationRequired } from '../views';


export function adminRoutes(db: Database) {
  const router = Router();
  router.use(requireRole('admin'));

  const findAccount = (id: string) => {
    const account = db.findUser(id);
    if (!account) throw notFound('Account not found');
    return account;
  };
  // Accounts that can never be disabled, deleted or have their password changed from the UI
  const assertManageable = (adminId: string, account: StoredUser) => {
    if (account.id === adminId) throw badRequest('You cannot change your own administrator account here');
    if (account.managedByEnv) throw badRequest('This administrator is managed through ADMIN_EMAIL / ADMIN_PASSWORD');
  };

  router.get('/overview', (_req, res) => {
    const users = db.data.users;
    res.json({
      success: true,
      accounts: users.map(toPublicUser),
      stats: {
        professors: users.filter((u) => u.role === 'professor').length,
        students: users.filter((u) => u.role === 'applicant').length,
        admins: users.filter((u) => u.role === 'admin').length,
        assessments: db.data.assessments.length,
        submissions: db.data.submissions.length,
        invitations: db.data.invitations.length,
      },
      demoMode: isDemoMode(),
      aiConfigured: isAiConfigured(),
      studentVerificationRequired: studentVerificationRequired(),
      storage: storageInfo.mode,
      testAccountsEnabled: testAccountsEnabled(db),
      // Sandbox accounts with their passwords: visible here only
      testAccounts: users
        .filter((u) => u.isTestAccount)
        .map((u) => ({ ...toPublicUser(u), testPassword: u.testPassword, testNote: testAccountNote(u.email) })),
    });
  });

  // Everything linked to one account
  router.get('/accounts/:id', (req, res) => {
    const account = findAccount(req.params.id);
    const professor = account.role === 'professor' ? db.data.professors.find((p) => p.id === account.professorId) : undefined;
    const owned = professor ? db.data.assessments.filter((a) => a.professorId === professor.id) : [];
    const ownedIds = new Set(owned.map((a) => a.id));
    const invitations = professor
      ? db.data.invitations.filter((i) => i.professorId === professor.id)
      : db.data.invitations.filter((i) => i.applicantEmail.toLowerCase() === account.email);
    const submissions = professor
      ? db.data.submissions.filter((s) => ownedIds.has(s.assessmentId))
      : db.data.submissions.filter((s) => (s.studentId ? s.studentId === account.id : s.applicantEmail.toLowerCase() === account.email));
    // For a student: the assessments their invitations and submissions refer to
    const referencedIds = new Set([...invitations, ...submissions].map((x) => x.assessmentId));
    const assessments = professor ? owned : db.data.assessments.filter((a) => referencedIds.has(a.id));
    res.json({ success: true, account: toPublicUser(account), professor, assessments, invitations, submissions });
  });

  router.post(
    '/professors',
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const name = requireString(body.name, 'Name', { max: 100 });
      const email = requireEmail(body.email);
      const department = requireString(body.department, 'Department', { max: 200 });
      const labName = requireString(body.labName, 'Lab name', { max: 200 });
      // No profile photos: external image URLs would let third parties track who views them
      const avatar = '';
      const password = validatePasswordStrength(body.temporaryPassword, { email });
      if (isSandboxEmail(email)) throw badRequest('This email domain is reserved for test accounts');
      if (db.findUserByEmail(email)) throw conflict('An account with this email already exists');

      const professor: ProfessorProfile = {
        id: crypto.randomUUID(),
        name,
        email,
        department,
        labName,
        avatar,
        aiSensitivity: 'medium',
        allowLateSubmissions: false,
      };
      const account: StoredUser = {
        id: crypto.randomUUID(),
        name,
        email,
        role: 'professor',
        professorId: professor.id,
        avatar,
        department,
        labName,
        isVerified: true,
        // The professor must replace the temporary password on first sign-in
        mustChangePassword: true,
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      if (db.findUserByEmail(email)) throw conflict('An account with this email already exists');
      db.data.professors.push(professor);
      db.data.users.push(account);
      db.save();
      res.status(201).json({ success: true, account: toPublicUser(account) });
    })
  );

  router.post(
    '/accounts/:id/password',
    asyncHandler(async (req, res) => {
      const account = findAccount(req.params.id);
      assertManageable(req.user!.id, account);
      const password = validatePasswordStrength(req.body?.newPassword, { email: account.email });
      account.passwordHash = await hashPassword(password);
      // Test accounts keep a known password; real users must choose their own
      if (account.isTestAccount) account.testPassword = password;
      else account.mustChangePassword = true;
      destroyUserSessions(db, account.id);
      db.save();
      res.json({ success: true, account: toPublicUser(account) });
    })
  );

  router.patch('/accounts/:id', (req, res) => {
    const account = findAccount(req.params.id);
    const body = req.body || {};
    if (body.disabled !== undefined) {
      assertManageable(req.user!.id, account);
      account.disabled = requireBoolean(body.disabled, 'Disabled');
      if (account.disabled) destroyUserSessions(db, account.id);
    }
    if (body.isVerified !== undefined) account.isVerified = requireBoolean(body.isVerified, 'Verified');
    db.save();
    res.json({ success: true, account: toPublicUser(account) });
  });

  router.delete('/accounts/:id', (req, res) => {
    const account = findAccount(req.params.id);
    assertManageable(req.user!.id, account);
    if (account.role === 'professor' && db.data.assessments.some((a) => a.professorId === account.professorId)) {
      throw badRequest('This professor owns assessments. Disable the account instead so their records stay intact.');
    }
    // A student's deletion removes all of their personal data, not just the login
    if (account.role === 'applicant') {
      const removed = eraseStudent(db, account);
      return res.json({ success: true, removed });
    }
    destroyUserSessions(db, account.id);
    db.data.users = db.data.users.filter((u) => u.id !== account.id);
    if (account.role === 'professor') db.data.professors = db.data.professors.filter((p) => p.id !== account.professorId);
    db.save();
    res.json({ success: true });
  });

  // Open a test account in this browser; the admin session waits in a cookie to switch back to
  router.post('/accounts/:id/sign-in-as', (req, res) => {
    const account = findAccount(req.params.id);
    if (!account.isTestAccount) throw forbidden('Only test accounts can be opened from the admin portal');
    if (account.disabled) throw badRequest('This test account is disabled. Enable it first.');
    const adminToken = readSessionToken(req)!;
    account.lastLoginAt = new Date().toISOString();
    const token = createSession(db, req, account.id);
    setSessionCookie(req, res, token);
    setAdminReturnCookie(req, res, adminToken);
    res.json({ success: true, user: toPublicUser(account) });
  });

  router.post(
    '/test-accounts/reset',
    asyncHandler(async (_req, res) => {
      await resetTestAccounts(db);
      res.json({ success: true });
    })
  );

  router.delete('/test-accounts', (_req, res) => {
    removeTestAccounts(db);
    db.data.settings.testAccounts = 'off';
    db.save();
    res.json({ success: true });
  });

  router.post(
    '/reset-demo',
    asyncHandler(async (req, res) => {
      if (!isDemoMode()) throw notFound();
      await seedDemoData(db, { keepUserId: req.user!.id });
      await ensureTestAccounts(db);
      res.json({ success: true });
    })
  );

  return router;
}
