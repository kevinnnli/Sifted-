import express from 'express';
import type { Database } from './db';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { professorRoutes } from './routes/professor';
import { studentRoutes } from './routes/student';
import { authenticate, csrfGuard, errorHandler, noStore, securityHeaders } from './security';
import { isAiConfigured } from './services/ai';
import { notFound } from './validation';

/**
 * Who runs this deployment, for the privacy policy and terms. Set by the operator; never guessed.
 * Missing values are reported as null so the pages can say the details haven't been provided.
 */
export function siteInfo() {
  const contact = process.env.SITE_CONTACT_EMAIL?.trim();
  return {
    operator: process.env.SITE_OPERATOR?.trim().slice(0, 200) || null,
    contactEmail: contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : null,
  };
}

/** Builds the Express app with the API routes. Static/Vite serving is added by the entry point. */
/**
 * Holds each API response until the changes it made are written to disk, so a success reply
 * always means the data is saved. Requests during which nothing changed answer immediately.
 * (The Vercel entry point does the same for its remote store.)
 */
function persistBeforeResponding(db: Database): express.RequestHandler {
  return (_req, res, next) => {
    if (!db.writesToFile) return next();
    const generation = db.generation;
    const end = res.end.bind(res) as (...args: unknown[]) => express.Response;
    res.end = ((...args: unknown[]) => {
      if (db.generation === generation) return end(...args);
      db.flush().then(
        () => end(...args),
        (e) => {
          console.error('Failed to save changes:', e instanceof Error ? e.message : e);
          if (res.headersSent) return end(...args);
          res.statusCode = 500;
          res.removeHeader('Set-Cookie');
          res.removeHeader('Content-Length');
          res.setHeader('Content-Type', 'application/json');
          end(JSON.stringify({ success: false, error: 'Your change could not be saved. Please try again.' }));
        }
      );
      return res;
    }) as typeof res.end;
    next();
  };
}

export function createApp(db: Database) {
  const app = express();
  app.disable('x-powered-by');
  // Behind Cloud Run / a reverse proxy: trust the first hop for req.secure and req.ip
  if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

  app.use(securityHeaders());
  app.use('/api', noStore(), persistBeforeResponding(db), express.json({ limit: '1mb' }), csrfGuard, authenticate(db));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), aiConfigured: isAiConfigured(), site: siteInfo() });
  });
  app.use('/api/auth', authRoutes(db));
  app.use('/api/admin', adminRoutes(db));
  app.use('/api/professor', professorRoutes(db));
  app.use('/api/student', studentRoutes(db));
  app.use('/api', (_req, _res, next) => next(notFound('Unknown API route')));
  app.use(errorHandler());
  return app;
}
