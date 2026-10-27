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
}
