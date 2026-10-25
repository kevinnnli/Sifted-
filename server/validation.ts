import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const forbidden = (message = 'You do not have access to this resource') => new HttpError(403, message);
export const conflict = (message: string) => new HttpError(409, message);

// Express 4 doesn't forward rejected promises to the error handler on its own
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function requireString(value: unknown, field: string, { max = 200, min = 1 } = {}): string {
  if (typeof value !== 'string') throw badRequest(`${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw badRequest(min <= 1 ? `${field} is required` : `${field} must be at least ${min} characters`);
  if (trimmed.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return trimmed;
}

export function optionalString(value: unknown, field: string, max = 200): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw badRequest(`${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return trimmed || undefined;
}

// Long free text (prompts, answers, code) keeps its whitespace
export function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw badRequest(`${field} must be text`);
  if (value.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return value;
}

export function requireEmail(value: unknown, field = 'Email'): string {
  const email = requireString(value, field, { max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw badRequest(`${field} must be a valid email address`);
  return email;
}

export function requireEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw badRequest(`${field} must be true or false`);
  return value;
}

export function requireNumber(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${field} must be a number between ${min} and ${max}`);
  return n;
}

export function optionalDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || isNaN(Date.parse(value))) {
    throw badRequest(`${field} must be a date (YYYY-MM-DD)`);
  }
  return value;
}

// Only http(s) links may be stored: a "javascript:" meeting link would run code when a student clicks it
export function optionalHttpUrl(value: unknown, field: string): string | undefined {
  const raw = optionalString(value, field, 2000);
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest(`${field} must be a full link starting with https://`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw badRequest(`${field} must start with https://`);
  return url.toString();
}

export function requireStringArray(value: unknown, field: string, { maxItems = 100, maxLength = 500 } = {}): string[] {
  if (!Array.isArray(value)) throw badRequest(`${field} must be a list`);
  if (value.length > maxItems) throw badRequest(`${field} can have at most ${maxItems} items`);
  return value.map((item, i) => {
    if (typeof item !== 'string') throw badRequest(`${field}[${i}] must be text`);
    if (item.length > maxLength) throw badRequest(`${field}[${i}] is too long`);
    return item;
  });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
