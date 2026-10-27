import express from 'express';
import { pool, migrate } from './db.js';

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const { rows } = await pool.query('select now() as db_time');
  res.json({ ok: true, ...rows[0] });
});

app.get('/api/notes', async (_req, res) => {
  const { rows } = await pool.query('select * from notes order by id desc limit 50');
  res.json(rows);
});

app.post('/api/notes', async (req, res) => {
  const body = String(req.body?.body ?? '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });
  const { rows } = await pool.query('insert into notes (body) values ($1) returning *', [body]);
  res.status(201).json(rows[0]);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

await migrate();
const port = process.env.APP_PORT ?? 3000;
app.listen(port, '127.0.0.1', () => console.log(`app listening on http://127.0.0.1:${port}`));
