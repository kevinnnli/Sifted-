import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import { createApp } from './app';
import { ensureEnvAdmin, isDemoMode, seedDemoData } from './bootstrap';
import { Database } from './db';
import { ensureTestAccounts } from './testAccounts';
import { errorHandler, pruneExpiredSessions } from './security';
import { sweepExpiredAttempts } from './services/attempts';

// .env.local (documented in the README) takes precedence over .env
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DATABASE_FILE || path.join(process.cwd(), 'database.json');

async function startServer() {
  const db = new Database(DB_FILE);

  if (isDemoMode() && db.isNew) {
    await seedDemoData(db);
    console.log('Seeded the sample data (SEED_DEMO_DATA=true). Sample accounts use DEMO_PASSWORD.');
  }
  const adminWarning = await ensureEnvAdmin(db);
  process.on('SIGTERM', () => db.flush().finally(() => process.exit(0)));
  if (adminWarning) console.warn(`⚠️  ${adminWarning}`);
  if (await ensureTestAccounts(db)) console.log('Created the sandbox test accounts (see the admin portal).');
  await db.flush();

  const app = createApp(db);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Hashed build files never change, so browsers may keep them; the page itself is always revalidated
    app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y', index: false }));
    app.use(express.static(distPath, { index: false }));
    // Express 4 wildcard: every non-API path serves the single-page app
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  app.use(errorHandler());

  // Submit tests whose time ran out while the student was away
  setInterval(() => {
    sweepExpiredAttempts(db)
      .then(() => pruneExpiredSessions(db))
      .then(() => db.flush())
      .catch((e) => console.error('Background maintenance failed:', e instanceof Error ? e.message : e));
  }, 30_000).unref();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sifted server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error('Failed to start Sifted:', e);
  process.exit(1);
});
