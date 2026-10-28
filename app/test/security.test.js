// Security-focused black-box tests of the HTTP API (same setup as ratings.test.js, own port and database).
// Needs PostgreSQL running. Run: npm run test:security (here) or `make security` from the repo root.
//
// Tests named "KNOWN GAP" assert behaviour that is NOT secure but is accepted for now (see README-TESTING.md).
// If one of them starts failing, the gap was closed: update the test and the docs rather than reverting the fix.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestServer } from './helpers.js';

let server;
let BASE;
before(async () => {
  server = await startTestServer({ port: 3101, db: 'radiozk_test_security' });
  BASE = server.base;
});
after(() => server?.stop());

const post = (body, headers = {}, listener = randomUUID()) =>
  fetch(`${BASE}/api/ratings`, {
    method: 'POST',
    headers: { 'x-listener-id': listener, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const get = (query, listener = randomUUID()) =>
  fetch(`${BASE}/api/ratings?${query}`, { headers: { 'x-listener-id': listener } });
const track = () => ({ artist: 'Sec Artist', title: `Song ${randomUUID()}` });

test('responses do not advertise the framework', async () => {
  const res = await fetch(`${BASE}/api/health`);
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('the API sends no CORS headers (same-origin only)', async () => {
  const res = await get('artist=a&title=b');
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('malformed JSON is a 400 without internals', async () => {
  const res = await post('{"artist": "A", "title":');
  assert.equal(res.status, 400);
  const text = await res.text();
  assert.doesNotMatch(text, /SyntaxError|\bat .*\(.*:\d+:\d+\)|node_modules/);
});

test('an oversized body is rejected with 413', async () => {
  const res = await post({ ...track(), value: 1, padding: 'x'.repeat(1024 * 1024) });
  assert.equal(res.status, 413);
});

test('a non-JSON content type does not slip through', async () => {
  const res = await post('artist=A&title=T&value=1', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(res.status, 400);
});

test('artist and title must be strings (no object/array/number coercion)', async () => {
  for (const bad of [{ title: { a: 1 } }, { title: ['x', 'y'] }, { title: 42 }, { artist: ['a', 'b'] }, { artist: {} }]) {
    const res = await post({ artist: 'A', title: 'T', value: 1, ...bad });
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});

test('repeated query parameters are rejected rather than joined', async () => {
  assert.equal((await get('artist=a&artist=b&title=t')).status, 400);
  assert.equal((await get('artist=a&title=t&title=u')).status, 400);
});

test('SQL injection payloads are data: no errors, and the table survives', async () => {
  const payloads = [`'; drop table ratings; --`, `' or '1'='1`, `\\'; select pg_sleep(5); --`, `"; delete from ratings; --`];
  for (const p of payloads) {
    const t = { artist: p, title: `${p} ${randomUUID()}` };
    const res = await post({ ...t, value: 1 });
    assert.equal(res.status, 200, p);
    assert.deepEqual(await res.json(), { up: 1, down: 0, mine: 1 });
  }
  // the table still exists and works
  assert.equal((await get(new URLSearchParams(track()))).status, 200);
});

test('the listener id header is validated, not interpolated', async () => {
  const t = new URLSearchParams(track());
  for (const bad of [`'; drop table ratings; --`, `${randomUUID()}\u0000`, 'a'.repeat(5000), '../../etc/passwd']) {
    const res = await fetch(`${BASE}/api/ratings?${t}`, { headers: { 'x-listener-id': bad } }).catch((e) => e);
    // an invalid header value may be refused by fetch itself; otherwise the server must answer 400
    if (res instanceof Response) assert.equal(res.status, 400, bad.slice(0, 30));
  }
});

test('one listener cannot read or change another listener\'s vote', async () => {
  const t = track();
  const alice = randomUUID();
  await post({ ...t, value: 1 }, {}, alice);
  const bob = await (await get(new URLSearchParams(t), randomUUID())).json();
  assert.equal(bob.mine, 0);
  await post({ ...t, value: 0 }, {}, randomUUID()); // bob "clearing" must not delete alice's vote
  assert.equal((await (await get(new URLSearchParams(t), alice)).json()).mine, 1);
});

test('unknown API routes and methods do not leak internals', async () => {
  for (const res of [await fetch(`${BASE}/api/nope`), await fetch(`${BASE}/api/ratings`, { method: 'DELETE' })]) {
    assert.ok([404, 405].includes(res.status), String(res.status));
    assert.doesNotMatch(await res.text(), /\bat .*\(.*:\d+:\d+\)|node_modules/);
  }
});

// ---- Accepted, documented gaps: there is no rate limiting and no binding of a vote to anything but a
// client-chosen random id (no IP / fingerprint). Discussed and postponed; these tests pin today's behaviour. ----

test('KNOWN GAP: one listener can rate many tracks without being throttled', async () => {
  const me = randomUUID();
  const results = await Promise.all(Array.from({ length: 60 }, () => post({ ...track(), value: 1 }, {}, me)));
  assert.ok(results.every((r) => r.status === 200), 'no request was rate limited');
});

test('KNOWN GAP: unlimited fresh listener ids can inflate one track (ballot stuffing)', async () => {
  const t = track();
  await Promise.all(Array.from({ length: 40 }, () => post({ ...t, value: 1 })));
  assert.equal((await (await get(new URLSearchParams(t))).json()).up, 40);
});
