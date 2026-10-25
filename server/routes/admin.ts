import crypto from 'crypto';
import { Router } from 'express';
import type { ProfessorProfile } from '../../src/types';
import { seedDemoData, isDemoMode } from '../bootstrap';
import type { Database } from '../db';
import { destroyUserSessions, hashPassword, requireRole, toPublicUser, validatePasswordStrength } from '../security';
import { isAiConfigured } from '../services/ai';
import type { StoredUser } from '../types';
import { asyncHandler, badRequest, conflict, notFound, optionalHttpUrl, requireBoolean, requireEmail, requireString } from '../validation';
import { studentVerificationRequired } from '../views';

const DEFAULT_PROFESSOR_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';

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
      const avatar = optionalHttpUrl(body.avatar, 'Avatar URL') || DEFAULT_PROFESSOR_AVATAR;
      const password = validatePasswordStrength(body.temporaryPassword);
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
      const password = validatePasswordStrength(req.body?.newPassword);
      account.passwordHash = await hashPassword(password);
      account.mustChangePassword = true;
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
    destroyUserSessions(db, account.id);
    db.data.users = db.data.users.filter((u) => u.id !== account.id);
    db.data.attempts = db.data.attempts.filter((a) => a.studentId !== account.id);
    if (account.role === 'professor') db.data.professors = db.data.professors.filter((p) => p.id !== account.professorId);
    db.save();
    res.json({ success: true });
  });

  router.post(
    '/reset-demo',
    asyncHandler(async (req, res) => {
      if (!isDemoMode()) throw notFound();
      await seedDemoData(db, { keepUserId: req.user!.id });
      res.json({ success: true });
    })
  );

  return router;
}
