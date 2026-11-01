import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://radiozk:radiozk@127.0.0.1:5433/radiozk',
  max: Number(process.env.PG_POOL_MAX) || 10, // serverless instances should keep this small (each holds its own pool)
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

let migrating;
/** For serverless instances: run the idempotent migration once per instance; a failed attempt is retried by the next request. */
export function migrateOnce() {
  migrating ??= migrate().catch((err) => {
    migrating = undefined;
    throw err;
  });
  return migrating;
}
