// Black-box tests: spawn the real server on its own port against a throwaway database, then use HTTP.
// Needs PostgreSQL running (bin/start.sh). Run: npm test (in app/) or bin/test.sh.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_URL = process.env.ADMIN_DATABASE_URL ?? 'postgresql://radiozk:radiozk@127.0.0.1:5433/radiozk';
const TEST_DB = 'radiozk_test';
const TEST_URL = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB}`);

let server;

before(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [TEST_DB]);
  if (!rowCount) await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  server = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, DATABASE_URL: TEST_URL, APP_PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

after(() => server?.kill());

const get = (listener, artist, title) =>
  fetch(`${BASE}/api/ratings?${new URLSearchParams({ artist, title })}`, {
    headers: listener ? { 'x-listener-id': listener } : {},
  });

const vote = (listener, artist, title, value) =>
  fetch(`${BASE}/api/ratings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(listener ? { 'x-listener-id': listener } : {}) },
    body: JSON.stringify({ artist, title, value }),
  });

// Each test uses its own track so tests don't depend on each other's votes.
const track = () => ({ artist: 'Test Artist', title: `Song ${randomUUID()}` });

test('a track with no votes reports zeros', async () => {
  const t = track();
  const res = await get(randomUUID(), t.artist, t.title);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { up: 0, down: 0, mine: 0 });
});

test('thumbs up is counted and reported as mine', async () => {
  const t = track();
  const me = randomUUID();
  const res = await vote(me, t.artist, t.title, 1);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { up: 1, down: 0, mine: 1 });
  assert.deepEqual(await (await get(me, t.artist, t.title)).json(), { up: 1, down: 0, mine: 1 });
});

test('voting the same way twice does not double count', async () => {
  const t = track();
  const me = randomUUID();
  await vote(me, t.artist, t.title, 1);
  assert.deepEqual(await (await vote(me, t.artist, t.title, 1)).json(), { up: 1, down: 0, mine: 1 });
});

test('votes from different listeners add up, and "mine" is per listener', async () => {
  const t = track();
  const a = randomUUID();
  const b = randomUUID();
  await vote(a, t.artist, t.title, 1);
  assert.deepEqual(await (await vote(b, t.artist, t.title, -1)).json(), { up: 1, down: 1, mine: -1 });
  assert.equal((await (await get(a, t.artist, t.title)).json()).mine, 1);
});

test('changing a vote moves it between up and down', async () => {
  const t = track();
  const me = randomUUID();
  await vote(me, t.artist, t.title, 1);
  assert.deepEqual(await (await vote(me, t.artist, t.title, -1)).json(), { up: 0, down: 1, mine: -1 });
});

test('value 0 clears the vote', async () => {
  const t = track();
  const me = randomUUID();
  await vote(me, t.artist, t.title, 1);
  assert.deepEqual(await (await vote(me, t.artist, t.title, 0)).json(), { up: 0, down: 0, mine: 0 });
});

test('clearing with no existing vote is harmless', async () => {
  const t = track();
  assert.deepEqual(await (await vote(randomUUID(), t.artist, t.title, 0)).json(), { up: 0, down: 0, mine: 0 });
});

test('track matching ignores case and extra whitespace', async () => {
  const t = track();
  const me = randomUUID();
  await vote(me, t.artist, t.title, 1);
  const res = await get(me, `  ${t.artist.toUpperCase()} `, t.title.replace('Song ', 'song   '));
  assert.deepEqual(await res.json(), { up: 1, down: 0, mine: 1 });
});

test('a different title is a different track', async () => {
  const t = track();
  const me = randomUUID();
  await vote(me, t.artist, t.title, 1);
  const res = await get(me, t.artist, `${t.title} (2006 Remaster)`);
  assert.deepEqual(await res.json(), { up: 0, down: 0, mine: 0 });
});

test('an earlier vote survives other tracks being rated, and is there when the track returns', async () => {
  const first = track();
  const me = randomUUID();
  await vote(me, first.artist, first.title, 1);
  for (let i = 0; i < 3; i++) {
    const other = track();
    await vote(me, other.artist, other.title, i % 2 ? 1 : -1);
  }
  assert.deepEqual(await (await get(me, first.artist, first.title)).json(), { up: 1, down: 0, mine: 1 });
});

test('requests without a valid listener id are rejected', async () => {
  const t = track();
  for (const id of [undefined, 'nope', '1234', `${randomUUID()}x`]) {
    assert.equal((await get(id, t.artist, t.title)).status, 400, `GET with id=${id}`);
    assert.equal((await vote(id, t.artist, t.title, 1)).status, 400, `POST with id=${id}`);
  }
});

test('invalid vote values are rejected', async () => {
  const t = track();
  for (const value of [2, -2, '1', null, true, undefined]) {
    assert.equal((await vote(randomUUID(), t.artist, t.title, value)).status, 400, `value=${String(value)}`);
  }
});

test('empty or oversized artist/title are rejected', async () => {
  const me = randomUUID();
  assert.equal((await vote(me, 'A', '', 1)).status, 400);
  assert.equal((await vote(me, 'A', '   ', 1)).status, 400);
  assert.equal((await vote(me, 'A'.repeat(201), 'T', 1)).status, 400);
  assert.equal((await vote(me, 'A', 'T'.repeat(301), 1)).status, 400);
});

test('an empty artist is allowed (title is what identifies the track)', async () => {
  const me = randomUUID();
  const res = await vote(me, '', `Instrumental ${randomUUID()}`, 1);
  assert.equal(res.status, 200);
});

test('SQL metacharacters in artist/title are stored as data', async () => {
  const me = randomUUID();
  const title = `x'); drop table ratings; -- ${randomUUID()}`;
  assert.equal((await vote(me, "O'Brien", title, 1)).status, 200);
  assert.deepEqual(await (await get(me, "O'Brien", title)).json(), { up: 1, down: 0, mine: 1 });
});

test('concurrent votes from one listener leave exactly one vote', async () => {
  const t = track();
  const me = randomUUID();
  const results = await Promise.all(
    [1, -1, 1, -1, 1, -1, 1, -1].map((v) => vote(me, t.artist, t.title, v)),
  );
  assert.ok(results.every((r) => r.status === 200));
  const final = await (await get(me, t.artist, t.title)).json();
  assert.equal(final.up + final.down, 1);
  assert.equal(final.mine, final.up ? 1 : -1);
});

test('concurrent votes from many listeners are all counted', async () => {
  const t = track();
  await Promise.all(Array.from({ length: 20 }, (_, i) => vote(randomUUID(), t.artist, t.title, i % 4 === 0 ? -1 : 1)));
  assert.deepEqual(await (await get(randomUUID(), t.artist, t.title)).json(), { up: 15, down: 5, mine: 0 });
});

test('another listener\'s vote never shows up as mine', async () => {
  const t = track();
  await vote(randomUUID(), t.artist, t.title, -1);
  assert.equal((await (await get(randomUUID(), t.artist, t.title)).json()).mine, 0);
});
