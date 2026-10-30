// Shared by the black-box API tests: spawn the real server on its own port against a throwaway database.
import { spawn } from 'node:child_process';
import pg from 'pg';

const ADMIN_URL = process.env.ADMIN_DATABASE_URL ?? 'postgresql://radiozk:radiozk@127.0.0.1:5433/radiozk';

/** Each test file uses its own port and database so files can run in parallel. */
export async function startTestServer({ port, db, env = {} }) {
  const base = `http://127.0.0.1:${port}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [db]);
  // Test files run in parallel; concurrent CREATE DATABASE can briefly fail on the template1 lock (55006).
  for (let attempt = 0; !rowCount; attempt++) {
    try {
      await admin.query(`create database ${db}`);
      break;
    } catch (e) {
      if (e.code === '42P04') break; // another file created it first
      if (e.code !== '55006' || attempt >= 20) throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await admin.end();

  const server = spawn(process.execPath, ['src/server.js'], {
    // Generous rate limits by default: a test file sends many requests from one address. Rate-limit tests override them.
    env: { ...process.env, RATE_LIMIT_READ: '100000', RATE_LIMIT_WRITE: '100000', DATABASE_URL: ADMIN_URL.replace(/\/[^/]+$/, `/${db}`), APP_PORT: String(port), ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return { base, stop: () => server.kill() };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  server.kill();
  throw new Error('server did not start');
}
