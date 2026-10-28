# radiozk

A local prototype web radio player for the public [Radio Calico](https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8) lossless HLS stream, with a "Now playing" panel and listener thumbs up/down ratings stored in your own database.

It is a development prototype, not a production service. Everything runs as the current user from the project directory: no root, no system services, no Docker.

## Features

- **Lossless playback**: plays the FLAC variant of the HLS stream, with AAC as a manual choice and as an automatic fallback when the browser can't decode FLAC.
- **Browser support**: Safari/iOS use native HLS; other browsers use [hls.js](https://github.com/video-dev/hls.js).
- **Now playing**: current track, cover art, quality badge (bit depth / sample rate), recently played list, and Media Session integration (lock-screen / media-key metadata).
- **Ratings**: thumbs up/down per track, stored in PostgreSQL. Listeners are anonymous (a random UUID kept in `localStorage`).

## Stack

| Layer | Technology |
|---|---|
| Front end | Vite, React 19, TypeScript, Tailwind CSS v4, React Router, hls.js |
| API | Node.js 24, Express 5, `pg` |
| Database | PostgreSQL 18 |
| Web server | nginx (static files + `/api` reverse proxy) |
| Tests | `node:test` (API, validation, parser), Vitest + Testing Library (UI), Playwright + Firefox (end-to-end), GitHub Actions CI |

## Architecture

```
browser ──> nginx :8080 ──> static files from www/     (SPA fallback to index.html)
                      └──> /api/*  proxied to Node :3000 ──> PostgreSQL :5433
dev:  browser ──> Vite :5173 ──(proxies /api)──> Node :3000
```

```
app/      Express API (src/server.js, src/db.js, src/routes/ratings.js) and its tests
web/      Vite + React front end, parser tests, Playwright e2e script
bin/      helper scripts (env, start/stop, build, tests, psql)
dev/      nginx config template and runtime state (git-ignored)
www/      production build output (generated, git-ignored)
```

## Getting started

### Toolchain

The scripts expect Node, nginx and PostgreSQL under a git-ignored `.local/` directory (extracted `.deb` packages and the Node tarball). **Nothing recreates `.local/` automatically**, so on a fresh clone you must either:

- provide those binaries in `.local/` the same way, or
- install Node 24, nginx and PostgreSQL 18 yourself and adjust the paths in `bin/env.sh` (and the `mime.types` lookup in `bin/start.sh`).

All ports and database credentials are defined once in `bin/env.sh`.

### Run

In a fresh shell, load the environment first (shell state doesn't persist between commands):

```sh
source bin/env.sh

# install dependencies
(cd app && npm install)
(cd web && npm install)

bin/start.sh     # start PostgreSQL and nginx (idempotent)
bin/build.sh     # build the front end into www/
bin/app.sh       # start the API (foreground, auto-reload)
```

Then open <http://localhost:8080>.

For front-end development with hot reload, run `bin/web.sh` and open <http://localhost:5173> (it proxies `/api` to the Node API).

Stop the database and web server with `bin/stop.sh`.

### Ports

| Service | Port |
|---|---|
| nginx | 8080 |
| Node API | 3000 |
| Vite dev server | 5173 |
| PostgreSQL | 5433 (database, user and password all `radiozk`, localhost only) |

## Scripts

| Task | Command |
|---|---|
| Start / stop PostgreSQL + nginx | `bin/start.sh` / `bin/stop.sh` |
| API with auto-reload | `bin/app.sh` |
| Vite dev server | `bin/web.sh` |
| Production build | `bin/build.sh` |
| Type check | `cd web && npm run typecheck` |
| SQL shell | `bin/psql.sh` |
| Unit and API tests | `bin/test.sh` |
| End-to-end tests | `cd web && npm run e2e` |

## Testing

Full details are in [README-TESTING.md](README-TESTING.md); in short:

- `bin/test.sh` runs everything except the browser e2e test:
  - backend (`app/`): pure unit tests of the request validation, plus black-box API tests that spawn the real server on port 3100 against a throwaway `radiozk_test` database (PostgreSQL must be running);
  - frontend (`web/`): metadata parser tests and Vitest + Testing Library tests of the rating UI (`RatingButtons`, `api.ts`, `listenerId.ts`).
- Each suite has its own script: `npm run test:unit` / `test:api` in `app/`, `npm run test:parser` / `test:ui` in `web/`.
- GitHub Actions (`.github/workflows/test.yml`) type-checks, builds and runs these suites on every push to `main` and on pull requests, against a Postgres service container.
- `npm run e2e` (in `web/`) drives headless Firefox through Playwright against <http://localhost:8080>: page render, FLAC and AAC playback, ratings, routing. It needs nginx, PostgreSQL and the API running, plus a current build in `www/`. It casts real votes, so clean up afterwards:

  ```sh
  bin/psql.sh -c 'truncate ratings'
  ```

  The machine has no audio device, so the e2e test shows that audio decodes and advances in real time, not that it is audible.

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness and database check |
| GET | `/api/ratings?artist=&title=` | Up/down counts and the caller's vote (`X-Listener-Id` header) |
| POST | `/api/ratings` | Body `{ artist, title, value }` with `value` of `1`, `-1` or `0` (clear) |

A track is identified by its lower-cased `artist|title` with whitespace collapsed, so a differently titled release of the same song (for example "(2006 Remaster)") counts as a separate track.

## Known limitations

- Ratings are anonymous and spoofable: there is no IP or fingerprint binding and no rate limiting. Votes are lost if the browser's storage is cleared.
- Safari/iOS native HLS playback has not been tested.
- The first play rebuffers for about 2 seconds before settling at real time.
- The brand style guide is not applied to the UI yet.

## Third-party content

The stream, metadata and cover art belong to Radio Calico and are used read-only from their public CloudFront host. This project does not call their ratings endpoint and does not probe their hosts beyond what they publish. Check that embedding their stream is permitted before going beyond a local prototype.
