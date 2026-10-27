import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://radiozk:radiozk@127.0.0.1:5433/radiozk',
});

export async function migrate() {
  await pool.query(`
    create table if not exists notes (
      id serial primary key,
      body text not null,
      created_at timestamptz not null default now()
    )`);
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
