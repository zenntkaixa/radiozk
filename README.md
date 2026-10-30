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

A fuller diagram of the system (browser, nginx, API, PostgreSQL, the Radio Calico CDN, dev mode and CI) is in [`docs/architecture.mmd`](docs/architecture.mmd), in [Mermaid](https://mermaid.js.org/) format. It does not render inside this README: open the file in a Mermaid-compatible viewer to see it, for example paste its contents into the online editor at <https://mermaid.live>, or use a Mermaid preview extension in your editor.

The browser talks to the Radio Calico CDN directly for the stream, metadata and cover; only ratings go through our API. Dotted lines exist in development only.

```
app/      Express API (src/server.js, src/db.js, src/routes/ratings.js) and its tests
web/      Vite + React front end, parser tests, Playwright e2e script
bin/      helper scripts (env, start/stop, build, tests, psql)
docs/     architecture diagram (Mermaid, docs/architecture.mmd)
dev/      nginx config template and runtime state (git-ignored)
www/      production build output (generated, git-ignored)
```

## Getting started

### Toolchain

The scripts expect Node, nginx and PostgreSQL under a git-ignored `.local/` directory. On a fresh clone, create it with:

```sh
bin/setup.sh      # or: make setup
```

It needs no root. It downloads Node 26 from nodejs.org (checksum-verified), downloads nginx and PostgreSQL 18 with `apt-get download` and unpacks them into `.local/root`, initialises the database directory (`dev/pgdata`), and runs `npm ci` in `app/` and `web/`. It is idempotent (re-running skips what is there; `--force` redoes the toolchain) and prints the installed versions at the end. Requirements: Linux x86_64 on Ubuntu or Debian with PostgreSQL 18 available to apt (Ubuntu 26.04 has it), a current package index (`sudo apt-get update` once, if nobody has done it), `tzdata`, `curl`, `xz` and `dpkg-deb`. On any other system, install Node 26, nginx and PostgreSQL 18 yourself and adjust the paths in `bin/env.sh` (and the `mime.types` lookup in `bin/start.sh`).

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

## Docker

The project also ships as containers, so it can run without the `.local/` toolchain. There are two releases:

| | Production (`compose.yaml`) | Development (`compose.dev.yaml`) |
|---|---|---|
| Services | PostgreSQL 18, API (Node 26, non-root, read-only filesystem), nginx serving the built front end and proxying `/api` | PostgreSQL 18, API with `node --watch`, Vite dev server with HMR |
| Source | baked into the images | bind-mounted from `app/` and `web/` |
| Published | web only, on `127.0.0.1:8080` | web 5173, API 3000, PostgreSQL 5433 (all on loopback) |
| Data | named volume `pgdata` | named volume `pgdata` |

**Production**

```sh
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose up -d --build
```

Open <http://localhost:8080>. In `.env`, `WEB_BIND=0.0.0.0` exposes it on every interface (put a TLS proxy in front; the app has no TLS or auth), `WEB_PORT` changes the port, and `TAG` tags the `radiozk-api` / `radiozk-web` images (e.g. a release version). `docker compose down` keeps the data; `down -v` deletes it.

**Development**

```sh
docker compose -f compose.dev.yaml up --build
docker compose -f compose.dev.yaml exec api npm test   # API tests against the container's database
docker compose -f compose.dev.yaml exec web npm test
```

After changing `package.json` or a lockfile, add `--build -V` so the `node_modules` volumes are renewed. Port 5433 clashes with the rootless PostgreSQL from `bin/start.sh`; stop one of them.

`bin/docker-smoke.sh` builds the production images, starts them on a throwaway project, checks the endpoints, a vote round trip and recovery after a database restart, then tears everything down. CI runs it.

## Scripts

| Task | Command |
|---|---|
| Create the `.local/` toolchain (fresh clone) | `bin/setup.sh` (or `make setup`) |
| Start / stop PostgreSQL + nginx | `bin/start.sh` / `bin/stop.sh` |
| API with auto-reload | `bin/app.sh` |
| Vite dev server | `bin/web.sh` |
| Production build | `bin/build.sh` |
| Type check | `cd web && npm run typecheck` |
| SQL shell | `bin/psql.sh` |
| Unit and API tests | `bin/test.sh` (or `make test`) |
| Dependency audit + security tests | `make security` |
| End-to-end tests | `cd web && npm run e2e` |

## Testing

Full details are in [README-TESTING.md](README-TESTING.md); in short:

- `bin/test.sh` runs everything except the browser e2e test:
  - backend (`app/`): pure unit tests of the request validation, plus black-box API tests that spawn the real server on port 3100 against a throwaway `radiozk_test` database (PostgreSQL must be running);
  - frontend (`web/`): metadata parser tests and Vitest + Testing Library tests of the rating UI (`RatingButtons`, `api.ts`, `listenerId.ts`).
- Each suite has its own script: `npm run test:unit` / `test:api` in `app/`, `npm run test:parser` / `test:ui` in `web/`.
- GitHub Actions (`.github/workflows/ci.yml`) type-checks, builds and runs these suites on every push to `main` and `develop` and on pull requests, against a Postgres service container.
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

- Ratings are anonymous and only lightly protected: votes are limited per IP address (120 reads and 20 votes a minute, in memory), which stops casual flooding but not an attacker who rotates addresses. Votes are lost if the browser's storage is cleared. If you put a TLS proxy in front of nginx, every client shares its address unless it forwards the real one (see `TRUST_PROXY` in `app/src/rateLimit.js`).
- Playback is tested in Firefox and Chromium (Playwright, headless). Safari/iOS native HLS playback has not been tested.
- The first play rebuffers for about 2 seconds before settling at real time.
- The brand style guide is not applied to the UI yet.

## Third-party content

The stream, metadata and cover art belong to Radio Calico and are used read-only from their public CloudFront host. This project does not call their ratings endpoint and does not probe their hosts beyond what they publish. Check that embedding their stream is permitted before going beyond a local prototype.
