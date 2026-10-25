import crypto from 'crypto';
import { Router } from 'express';
import type { Database } from '../db';
import type { StoredUser } from '../types';
import {
  AttemptLimiter,
  burnPasswordCheck,
  clearSessionCookie,
  createSession,
  destroySession,
  destroyUserSessions,
  hashPassword,
  readSessionToken,
  requireUser,
  setSessionCookie,
  toPublicUser,
  validatePasswordStrength,
  verifyPassword,
} from '../security';
import { asyncHandler, badRequest, conflict, HttpError, requireEmail, requireString } from '../validation';
import { studentVerificationRequired } from '../views';

const FREE_EMAIL_PROVIDERS = ['@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com', '@aol.com', '@icloud.com', '@protonmail.com', '@mail.com'];
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

export function authRoutes(db: Database) {
  const router = Router();
  const loginLimiter = new AttemptLimiter(5, 15 * 60 * 1000); // per IP + email
  const ipLimiter = new AttemptLimiter(30, 15 * 60 * 1000); // per IP
  const registerLimiter = new AttemptLimiter(10, 60 * 60 * 1000);

  const professorFor = (user: StoredUser) =>
    user.role === 'professor' ? db.data.professors.find((p) => p.id === user.professorId) : undefined;

  router.get('/me', (req, res) => {
    if (!req.user) return res.json({ success: true, user: null });
    res.json({ success: true, user: toPublicUser(req.user), professor: professorFor(req.user) });
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
      user.lastLoginAt = new Date().toISOString();
      // A fresh token on every sign-in (no session fixation)
      destroySession(db, readSessionToken(req));
      const token = createSession(db, user.id);
      setSessionCookie(req, res, token);
      res.json({ success: true, user: toPublicUser(user), professor: professorFor(user) });
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
      const secondaryEmail = requireEmail(body.secondaryEmail, 'Personal email');
      const university = requireString(body.university, 'University', { max: 200 });
      const degreeProgram = requireString(body.degreeProgram, 'Degree program', { max: 200 });
      const password = validatePasswordStrength(body.password);
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
        avatar: DEFAULT_AVATAR,
        isVerified: !studentVerificationRequired(),
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      // Re-check after the async hash in case of a concurrent registration
      if (db.findUserByEmail(email)) throw conflict('An account with this email already exists. Please sign in instead.');
      db.data.users.push(user);
      db.save();
      const token = createSession(db, user.id);
      setSessionCookie(req, res, token);
      res.status(201).json({ success: true, user: toPublicUser(user) });
    })
  );

  router.post('/logout', (req, res) => {
    destroySession(db, readSessionToken(req));
    clearSessionCookie(req, res);
    res.json({ success: true });
  });

  router.post(
    '/change-password',
    requireUser,
    asyncHandler(async (req, res) => {
      const user = req.user!;
      if (user.managedByEnv) {
        throw badRequest('This administrator password is set by ADMIN_PASSWORD in the server configuration');
      }
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = validatePasswordStrength(req.body?.newPassword);
      if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new HttpError(400, 'Current password is incorrect');
      if (currentPassword === newPassword) throw badRequest('Choose a password different from your current one');
      user.passwordHash = await hashPassword(newPassword);
      user.mustChangePassword = false;
      // Sign out every other device
      destroyUserSessions(db, user.id, readSessionToken(req));
      db.save();
      res.json({ success: true, user: toPublicUser(user) });
    })
  );

  return router;
}
