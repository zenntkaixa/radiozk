# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local prototype of a web radio player for the Radio Calico public stream: React front end, a small Express + PostgreSQL API, and nginx in front. Everything runs as the current user from this directory (no root, no system services, no Docker).

## Environment (read this first)

The toolchain is **not installed system-wide**. Node, nginx and PostgreSQL live in the git-ignored `.local/` (extracted `.deb` packages and the Node tarball); `sudo` is unavailable. In a fresh shell, `node`, `npm`, `psql`, `nginx` are not on PATH until you run:

```
source bin/env.sh
```

Shell state does not persist between tool calls, so source it in the same command (`source bin/env.sh && npm ...`). `env.sh` also holds the ports and DB credentials. Nothing recreates `.local/` automatically; a fresh clone would need those downloaded again.

## Commands

| Task | Command |
|---|---|
| Start nginx + PostgreSQL (idempotent; reloads nginx if running) | `bin/start.sh` |
| Stop nginx + PostgreSQL | `bin/stop.sh` |
| Node API, auto-reload (foreground) | `bin/app.sh` (`app/`, `npm run dev`) |
| Vite dev server with HMR (foreground) | `bin/web.sh` → http://localhost:5173 |
| Production build into `www/` | `bin/build.sh` (`npm run build` = `tsc && vite build`) |
| Type check only | `cd web && npm run typecheck` |
| SQL shell | `bin/psql.sh` (e.g. `bin/psql.sh -c '\dt'`) |

There is no linter. Checks available:

- Type check (runs as part of the build).
- `bin/test.sh` — runs the `app/` and `web/` suites (also what CI runs, see the `test` job in `.github/workflows/ci.yml`, which uses a Postgres service container and `ADMIN_DATABASE_URL`). Backend, in `app/` (`node:test`): `test/validate.test.js` (pure unit tests of `src/validate.js`, no DB; `npm run test:unit`) and `test/ratings.test.js` (black-box API tests; spawns the real server on port 3100 against a throwaway `radiozk_test` database, so PostgreSQL must be running; `npm run test:api`). Frontend, in `web/`: `test/nowPlaying.test.mjs` (`node:test` tests of the metadata `parse()`; Node strips the TS types; `npm run test:parser`) and `test/*.test.{ts,tsx}` (Vitest + Testing Library + jsdom, config in `vitest.config.ts`: `RatingButtons`, `api.ts`, `listenerId.ts`, `applyVote`; `npm run test:ui`). Run one backend test with `node --test --test-name-pattern='<text>' 'test/*.test.js'`, one UI file with `npx vitest run test/<file>`. `npm run test:coverage` in `app/` prints coverage. Rating logic that needs no I/O lives in pure modules (`app/src/validate.js`, `web/src/rating.ts`) so it can be unit-tested without a server or browser.
- Security: `make security` = `bin/audit.sh` (`npm audit` in `app/` and `web/`, fails on high; CI: the `audit` job in `ci.yml`, also run weekly) + `app/test/security.test.js` (`npm run test:security`; own port 3101 and database `radiozk_test_security`, shared server bootstrap in `app/test/helpers.js`). The `Makefile` only wraps `bin/` scripts (`make` lists targets). Rate limiting / IP binding are deliberately absent and pinned by two `KNOWN GAP` tests; when you add protection, update those tests. Dependabot targets `develop`.
- Test docs for humans live in `README-TESTING.md` (layers, commands, how to write tests); keep it in step with this section when the suites change.
- `cd web && npm run e2e` — Playwright script `web/e2e/radio.mjs` that drives headless Firefox against http://localhost:8080 (override with an argument): page render, FLAC/AAC playback advancing in real time, ratings, routing. Needs nginx, Postgres and the API running (`bin/start.sh` + `bin/app.sh`) and the current build in `www/` (`bin/build.sh`). It casts real votes, so run `bin/psql.sh -c 'truncate ratings'` afterwards. Uses Playwright's bundled Firefox (`~/.cache/ms-playwright`), not the system one; there is no audio device, so it proves decoding/advancing, not audible output.
- Otherwise verify by building and hitting endpoints with `curl`.

Playwright MCP: a `playwright` MCP server (`@playwright/mcp@0.0.83`, Firefox, headless) is registered in the user's local Claude config (not in the repo; re-add with `claude mcp add playwright --scope local ...`, see `claude mcp get playwright`). Its Playwright version needs Firefox build 1553, separate from the 1555 build used by `npm run e2e`; both live in `~/.cache/ms-playwright`. Its snapshots/screenshots go to `dev/playwright-mcp/` (ignored). Tools appear after a Claude Code restart.

Ports: nginx 8080, Node API 3000, Vite 5173, PostgreSQL 5433 (DB/user/password all `radiozk`, localhost only). `NGINX_PORT`/`APP_PORT`/`PG*` are defined once in `bin/env.sh`: `start.sh` templates them into the nginx config and the Vite proxy reads `APP_PORT`. The e2e default URL and the API tests' port 3100 are separate.

On first play the stream rebuffers for ~2 s before settling at real time (status briefly flips Live → Buffering…); the e2e test allows for it. The live media timeline doesn't start at 0, so judge playback by elapsed `currentTime`, not its absolute value.

Background servers: run `bin/app.sh` with `nohup ... > dev/app.log 2>&1 &`, and kill by pid or an anchored pattern; a plain `pkill -f` pattern can match your own shell command.

## Architecture

```
browser ──> nginx :8080 ──> static files from www/     (SPA fallback to index.html)
                      └──> /api/*  proxied to Node :3000 ──> PostgreSQL :5433
dev:  browser ──> Vite :5173 ──(proxies /api)──> Node :3000
```

- `web/` — Vite + React 19 + TypeScript + Tailwind v4 + React Router. `vite build` writes to `../www/` (generated and git-ignored; never edit it). The Radio page is the home page (`/`; `/radio` redirects there) and is lazy-loaded so `hls.js` (~500 kB) stays out of the main bundle. Imports use explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions`).
- `app/` — Express (ES modules). `src/db.js` owns the pg pool and `migrate()`, which runs `create table if not exists` on every startup; there is no migration tool, so schema changes must be written idempotently there. `src/server.js` wires up the app and `/api/health`; feature routes live in `src/routes/` (currently only `ratings.js`, mounted at `/api/ratings`).
- `dev/nginx/nginx.conf` is a template; `bin/start.sh` fills in the mime-types, root path and both ports and writes `nginx.generated.conf` (ignored). nginx logs, temp dirs and `dev/pgdata/` are runtime state and ignored.

### The stream and metadata (external, read-only)

All on `https://d3d4yli4hf5bmh.cloudfront.net` with open CORS:

- `/hls/live.m3u8` → variants `flac_hires.m3u8` (CMAF/fMP4, FLAC) and `aac_hifi.m3u8` (AAC, MPEG-TS).
- `/metadatav2.json` — current track plus `prev_artist_1..5`/`prev_title_1..5` and `is_new`/`is_summer`/`is_vidgames` flags (meaning unknown; unused). Served as `application/octet-stream`, cached 10 s, string values contain stray whitespace. `/cover.jpg` is the current cover, overwritten in place.
- Bit depth/sample rate vary per track (seen 16/44.1 and 24/48), so don't hard-code quality labels.

`web/src/components/RadioPlayer.tsx`: Safari/iOS use native HLS; everywhere else `hls.js`. hls.js would ABR-pick AAC (higher declared bandwidth), so the FLAC level is pinned explicitly on `MANIFEST_PARSED`, with AAC as an explicit user choice and automatic fallback when the browser can't decode FLAC. Loading is manual (`autoStartLoad: false`): `startLoad(-1)` on play, `stopLoad()` on pause, so resuming joins the live edge. `web/src/nowPlaying.ts` polls the metadata (pausing while the tab is hidden) and normalizes whitespace; it is shared by the player (media session) and `NowPlaying.tsx`.

### Ratings

Thumbs up/down per track, stored in our own `ratings` table (primary key `(track_key, listener_id)`). `track_key` is lower-cased `artist|title` with whitespace collapsed, so a differently-titled release of the same song (e.g. "(2006 Remaster)") is a separate track. Listeners are anonymous: the browser keeps a random UUID in `localStorage` and sends it as `X-Listener-Id`. This is deliberately not hardened (no IP/fingerprint binding, no rate limit); that was discussed and postponed.

## Gotchas

- `nginx_running` / `nginx_ctl` in `bin/env.sh` (used by `start.sh` and `stop.sh`) verify via `/proc/<pid>/comm` that the pid in nginx's pid file is really nginx before signalling it. After a reboot the stale pid can belong to an unrelated process; an earlier version signalled it. Never signal the pid file's pid without that check.
- The Radio Calico stream and site belong to a third party. Don't call their `wp-json/ThumbsRatings/v1/ratings` endpoint (it writes to their system), and don't probe their hosts beyond what they publish.
- `RadioCalico*.png`, `RadioCalicoStyle.zip`, `RadioCalico_Style_Guide.txt` and `stream_URL.txt` in the repo root are the user's brand assets, intentionally **untracked**; don't `git add -A` them. The style guide (palette, typography) has not been applied to the UI yet.
- Git identity comes from `~/.gitconfig`; `origin` is `git@github.com:zenntkaixa/radiozk.git` over SSH, branch `main`. Commits end with the `Co-Authored-By` trailer given in the session's attribution reminder.
- Before pushing, `git fetch --all --prune` and pull so local branches are on the latest commit and nothing conflicts later (the user's standing rule). Commit and push only when asked.
- GitHub: `gh` is installed and authenticated as `zenntkaixa` (scopes include `workflow`, needed to create files under `.github/workflows/`). `.github/workflows/` holds our `ci.yml` (jobs `test`, `audit`, `docker`, plus a `ci` gate job that is green only when the others pass; the weekly schedule runs only `audit`; token is read-only) plus `claude.yml` and `claude-code-review.yml` from the Claude GitHub App (PR assistant and review; they don't run tests). `/install-github-app` creates a branch per run, so repeat runs leave stray `add-claude-github-actions-*` branches.
- Vitest must stay on a release compatible with Vite 8 (currently 5.x); Vitest 3 bundled Vite 7 and broke `tsc` on `vitest.config.ts`.
- Docker (alongside, not instead of, the `.local/` setup): `Dockerfile` has targets `api`/`web` (prod) and `dev-api`/`dev-web`; `compose.yaml` is the production stack (db + api + nginx `web`, only `web` published, needs `POSTGRES_PASSWORD` from `.env`) and `compose.dev.yaml` the dev stack (bind mounts, HMR, ports 5173/3000/5433 on loopback; 5433 clashes with the rootless Postgres). `bin/docker-smoke.sh` is the end-to-end check and runs in CI (`docker` job in `ci.yml`). `HOST` (API bind address), `VITE_HOST` and `API_URL` (Vite) exist for the containers. The prod nginx template re-resolves `api` via Docker's DNS (`RESOLVER`); `pool.on('error')` in `db.js` keeps the API alive across a PostgreSQL restart. Dependency installs in the Dockerfile run as `node`, otherwise the dev `node_modules` volumes are root-owned and Vitest can't write its cache. The web image checks that `rolldown` loads right after `npm ci`, because npm can exit 0 while skipping its native binding (npm/cli#4828) and Docker would cache the broken layer; if a build fails with "Cannot find native binding", rebuild with `--no-cache`.
