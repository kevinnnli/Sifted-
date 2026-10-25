// Packages Sifted for Vercel using the Build Output API (https://vercel.com/docs/build-output-api):
// the Vite site becomes static files and the Express API becomes one Node.js function.
// Run after `vite build` (see the build:vercel script and vercel.json).
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const out = path.join(root, '.vercel', 'output');
const dist = path.join(root, 'dist');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html is missing: run `vite build` first.');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });

// Static site
fs.cpSync(dist, path.join(out, 'static'), {
  recursive: true,
  filter: (src) => !path.basename(src).startsWith('server.cjs'),
});

// API function: everything bundled into one file, so it needs no node_modules at runtime
const func = path.join(out, 'functions', 'api.func');
await build({
  entryPoints: [path.join(root, 'server', 'vercel.ts')],
  outfile: path.join(func, 'index.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  // Only used by the local dev server
  external: ['vite'],
  // Vercel's launcher calls the module's export; make it the handler itself
  footer: { js: 'module.exports = Object.assign(module.exports.default, { default: module.exports.default });' },
  logLevel: 'warning',
});
fs.writeFileSync(
  path.join(func, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.cjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 60 }, null, 2)
);

// Routing: security headers everywhere, /api/* to the function, files as-is, anything else to the app
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  ...(process.env.ALLOW_EMBEDDING === 'true' ? {} : { 'X-Frame-Options': 'SAMEORIGIN' }),
};
fs.writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/(.*)', headers, continue: true },
        { src: '^/api(?:/(.*))?$', dest: '/api?__sifted_path=$1' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2
  )
);

console.log('Vercel output written to .vercel/output');
