# Testing

How the tests are organised, how to run them, and how to add new ones. For setting up the project itself, see [README.md](README.md).

## Layers

| Layer | Where | Tool | Needs | Speed |
|---|---|---|---|---|
| Backend unit | `app/test/validate.test.js` | `node:test` | nothing | milliseconds |
| Backend API (integration) | `app/test/ratings.test.js` | `node:test` | PostgreSQL | seconds |
| Frontend parser | `web/test/nowPlaying.test.mjs` | `node:test` | nothing | milliseconds |
| Frontend UI | `web/test/*.test.{ts,tsx}` | Vitest + Testing Library + jsdom | nothing | seconds |
| End-to-end | `web/e2e/radio.mjs` | Playwright, headless Firefox | the whole stack running, a current build | about a minute |

Current counts: 28 backend (10 unit + 18 API), 8 parser, 28 UI, 18 e2e checks.

The first four layers run in CI. The e2e layer does not: it needs the real stream and a full local stack.

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
| Backend coverage report | `cd app && npm run test:coverage` |
| Frontend, all (parser + UI) | `cd web && npm test` |
| Frontend parser only | `cd web && npm run test:parser` |
| Frontend UI only | `cd web && npm run test:ui` |
| One backend test by name | `cd app && node --test --test-name-pattern='<text>' 'test/*.test.js'` |
| One UI test file | `cd web && npx vitest run test/RatingButtons.test.tsx` |
| Vitest watch mode | `cd web && npx vitest` |
| Type check (includes `web/test/`) | `cd web && npm run typecheck` |

Use globs such as `'test/*.test.js'` rather than a directory: `node --test test/` fails on Node 24.

### End-to-end

```sh
bin/start.sh && bin/build.sh        # stack up, current build in www/
bin/app.sh                          # in another terminal, or in the background
cd web && npm run e2e               # optional URL argument, default http://localhost:8080
bin/psql.sh -c 'truncate ratings'   # clean up afterwards
```

It checks page render, FLAC and AAC playback advancing in real time, ratings (including persistence across a reload) and routing. It casts real votes in your development database, hence the cleanup step. It uses Playwright's bundled Firefox from `~/.cache/ms-playwright`. The test machine has no audio device, so it proves that audio decodes and advances, not that it is audible.

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

### Frontend parser: `web/test/nowPlaying.test.mjs`

Tests `parse()` from `web/src/nowPlaying.ts`, which normalises the station's `metadatav2.json` (stray whitespace, previous-tracks list). Node strips the TypeScript types, so no build step is needed.

### Frontend UI: `web/test/*.test.{ts,tsx}`

Vitest with jsdom; configuration is in `web/vitest.config.ts` and shared setup in `web/test/setup.ts`. It only picks up `test/**/*.test.{ts,tsx}`, so the `.mjs` parser tests and the e2e script are left to their own runners.

- `RatingButtons.test.tsx`: loading placeholders, optimistic update then adopting the server counts, buttons disabled while saving, moving and clearing votes, rollback with an alert on failure, and ignoring save or load responses that arrive after the track changed. `api.ts` is mocked, and promises are resolved by hand to observe in-flight state.
- `api.test.ts`: request URLs, the `x-listener-id` header, POST bodies and error mapping, with `fetch` stubbed.
- `listenerId.test.ts`: UUID generation and persistence, behaviour when storage is blocked, and the fallback when `crypto.randomUUID` is missing. The module caches state, so each test loads a fresh copy.
- `rating.test.ts`: `applyVote` as a pure function.

## Writing new tests

- Put logic that needs no I/O in a pure module (like `app/src/validate.js` and `web/src/rating.ts`) and unit-test it directly. Reach for the API or UI layer only for behaviour that needs a server or a DOM.
- API tests go through HTTP, not through imported server code. Use a fresh random track and listener (`randomUUID()`) per test.
- UI tests should find elements by role and accessible name (`getByRole('button', { name: ... })`), as users do, not by class names.
- Don't hit the real station from automated tests other than the e2e script, and never call their ratings endpoint.
- Check that a new test can fail: break the code under test on purpose and confirm the test goes red. This is how the suites were validated.

## Continuous integration

`.github/workflows/test.yml` runs on pushes to `main` and on pull requests:

1. `npm ci` in `app/` and `web/`
2. `npm run build` in `web/` (type check, which includes the tests, plus the production build)
3. `npm test` in `app/`, against a `postgres:18` service container
4. `npm test` in `web/`

The other two workflows in `.github/workflows/` belong to the Claude GitHub App (PR assistant and code review) and don't run the test suites.

## Known gaps

- Safari/iOS native HLS playback is not tested; it needs a Mac or iPhone.
- Audible output is not tested.
- The playback hook (`useRadioStream`) and `NowPlaying` are covered only by the e2e script, not by unit tests.
- Ratings are not hardened against abuse, so there are no tests for rate limiting or spoofing.
