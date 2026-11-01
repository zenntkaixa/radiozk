import express from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';
import ratings from './routes/ratings.js';
import { trustProxySetting } from './rateLimit.js';

// The Express app without a listener, shared by the server (server.js) and the Vercel Function (api/index.mjs).
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', trustProxySetting()); // req.ip comes from X-Forwarded-For only when nginx (a trusted peer) sent it
app.use(express.json());

const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/health', healthLimiter, async (_req, res) => {
  const { rows } = await pool.query('select now() as db_time');
  res.json({ ok: true, ...rows[0] });
});
app.use('/api/ratings', ratings);

// Client errors raised by middleware (malformed JSON, body too large) keep their 4xx status; anything else is a
// generic 500 so internals never reach the client.
app.use((err, _req, res, _next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 413 ? 'payload too large' : status === 500 ? 'internal error' : 'bad request' });
});

export default app;
