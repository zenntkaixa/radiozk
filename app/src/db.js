import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://radiozk:radiozk@127.0.0.1:5433/radiozk',
});

// An idle client errors when PostgreSQL restarts; without a listener that event kills the process.
// The pool discards the broken client and connects again on the next query.
pool.on('error', (err) => console.error('idle database client error:', err.message));

export async function migrate() {
  // One vote per listener per track; track_key is the normalized "artist|title".
  await pool.query(`
    create table if not exists ratings (
      track_key text not null,
      artist text not null,
      title text not null,
      listener_id uuid not null,
      value smallint not null check (value in (-1, 1)),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (track_key, listener_id)
    )`);
}
