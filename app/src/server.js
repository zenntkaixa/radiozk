import express from 'express';
import { pool, migrate } from './db.js';
import ratings from './routes/ratings.js';

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const { rows } = await pool.query('select now() as db_time');
  res.json({ ok: true, ...rows[0] });
});
app.use('/api/ratings', ratings);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

await migrate();
const port = process.env.APP_PORT ?? 3000;
app.listen(port, '127.0.0.1', () => console.log(`app listening on http://127.0.0.1:${port}`));
