import express from 'express';
import { pool, migrate } from './db.js';
import ratings from './routes/ratings.js';
import { trustProxySetting } from './rateLimit.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', trustProxySetting()); // req.ip comes from X-Forwarded-For only when nginx (a trusted peer) sent it
app.use(express.json());

app.get('/api/health', async (_req, res) => {
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

await migrate();
const port = process.env.APP_PORT ?? 3000;
const host = process.env.HOST ?? '127.0.0.1'; // containers set HOST=0.0.0.0
app.listen(port, host, () => console.log(`app listening on http://${host}:${port}`));
