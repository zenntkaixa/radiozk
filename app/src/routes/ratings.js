import { Router } from 'express';
import { pool } from '../db.js';

// Listeners are anonymous: the browser keeps a random UUID and sends it as X-Listener-Id.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Validates the request and returns { listener, artist, title, key }, or sends a 400 and returns null. */
function parseRequest(req, res) {
  const source = req.method === 'GET' ? req.query : req.body;
  const listener = String(req.get('x-listener-id') ?? '');
  const artist = norm(source?.artist);
  const title = norm(source?.title);
  if (!UUID_RE.test(listener)) {
    res.status(400).json({ error: 'valid X-Listener-Id header required' });
    return null;
  }
  if (!title || artist.length > 200 || title.length > 300) {
    res.status(400).json({ error: 'artist/title invalid' });
    return null;
  }
  return { listener, artist, title, key: `${artist}|${title}`.toLowerCase() };
}

async function summary(key, listener) {
  const { rows } = await pool.query(
    `select count(*) filter (where value = 1)::int as up,
            count(*) filter (where value = -1)::int as down,
            max(value) filter (where listener_id = $2) as mine
       from ratings where track_key = $1`,
    [key, listener],
  );
  return { up: rows[0].up, down: rows[0].down, mine: rows[0].mine ?? 0 };
}

const router = Router();

router.get('/', async (req, res) => {
  const ctx = parseRequest(req, res);
  if (!ctx) return;
  res.json(await summary(ctx.key, ctx.listener));
});

// value: 1 = thumbs up, -1 = thumbs down, 0 = clear my rating
router.post('/', async (req, res) => {
  const ctx = parseRequest(req, res);
  if (!ctx) return;
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
  res.json(await summary(ctx.key, ctx.listener));
});

export default router;
