// Presence: unit tests of the in-memory store (fake clock) and black-box tests of /api/presence.
// The API part needs PostgreSQL running (the server migrates on start). Own port 3105 and database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPresence } from '../src/presence.js';
import { startTestServer } from './helpers.js';

test('a listener counts until the TTL after the last heartbeat, and repeated beats count once', () => {
  let t = 1_000;
  const p = createPresence({ now: () => t, ttlMs: 60_000 });
  assert.equal(p.count(), 0);
  p.beat('a');
  p.beat('a');
  p.beat('b');
  assert.equal(p.count(), 2);
  t += 59_000;
  assert.equal(p.count(), 2);
  p.beat('b'); // b refreshed, a is not
  t += 2_000;
  assert.equal(p.count(), 1);
  t += 60_000;
  assert.equal(p.count(), 0);
});

test('the store is capped: new ids are ignored while full of live ones, and fit again once old ones expire', () => {
  let t = 0;
  const p = createPresence({ now: () => t, ttlMs: 10, max: 2 });
  p.beat('a');
  p.beat('b');
  p.beat('c');
  assert.equal(p.count(), 2);
  p.beat('a'); // existing ids still refresh
  t += 11;
  p.beat('c');
  assert.equal(p.count(), 1);
});

let server;
let limited;
before(async () => {
  server = await startTestServer({ port: 3105, db: 'radiozk_test_presence' });
  limited = await startTestServer({ port: 3106, db: 'radiozk_test_presence', env: { RATE_LIMIT_PRESENCE: '3', RATE_LIMIT_PRESENCE_LISTENER: '2' } });
});
after(() => {
  server?.stop();
  limited?.stop();
});

const beat = (base, id = randomUUID(), headers = {}) => fetch(`${base}/api/presence`, { method: 'POST', headers: { 'x-listener-id': id, ...headers } });
const count = async (base) => (await (await fetch(`${base}/api/presence`)).json()).listening;

test('a heartbeat counts the listener, once however often it repeats, and GET needs no id', async () => {
  const before = await count(server.base);
  const id = randomUUID();
  assert.equal((await (await beat(server.base, id)).json()).listening, before + 1);
  await beat(server.base, id);
  const other = await (await beat(server.base)).json();
  assert.equal(other.listening, before + 2);
  assert.equal(await count(server.base), before + 2);
});

test('upper- and lower-case spellings of one id are one listener', async () => {
  const before = await count(server.base);
  const id = randomUUID();
  await beat(server.base, id);
  assert.equal((await (await beat(server.base, id.toUpperCase())).json()).listening, before + 1);
});

test('responses are not cacheable', async () => {
  assert.equal((await fetch(`${server.base}/api/presence`)).headers.get('cache-control'), 'no-store');
});

test('a heartbeat without a valid listener id is a 400 and counts nothing', async () => {
  const before = await count(server.base);
  for (const id of ['', 'nope', '1234']) assert.equal((await beat(server.base, id)).status, 400);
  assert.equal(await count(server.base), before);
});

test('rate limits: per listener id, and per IP across ids', async () => {
  const id = randomUUID();
  const fwd = { 'x-forwarded-for': '203.0.113.7' };
  assert.equal((await beat(limited.base, id, fwd)).status, 200);
  assert.equal((await beat(limited.base, id, fwd)).status, 200);
  const third = await beat(limited.base, id, fwd);
  assert.equal(third.status, 429); // listener limit (2) hit before the IP limit (3)
  assert.ok(third.headers.get('retry-after'));
  // the IP has now used 3 heartbeats: a fresh id from the same address is refused too, another address is not
  assert.equal((await beat(limited.base, randomUUID(), fwd)).status, 429);
  assert.equal((await beat(limited.base, randomUUID(), { 'x-forwarded-for': '203.0.113.8' })).status, 200);
});

test('the per-listener limit cannot be dodged by changing the case of the id', async () => {
  const id = randomUUID();
  const fwd = { 'x-forwarded-for': '203.0.113.9' };
  assert.equal((await beat(limited.base, id, fwd)).status, 200);
  assert.equal((await beat(limited.base, id.toUpperCase(), fwd)).status, 200);
  assert.equal((await beat(limited.base, id, fwd)).status, 429);
});
