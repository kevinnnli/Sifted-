// HTTP security headers, shared by the Express server (server/security.ts) and the Vercel build
// (scripts/build-vercel.mjs) so both deployments send exactly the same policy.

/**
 * @param {{ production: boolean, allowEmbedding: boolean }} options
 * @returns {Record<string, string>}
 */
export function securityHeaderList({ production, allowEmbedding }) {
  /** @type {Record<string, string>} */
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
  if (!allowEmbedding) headers['X-Frame-Options'] = 'SAMEORIGIN';

  // The development server (Vite) injects inline scripts for hot reloading, so the strict policy
  // applies to production builds only
  if (production) {
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self'",
      // React and the chart library set element styles at runtime
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(allowEmbedding ? [] : ["frame-ancestors 'self'"]),
    ].join('; ');
    // Browsers only honour this over HTTPS. Subdomains are left out on purpose: they may be
    // other sites on the operator's domain.
    headers['Strict-Transport-Security'] = 'max-age=31536000';
  }
  return headers;
}
