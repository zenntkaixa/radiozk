import { Router } from 'express';
import { pool } from '../db.js';
import { parseTrackRequest, isRatingValue } from '../validate.js';

/** Validates the request and returns { listener, artist, title, key }, or sends a 400 and returns null. */
function parseRequest(req, res) {
  const parsed = parseTrackRequest(req.get('x-listener-id'), req.method === 'GET' ? req.query : req.body);
  if (parsed.error) {
    res.status(400).json({ error: parsed.error });
    return null;
  }
  return parsed;
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
  if (!isRatingValue(value)) return res.status(400).json({ error: 'value must be 1, -1 or 0' });
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
