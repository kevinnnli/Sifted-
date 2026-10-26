import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import type { Database } from '../db';
import type { StoredUser } from '../types';
import {
  adminWaitingToReturn,
  AttemptLimiter,
  clearAdminReturnCookie,
  burnPasswordCheck,
  clearSessionCookie,
  createSession,
  destroySession,
  destroyUserSessions,
  hashPassword,
  readAdminReturnToken,
  readSessionToken,
  requireUser,
  setSessionCookie,
  toPublicUser,
  validatePasswordStrength,
  verifyPassword,
} from '../security';
import { asyncHandler, badRequest, conflict, HttpError, optionalEmail, requireEmail, requireString } from '../validation';
import { isSandboxEmail } from '../testAccounts';
import { studentVerificationRequired } from '../views';

const FREE_EMAIL_PROVIDERS = ['@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com', '@aol.com', '@icloud.com', '@protonmail.com', '@mail.com'];

export function authRoutes(db: Database) {
  const router = Router();
  // Failed sign-ins: 5 per account per address, and a looser per-address cap. Whole classes often
  // share one campus IP address, so the per-address limits leave room for a lecture hall.
  const loginLimiter = new AttemptLimiter(5, 15 * 60 * 1000); // per IP + email
  const ipLimiter = new AttemptLimiter(100, 15 * 60 * 1000); // per IP
  const registerLimiter = new AttemptLimiter(60, 60 * 60 * 1000); // per IP
  const passwordLimiter = new AttemptLimiter(5, 15 * 60 * 1000); // wrong current password, per account

  const professorFor = (user: StoredUser) =>
    user.role === 'professor' ? db.data.professors.find((p) => p.id === user.professorId) : undefined;

  /**
   * Replaces whatever sessions this browser had (its own, and an administrator session parked in
   * the return cookie) with a fresh one for `userId`: a new token on every sign-in, so a token known
   * before signing in is worthless afterwards (no session fixation). Runs inside db.commit(), so
   * on serverless hosting it is retried rather than lost if another instance saves at the same time.
   */
  const startFreshSession = async (req: Request, res: Response, userId: string, change?: () => void) => {
    const previous = readSessionToken(req);
    const parked = readAdminReturnToken(req);
    const token = await db.commit(() => {
      change?.();
      const user = db.findUser(userId);
      if (!user || user.disabled) throw new HttpError(401, 'Incorrect email or password');
      destroySession(db, previous);
      destroySession(db, parked);
      return createSession(db, req, user.id);
    });
    if (parked !== undefined) clearAdminReturnCookie(req, res);
    setSessionCookie(req, res, token);
    return db.findUser(userId)!;
  };

  router.get('/me', (req, res) => {
    if (!req.user) return res.json({ success: true, user: null });
    res.json({
      success: true,
      user: toPublicUser(req.user),
      professor: professorFor(req.user),
      // The administrator opened this test account and can switch back
      testSession: Boolean(req.user.isTestAccount && adminWaitingToReturn(db, req)),
    });
  });

  router.post('/return-to-admin', (req, res) => {
    const admin = adminWaitingToReturn(db, req);
    if (!admin) {
      clearAdminReturnCookie(req, res);
      throw new HttpError(401, 'Your administrator session has ended. Please sign in again.');
    }
    if (req.user?.isTestAccount) destroySession(db, readSessionToken(req));
    setSessionCookie(req, res, readAdminReturnToken(req)!);
    clearAdminReturnCookie(req, res);
    res.json({ success: true, user: toPublicUser(admin) });
  });

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const email = requireEmail(req.body?.email);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const ipKey = `ip:${req.ip}`;
      const key = `${req.ip}|${email}`;
      ipLimiter.check(ipKey);
      loginLimiter.check(key);

      const user = db.findUserByEmail(email);
      // Same error and similar timing whether the email exists or not
      const valid = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
      if (!user || !valid) {
        loginLimiter.record(key);
        ipLimiter.record(ipKey);
        throw new HttpError(401, 'Incorrect email or password');
      }
      if (user.disabled) throw new HttpError(403, 'This account has been disabled. Please contact your administrator.');

      loginLimiter.reset(key);
      const signedIn = await startFreshSession(req, res, user.id, () => {
        const current = db.findUser(user.id);
        if (current) current.lastLoginAt = new Date().toISOString();
      });
      res.json({ success: true, user: toPublicUser(signedIn), professor: professorFor(signedIn) });
    })
  );

  // Self-registration is for students only; professor and admin accounts can't be created here
  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const ipKey = `register:${req.ip}`;
      registerLimiter.check(ipKey);
      const body = req.body || {};
      const name = requireString(body.name, 'Full name', { max: 100 });
      const email = requireEmail(body.email, 'University email');
      // Optional: only shown to the professors a student takes tests for, as an alternative contact
      const secondaryEmail = optionalEmail(body.secondaryEmail, 'Personal email');
      const university = requireString(body.university, 'University', { max: 200 });
      const degreeProgram = requireString(body.degreeProgram, 'Degree program', { max: 200 });
      const password = validatePasswordStrength(body.password, { email });
      if (isSandboxEmail(email)) throw badRequest('This email domain is reserved for test accounts');
      if (email === secondaryEmail) throw badRequest('University email and personal email must be different addresses');
      if (FREE_EMAIL_PROVIDERS.some((p) => email.endsWith(p))) {
        throw badRequest('Your primary email must be an institutional or academic address (e.g. ending in .edu), not a free webmail address');
      }
      registerLimiter.record(ipKey);
      if (db.findUserByEmail(email)) throw conflict('An account with this email already exists. Please sign in instead.');

      const user: StoredUser = {
        id: crypto.randomUUID(),
        name,
        email,
        secondaryEmail,
        university,
        degreeProgram,
        role: 'applicant',
        isVerified: !studentVerificationRequired(),
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      const created = await startFreshSession(req, res, user.id, () => {
        // Checked again here: another registration may have finished while the password was hashed
        if (db.findUserByEmail(email)) throw conflict('An account with this email already exists. Please sign in instead.');
        db.data.users.push(user);
      });
      res.status(201).json({ success: true, user: toPublicUser(created) });
    })
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const token = readSessionToken(req);
      const parked = readAdminReturnToken(req);
      await db.commit(() => {
        destroySession(db, token);
        destroySession(db, parked);
      });
      clearSessionCookie(req, res);
      if (parked !== undefined) clearAdminReturnCookie(req, res);
      res.json({ success: true });
    })
  );

  router.post(
    '/change-password',
    requireUser,
    asyncHandler(async (req, res) => {
      const user = req.user!;
      if (user.managedByEnv) {
        throw badRequest('This administrator password is set by ADMIN_PASSWORD in the server configuration');
      }
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = validatePasswordStrength(req.body?.newPassword, { email: user.email });
      passwordLimiter.check(user.id);
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        passwordLimiter.record(user.id);
        throw new HttpError(400, 'Current password is incorrect');
      }
      passwordLimiter.reset(user.id);
      if (currentPassword === newPassword) throw badRequest('Choose a password different from your current one');
      user.passwordHash = await hashPassword(newPassword);
      user.mustChangePassword = false;
      if (user.isTestAccount) user.testPassword = newPassword;
      // Sign out every other device
      destroyUserSessions(db, user.id, readSessionToken(req));
      db.save();
      res.json({ success: true, user: toPublicUser(user) });
    })
  );

  return router;
}
