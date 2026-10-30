# Testing

How the tests are organised, how to run them, and how to add new ones. For setting up the project itself, see [README.md](README.md).

## Layers

| Layer | Where | Tool | Needs | Speed |
|---|---|---|---|---|
| Backend unit | `app/test/validate.test.js` | `node:test` | nothing | milliseconds |
| Backend API (integration) | `app/test/ratings.test.js` | `node:test` | PostgreSQL | seconds |
| Backend security | `app/test/security.test.js` | `node:test` | PostgreSQL | seconds |
| Frontend parser, size check | `web/test/nowPlaying.test.mjs`, `web/test/checkSize.test.mjs` | `node:test` | nothing | milliseconds |
| Frontend UI | `web/test/*.test.{ts,tsx}` | Vitest + Testing Library + jsdom | nothing | seconds |
| End-to-end | `web/e2e/radio.mjs` | Playwright, headless Firefox | the whole stack running, a current build | about a minute |

Current counts: 49 backend (13 unit + 18 API + 18 security), 13 parser, 70 UI, 25 e2e checks.

The first five layers run in CI, together with a Docker smoke test (`bin/docker-smoke.sh`: builds the production images, hits the endpoints through nginx, checks the security headers on pages, assets, API and error responses, checks a vote survives a database restart). The e2e layer does not: it needs the real stream and a full local stack.

## Running the tests

In a fresh shell, load the environment first: `source bin/env.sh`.

```sh
bin/start.sh     # PostgreSQL must be running for the API tests
bin/test.sh      # backend + frontend, everything except e2e
```

Individual suites:

| What | Command |
|---|---|
| Backend, all | `cd app && npm test` |
| Backend unit only (no DB) | `cd app && npm run test:unit` |
| Backend API only | `cd app && npm run test:api` |
| Backend security tests only | `cd app && npm run test:security` (or `make security-tests`) |
| Dependency audit | `make audit` (or `bin/audit.sh`) |
| Audit + security tests | `make security` |
| Backend coverage report | `cd app && npm run test:coverage` |
| Frontend, all (parser + UI) | `cd web && npm test` |
| Frontend parser only | `cd web && npm run test:parser` |
| Frontend UI only | `cd web && npm run test:ui` |
| One backend test by name | `cd app && node --test --test-name-pattern='<text>' 'test/*.test.js'` |
| One UI test file | `cd web && npx vitest run test/RatingButtons.test.tsx` |
| Vitest watch mode | `cd web && npx vitest` |
| Type check (includes `web/test/`) | `cd web && npm run typecheck` |

Use globs such as `'test/*.test.js'` rather than a directory: `node --test test/` fails on Node 24 (it works on 26, but the globs work on both).

### End-to-end

```sh
bin/start.sh && bin/build.sh        # stack up, current build in www/
bin/app.sh                          # in another terminal, or in the background
cd web && npm run e2e               # optional URL argument, default http://localhost:8080
bin/psql.sh -c 'truncate ratings'   # clean up afterwards
```

It checks page render, FLAC and AAC playback advancing (it waits until the audio has advanced 5 s of media within 25 s, so a CDN rebuffer does not fail it), ratings (including persistence across a reload), routing, and that the Content-Security-Policy blocks nothing the player needs. It casts real votes in your development database, hence the cleanup step. It uses Playwright's bundled Firefox from `~/.cache/ms-playwright`. The test machine has no audio device, so it proves that audio decodes and advances, not that it is audible.

## What each layer covers

### Backend unit: `app/test/validate.test.js`

Tests the pure functions in `app/src/validate.js` with no server or database:

- `norm`: whitespace collapsing, non-string input
- `trackKey`: case and whitespace insensitivity, unicode, differently titled releases staying distinct
- `parseTrackRequest`: valid requests, missing or malformed listener ids, empty title, length limits (200 artist / 300 title, measured after normalising)
- `isRatingValue`: only `1`, `-1` and `0` are accepted

### Backend API: `app/test/ratings.test.js`

Black-box tests. The suite spawns the real server (`src/server.js`) on port 3100 against a throwaway `radiozk_test` database, which it creates on demand, and talks to it over HTTP only. That keeps the tests valid across refactors of the server internals. Each test rates its own random track so tests don't depend on each other's votes.

Covers counting, `mine` per listener, changing and clearing votes, idempotent repeat votes, track matching, persistence across other tracks, input rejection, SQL metacharacters stored as data, and concurrent votes (one listener racing against themselves, many listeners at once).

Environment overrides:

- `ADMIN_DATABASE_URL`: connection used to create `radiozk_test` (default: the local dev database on port 5433). CI sets it to the Postgres service container.

### Bundle size budget: `web/scripts/check-size.mjs`

After a build (`bin/build.sh`), `cd web && npm run size` checks gzip sizes (level 6, as nginx sends them) in `www/`: everything `index.html` loads up front must stay under `initialKb` (95 KB; about 88 KB when set), each other JS chunk under `lazyChunkKb` (120 KB; `hls.light` is about 110 KB), and the initial files must not contain hls.js at all. CI runs it right after the build. Raise a limit in `BUDGET` deliberately, in the PR that needs it. `test/checkSize.test.mjs` runs the check on small fake builds.

`cd web && npm run perf [url]` (`scripts/perf.mjs`) measures a cold and a warm page load in headless Firefox: request timeline, FCP, LCP, transferred bytes. It is a manual tool, not a test: timings depend on the CDN that serves the cover, so compare several runs. Point it at a build that is being served (default http://localhost:8080/).

### Frontend parser: `web/test/nowPlaying.test.mjs`

Tests `parse()` from `web/src/nowPlaying.ts`, which normalises the station's `metadatav2.json` (stray whitespace, previous-tracks list). Node strips the TypeScript types, so no build step is needed.

### Frontend UI: `web/test/*.test.{ts,tsx}`

Vitest with jsdom; configuration is in `web/vitest.config.ts` and shared setup in `web/test/setup.ts`. It only picks up `test/**/*.test.{ts,tsx}`, so the `.mjs` parser tests and the e2e script are left to their own runners.

- `RatingButtons.test.tsx`: loading placeholders, optimistic update then adopting the server counts, buttons disabled while saving, moving and clearing votes, rollback with an alert on failure, and ignoring save or load responses that arrive after the track changed. `api.ts` is mocked, and promises are resolved by hand to observe in-flight state.
- `api.test.ts`: request URLs, the `x-listener-id` header, POST bodies and error mapping, with `fetch` stubbed.
- `listenerId.test.ts`: UUID generation and persistence, behaviour when storage is blocked, and the fallback when `crypto.randomUUID` is missing. The module caches state, so each test loads a fresh copy.
- `rating.test.ts`: `applyVote` as a pure function.
- `useRadioStream.test.tsx`: the playback hook with a fake `hls.js/light` and a controllable idle scheduler: nothing is loaded until idle, never in native mode, Save-Data and load failures (with retry), unmount while loading, Play before and after the player exists (including pressing it twice), FLAC pinning with the AAC fallback notice, and quality switches while paused, playing and mid-start. The fake is registered per test with `vi.doMock`, because Vitest caches a `vi.mock` factory's result across `resetModules()`.
- `idle.test.ts`: `whenIdle` (delay, idle callback, waiting for images with a cap, cancelling) and `saveDataRequested`.
- `useMediaSession.test.tsx`: the media session (and so the artwork download) stays untouched until playback has started, then follows track changes and keeps its metadata while paused.
- `indexHtml.test.ts`: `index.html` preconnects to the same CDN host as `config.ts` (with and without CORS) its icon file exists in `public/`, and its inline early metadata request uses `METADATA_URL`.
- `securityHeaders.test.ts`: `docker/security-headers.conf` pins the inline script of `index.html` by hash, allows only the station CDN, covers what the player needs (`blob:`, `data:`), and is included in every production nginx location, the image and the host config.
- `useNowPlaying.test.tsx`: the hook uses the early request from `index.html` once without fetching again, and falls back to a normal fetch when it is missing or failed.

## Writing new tests

- Put logic that needs no I/O in a pure module (like `app/src/validate.js` and `web/src/rating.ts`) and unit-test it directly. Reach for the API or UI layer only for behaviour that needs a server or a DOM.
- API tests go through HTTP, not through imported server code. Use a fresh random track and listener (`randomUUID()`) per test.
- UI tests should find elements by role and accessible name (`getByRole('button', { name: ... })`), as users do, not by class names.
- Don't hit the real station from automated tests other than the e2e script, and never call their ratings endpoint.
- Check that a new test can fail: break the code under test on purpose and confirm the test goes red. This is how the suites were validated.

## Continuous integration

`.github/workflows/ci.yml` (one workflow, read-only token, superseded runs of the same ref are cancelled) runs on pushes to `main` and `develop`, on pull requests, and weekly on Mondays. Jobs:

| Job | What it does | Runs on |
|---|---|---|
| `test` | `npm ci`, then `npm run build` in `web/` (type check, which includes the tests, plus the production build) and `npm run size` (bundle size budget), then `npm test` in `app/` against a `postgres:18` service container (backend unit, API **and security tests**), then `npm test` in `web/` (parser and UI tests) | push, PR |
| `audit` | `bin/audit.sh`: `npm audit` in `app/` and `web/`, fails on high and above | push, PR, weekly |
| `docker` | `bin/docker-smoke.sh`: builds the production images and checks them end to end | push, PR |
| `trivy` | builds the `api` and `web` images and scans them (OS packages, dependencies, secrets) plus the Dockerfile and compose files with Trivy; fails on fixable HIGH/CRITICAL findings | push, PR, weekly |
| `CodeQL` (own workflow, `codeql.yml`) | static analysis of the JavaScript/TypeScript code; results under Security > Code scanning, not part of the `ci` gate | push, PR, weekly |
| `ci` | Gate: green only when `audit` passed and, outside the weekly run, `test` and `docker` passed too | always |

The weekly run executes only `audit`, because new advisories appear without any code change; a failure there shows up as a failed run on `main`'s Actions page. Require the single `ci` check in branch protection instead of listing each job.

Inside the dev containers the same suites run with `docker compose -f compose.dev.yaml exec api npm test` and `... exec web npm test`.

The other two workflows in `.github/workflows/` belong to the Claude GitHub App (PR assistant and code review) and don't run the test suites.

## Security checks

`make security` runs the dependency audit and the security tests. `make` with no target lists all targets.

**Dependency audit** (`bin/audit.sh`): `npm audit` in `app/` and `web/`, dev dependencies included. It fails on **high** and critical advisories; lower severities are printed but don't fail. `AUDIT_LEVEL=moderate make audit` tightens it. CI runs it as the `audit` job (see above), including a weekly run. Dependabot (`.github/dependabot.yml`) opens weekly PRs against `develop` for npm, Docker base images and GitHub Actions.

**Security tests** (`app/test/security.test.js`, on its own port and database so it runs in parallel with the API tests) cover:

- no `X-Powered-By` header and no CORS headers
- malformed JSON gives 400 and an oversized body gives 413, with no stack traces or internals in any error
- wrong content types, non-string `artist`/`title` (objects, arrays, numbers) and repeated query parameters are rejected, not coerced
- SQL injection payloads in `artist`, `title` and the listener-id header are treated as data, and the table survives
- one listener can't read or clear another listener's vote

**Rate limiting.** The ratings endpoints are limited per client address (`app/src/rateLimit.js`: 120 reads and 20 votes per minute, in memory; `RATE_LIMIT_READ`, `RATE_LIMIT_WRITE`, `RATE_LIMIT_WINDOW_MS` change them, `TRUST_PROXY` says which peers may set `X-Forwarded-For`). The security tests start two extra servers with tiny limits (ports 3102 and 3103, database `radiozk_test_security_rl`) and give each simulated client its own address through `X-Forwarded-For`; they check the 429 with `Retry-After`, separate read and write budgets, per-address isolation, that one address cannot stuff a track, that a client of a server that trusts no proxy cannot forge its address, and that the health check is exempt. The Docker smoke test checks the same through the real nginx: forged `X-Forwarded-For` values must not buy extra votes (nginx overwrites the header).

**Known, accepted gap.** A vote is tied only to a random id the client chooses and to an IP address, so many distinct addresses can still inflate one track (distributed ballot stuffing). One test named `KNOWN GAP` pins that. If you add stronger protection (accounts, proof of work), that test will fail: change it to assert the new protection and remove the gap from this list.

Not covered: image scanning (Trivy), static analysis (CodeQL), HTTP security headers on nginx (CSP, `X-Content-Type-Options`, etc.), and TLS, which the Docker setup leaves to a proxy in front.

## Known gaps

- Safari/iOS native HLS playback is not tested; it needs a Mac or iPhone.
- Audible output is not tested.
- The playback hook (`useRadioStream`) and `NowPlaying` are covered only by the e2e script, not by unit tests.
- Rate limits are per address and in memory: they reset when the API restarts, and they do not stop an attacker who rotates addresses. Behind a second proxy (for example a TLS terminator in front of nginx) every client shares that proxy's address unless the proxy passes the real one on.
