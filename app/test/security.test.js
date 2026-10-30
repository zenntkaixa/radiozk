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

// ---- Rate limiting (src/rateLimit.js). Own servers with tiny limits; the main server above has generous ones. ----
// The tests give each "client" its own address with X-Forwarded-For, which a server that trusts its peer (the default
// trusts loopback, i.e. nginx) honours, so every test starts with a fresh budget.

const LIMITS = { RATE_LIMIT_WRITE: '5', RATE_LIMIT_READ: '8' };
let limited; // trusts X-Forwarded-For from loopback (like production behind nginx)
let untrusting; // TRUST_PROXY=false: a client cannot choose its own address
before(async () => {
  limited = await startTestServer({ port: 3102, db: 'radiozk_test_security_rl', env: LIMITS });
  untrusting = await startTestServer({ port: 3103, db: 'radiozk_test_security_rl', env: { ...LIMITS, TRUST_PROXY: 'false' } });
});
after(() => {
  limited?.stop();
  untrusting?.stop();
});

const vote = (server, ip, body = { ...track(), value: 1 }) =>
  fetch(`${server.base}/api/ratings`, {
    method: 'POST',
    headers: { 'x-listener-id': randomUUID(), 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
const read = (server, ip, t = { artist: 'a', title: 'b' }) =>
  fetch(`${server.base}/api/ratings?${new URLSearchParams(t)}`, { headers: { 'x-listener-id': randomUUID(), 'x-forwarded-for': ip } });
const statuses = async (n, fn) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push((await fn(i)).status);
  return out;
};

test('votes beyond the per-address limit get 429 with Retry-After and a JSON error', async () => {
  const ip = '203.0.113.10';
  assert.deepEqual(await statuses(7, () => vote(limited, ip)), [200, 200, 200, 200, 200, 429, 429]);
  const res = await vote(limited, ip);
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get('retry-after')) > 0, 'Retry-After is set');
  assert.ok(res.headers.get('ratelimit'), 'RateLimit header is set');
  assert.deepEqual(await res.json(), { error: 'too many requests' });
});

test('reads have their own, separate budget', async () => {
  const ip = '203.0.113.11';
  assert.deepEqual(await statuses(9, () => read(limited, ip)), [200, 200, 200, 200, 200, 200, 200, 200, 429]);
  assert.equal((await vote(limited, ip)).status, 200, 'writes are not affected by the exhausted read budget');
});

test('the limit is per address: another address is unaffected', async () => {
  await statuses(7, () => vote(limited, '203.0.113.12'));
  assert.equal((await vote(limited, '203.0.113.13')).status, 200);
});

test('one address cannot stuff a track with fresh listener ids beyond the limit', async () => {
  const t = track();
  const codes = await statuses(12, () => vote(limited, '203.0.113.14', { ...t, value: 1 }));
  assert.equal(codes.filter((c) => c === 200).length, 5);
  assert.equal((await (await read(limited, '203.0.113.99', t)).json()).up, 5);
});

test('a client that is not behind a trusted proxy cannot dodge the limit by forging X-Forwarded-For', async () => {
  const codes = await statuses(12, (i) => vote(untrusting, `198.51.100.${i + 1}`));
  assert.equal(codes.filter((c) => c === 200).length, 5);
  assert.equal(codes.filter((c) => c === 429).length, 7);
});

test('the health check is not rate limited', async () => {
  const codes = await statuses(15, () => fetch(`${limited.base}/api/health`));
  assert.ok(codes.every((c) => c === 200));
});

// ---- Accepted, documented gap: a vote is tied only to a client-chosen random id and an IP address. ----

test('KNOWN GAP: many distinct addresses can still inflate one track (distributed ballot stuffing)', async () => {
  const t = track();
  const codes = await statuses(12, (i) => vote(limited, `192.0.2.${i + 1}`, { ...t, value: 1 }));
  assert.ok(codes.every((c) => c === 200), 'no address exceeded its own limit');
  assert.equal((await (await read(limited, '192.0.2.200', t)).json()).up, 12);
});
