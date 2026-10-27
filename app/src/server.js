import express from 'express';
import { pool, migrate } from './db.js';

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const { rows } = await pool.query('select now() as db_time');
  res.json({ ok: true, ...rows[0] });
});

// --- Track ratings -------------------------------------------------------
// Listeners are anonymous: the browser keeps a random UUID and sends it as X-Listener-Id.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

function ratingContext(req, res) {
  const listener = String(req.get('x-listener-id') ?? '');
  const artist = norm(req.method === 'GET' ? req.query.artist : req.body?.artist);
  const title = norm(req.method === 'GET' ? req.query.title : req.body?.title);
  if (!UUID_RE.test(listener)) return res.status(400).json({ error: 'valid X-Listener-Id header required' });
  if (!title || artist.length > 200 || title.length > 300) return res.status(400).json({ error: 'artist/title invalid' });
  return { listener, artist, title, key: `${artist}|${title}`.toLowerCase() };
}

async function ratingSummary(key, listener) {
  const { rows } = await pool.query(
    `select count(*) filter (where value = 1)::int as up,
            count(*) filter (where value = -1)::int as down,
            max(value) filter (where listener_id = $2) as mine
       from ratings where track_key = $1`,
    [key, listener],
  );
  return { up: rows[0].up, down: rows[0].down, mine: rows[0].mine ?? 0 };
}

app.get('/api/ratings', async (req, res) => {
  const ctx = ratingContext(req, res);
  if (!ctx.key) return;
  res.json(await ratingSummary(ctx.key, ctx.listener));
});

// value: 1 = thumbs up, -1 = thumbs down, 0 = clear my rating
app.post('/api/ratings', async (req, res) => {
  const ctx = ratingContext(req, res);
  if (!ctx.key) return;
  const value = req.body?.value;
  if (![1, -1, 0].includes(value)) return res.status(400).json({ error: 'value must be 1, -1 or 0' });
  if (value === 0) {
    await pool.query('delete from ratings where track_key = $1 and listener_id = $2', [ctx.key, ctx.listener]);
  } else {
    await pool.query(
      `insert into ratings (track_key, artist, title, listener_id, value) values ($1, $2, $3, $4, $5)
       on conflict (track_key, listener_id) do update set value = excluded.value, updated_at = now()`,
      [ctx.key, ctx.artist, ctx.title, ctx.listener, value],
    );
  }
  res.json(await ratingSummary(ctx.key, ctx.listener));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

await migrate();
const port = process.env.APP_PORT ?? 3000;
app.listen(port, '127.0.0.1', () => console.log(`app listening on http://127.0.0.1:${port}`));
