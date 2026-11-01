import assert from 'node:assert/strict';
import http from 'node:http';
import { mock, test } from 'node:test';
import handler from '../../api/index.mjs';
import { pool } from '../src/db.js';

// No database: pool.query is stubbed. The Vercel entry is the Express app behind a lazy, retried migration.
test('the Vercel entry migrates once, retries after a failed migration, and serves the app', async () => {
  const sqls = [];
  let failMigration = true;
  mock.method(pool, 'query', async (sql) => {
    sqls.push(sql);
    if (/create table if not exists ratings/.test(sql)) {
      if (failMigration) {
        failMigration = false;
        throw new Error('db down');
      }
      return {};
    }
    return { rows: [{ db_time: 'now' }] };
  });
  const quiet = mock.method(console, 'error', () => {});
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const migrations = () => sqls.filter((s) => /create table/.test(s)).length;
  try {
    const down = await fetch(`${base}/api/health`);
    assert.equal(down.status, 500);
    assert.deepEqual(await down.json(), { error: 'internal error' }); // no internals leak

    const up = await fetch(`${base}/api/health`);
    assert.equal(up.status, 200);
    assert.deepEqual(await up.json(), { ok: true, db_time: 'now' });
    assert.equal(migrations(), 2, 'the failed migration was retried by the next request');

    await fetch(`${base}/api/health`);
    assert.equal(migrations(), 2, 'a successful migration is not repeated');

    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  } finally {
    server.close();
    quiet.mock.restore();
    mock.restoreAll();
  }
});
