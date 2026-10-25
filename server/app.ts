import express from 'express';
import type { Database } from './db';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { professorRoutes } from './routes/professor';
import { studentRoutes } from './routes/student';
import { authenticate, csrfGuard, errorHandler, noStore, securityHeaders } from './security';
import { isAiConfigured } from './services/ai';
import { notFound } from './validation';

/** Builds the Express app with the API routes. Static/Vite serving is added by the entry point. */
export function createApp(db: Database) {
  const app = express();
  app.disable('x-powered-by');
  // Behind Cloud Run / a reverse proxy: trust the first hop for req.secure and req.ip
  if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

  app.use(securityHeaders());
  app.use('/api', noStore(), express.json({ limit: '1mb' }), csrfGuard, authenticate(db));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), aiConfigured: isAiConfigured() });
  });
  app.use('/api/auth', authRoutes(db));
  app.use('/api/admin', adminRoutes(db));
  app.use('/api/professor', professorRoutes(db));
  app.use('/api/student', studentRoutes(db));
  app.use('/api', (_req, _res, next) => next(notFound('Unknown API route')));
  app.use(errorHandler());
  return app;
}
