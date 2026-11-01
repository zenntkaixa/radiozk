import app from '../app/src/app.js';
import { migrateOnce } from '../app/src/db.js';

// Vercel Function entry (vercel.json rewrites /api/* here): the same Express app as app/src/server.js, minus the listener.
// Required environment: DATABASE_URL (pooled connection string); TRUST_PROXY=1 so req.ip is the visitor taken from
// Vercel's X-Forwarded-For (the default only trusts loopback and private peers, which would put every visitor in one
// rate-limit bucket).
if (!process.env.TRUST_PROXY) console.warn('TRUST_PROXY is not set: behind Vercel all visitors would share one rate-limit bucket. Set TRUST_PROXY=1.');

export default async function handler(req, res) {
  try {
    await migrateOnce();
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end('{"error":"internal error"}');
  }
  return app(req, res);
}
