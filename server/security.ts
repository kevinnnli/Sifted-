import crypto from 'crypto';
import { promisify } from 'util';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Database } from './db';
import type { StoredUser } from './types';
import type { UserAccount, UserRole } from '../src/types';
import { HttpError } from './validation';

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number, options: crypto.ScryptOptions) => Promise<Buffer>;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;
export const SESSION_COOKIE = 'sifted_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;

// ---- Passwords -------------------------------------------------------------

export function validatePasswordStrength(password: unknown): string {
  if (typeof password !== 'string') throw new HttpError(400, 'Password is required');
  if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (password.length > 200) throw new HttpError(400, 'Password must be at most 200 characters');
  if (/^(.)\1+$/.test(password)) throw new HttpError(400, 'Password is too easy to guess');
  return password;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_PARAMS.maxmem,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// Used to spend the same time on unknown emails as on wrong passwords
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ||= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}

// ---- Sessions --------------------------------------------------------------

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(db: Database, userId: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.data.sessions = db.data.sessions.filter((s) => Date.parse(s.expiresAt) > now);
  db.data.sessions.push({
    tokenHash: hashToken(token),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
  db.save();
  return token;
}

export function destroySession(db: Database, token: string | undefined) {
  if (!token) return;
  const tokenHash = hashToken(token);
  db.data.sessions = db.data.sessions.filter((s) => s.tokenHash !== tokenHash);
  db.save();
}

export function destroyUserSessions(db: Database, userId: string, exceptToken?: string) {
  const keep = exceptToken ? hashToken(exceptToken) : null;
  db.data.sessions = db.data.sessions.filter((s) => s.userId !== userId || s.tokenHash === keep);
  db.save();
}

export function readCookie(req: Request, cookieName: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === cookieName) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function readSessionToken(req: Request): string | undefined {
  return readCookie(req, SESSION_COOKIE);
}

/** The signed-in, enabled account a session token belongs to, if the session is still valid. */
export function userForToken(db: Database, token: string | undefined): StoredUser | undefined {
  if (!token) return undefined;
  const tokenHash = hashToken(token);
  const session = db.data.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return undefined;
  const user = db.findUser(session.userId);
  return user && !user.disabled ? user : undefined;
}

function cookieAttributes(req: Request) {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase() === 'none' ? 'None' : 'Lax';
  // SameSite=None requires Secure; browsers treat localhost as a secure context
  const secure = req.secure || process.env.NODE_ENV === 'production' || sameSite === 'None';
  return `Path=/; HttpOnly; SameSite=${sameSite}${secure ? '; Secure' : ''}`;
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_MS / 1000}; ${cookieAttributes(req)}`);
}

export function clearSessionCookie(req: Request, res: Response) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Max-Age=0; ${cookieAttributes(req)}`);
}

/**
 * While the administrator is inside a test account, their own session token waits in this cookie
 * so they can switch back without signing in again. It is only honoured for an admin session.
 */
export const ADMIN_RETURN_COOKIE = 'sifted_admin_return';

export function setAdminReturnCookie(req: Request, res: Response, token: string) {
  res.append('Set-Cookie', `${ADMIN_RETURN_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_MS / 1000}; ${cookieAttributes(req)}`);
}

export function clearAdminReturnCookie(req: Request, res: Response) {
  res.append('Set-Cookie', `${ADMIN_RETURN_COOKIE}=; Max-Age=0; ${cookieAttributes(req)}`);
}

/** The administrator waiting in the return cookie, if there is one and their session is still valid. */
export function adminWaitingToReturn(db: Database, req: Request): StoredUser | undefined {
  const admin = userForToken(db, readCookie(req, ADMIN_RETURN_COOKIE));
  return admin?.role === 'admin' ? admin : undefined;
}

export function toPublicUser(user: StoredUser): UserAccount {
  const { passwordHash, testPassword, ...rest } = user;
  return { ...rest, hasPassword: Boolean(passwordHash) };
}

// ---- Middleware ------------------------------------------------------------

export function authenticate(db: Database): RequestHandler {
  return (req, _res, next) => {
    const user = userForToken(db, readSessionToken(req));
    if (user) req.user = user;
    next();
  };
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please sign in'));
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this area'));
    // Accounts with a temporary password must set their own before doing anything else
    if (req.user.mustChangePassword) return next(new HttpError(403, 'Please set a new password first'));
    next();
  };
}

/**
 * Cross-site request forgery guard for state-changing API calls: browsers won't send the custom
 * header on a cross-site form post without a CORS preflight (which this server never approves),
 * and when an Origin header is present it must match this host.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.get('x-sifted-request') !== '1') return next(new HttpError(403, 'Request blocked'));
  const origin = req.get('origin');
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return next(new HttpError(403, 'Request blocked'));
    }
    const host = req.get('x-forwarded-host') || req.get('host');
    if (originHost !== host) return next(new HttpError(403, 'Request blocked'));
  }
  next();
};

export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.ALLOW_EMBEDDING !== 'true') res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  };
}

export function noStore(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}

/**
 * Simple fixed-window limiter for sign-in and sign-up. Keys combine the client IP with the email
 * so one attacker can't lock out a user from elsewhere, plus a looser per-IP limit.
 */
export class AttemptLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  check(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (entry && entry.resetAt > now && entry.count >= this.limit) {
      const minutes = Math.ceil((entry.resetAt - now) / 60000);
      throw new HttpError(429, `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }
  }

  record(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count++;
    }
    if (this.hits.size > 10000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
  }

  reset(key: string) {
    this.hits.delete(key);
  }
}

export function errorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
      return;
    }
    if ((err as any)?.type === 'entity.too.large') {
      res.status(413).json({ success: false, error: 'Request is too large' });
      return;
    }
    if ((err as any)?.type === 'entity.parse.failed') {
      res.status(400).json({ success: false, error: 'Malformed request' });
      return;
    }
    console.error('Unhandled server error:', err);
    res.status(500).json({ success: false, error: 'Something went wrong on the server' });
  };
}
