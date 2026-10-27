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

There are **no tests and no linter**; the type check (run as part of the build) is the only automated check. Verify changes by building and hitting the endpoints with `curl`.

Ports: nginx 8080, Node API 3000, Vite 5173, PostgreSQL 5433 (DB/user/password all `radiozk`, localhost only).

Background servers: run `bin/app.sh` with `nohup ... > dev/app.log 2>&1 &`, and kill by pid or an anchored pattern; a plain `pkill -f` pattern can match your own shell command.

## Architecture

```
browser ──> nginx :8080 ──> static files from www/     (SPA fallback to index.html)
                      └──> /api/*  proxied to Node :3000 ──> PostgreSQL :5433
dev:  browser ──> Vite :5173 ──(proxies /api)──> Node :3000
```

- `web/` — Vite + React 19 + TypeScript + Tailwind v4 + React Router. `vite build` writes to `../www/` (generated and git-ignored; never edit it). The Radio page is lazy-loaded so `hls.js` (~500 kB) stays out of the main bundle. Imports use explicit `.ts`/`.tsx` extensions (`allowImportingTsExtensions`).
- `app/` — Express (ES modules). `src/db.js` owns the pg pool and `migrate()`, which runs `create table if not exists` on every startup; there is no migration tool, so schema changes must be written idempotently there. `src/server.js` holds all routes.
- `dev/nginx/nginx.conf` is a template; `bin/start.sh` fills in the mime-types and root paths and writes `nginx.generated.conf` (ignored). nginx logs, temp dirs and `dev/pgdata/` are runtime state and ignored.

### The stream and metadata (external, read-only)

All on `https://d3d4yli4hf5bmh.cloudfront.net` with open CORS:

- `/hls/live.m3u8` → variants `flac_hires.m3u8` (CMAF/fMP4, FLAC) and `aac_hifi.m3u8` (AAC, MPEG-TS).
- `/metadatav2.json` — current track plus `prev_artist_1..5`/`prev_title_1..5` and `is_new`/`is_summer`/`is_vidgames` flags (meaning unknown; unused). Served as `application/octet-stream`, cached 10 s, string values contain stray whitespace. `/cover.jpg` is the current cover, overwritten in place.
- Bit depth/sample rate vary per track (seen 16/44.1 and 24/48), so don't hard-code quality labels.

`web/src/components/RadioPlayer.tsx`: Safari/iOS use native HLS; everywhere else `hls.js`. hls.js would ABR-pick AAC (higher declared bandwidth), so the FLAC level is pinned explicitly on `MANIFEST_PARSED`, with AAC as an explicit user choice and automatic fallback when the browser can't decode FLAC. Loading is manual (`autoStartLoad: false`): `startLoad(-1)` on play, `stopLoad()` on pause, so resuming joins the live edge. `web/src/nowPlaying.ts` polls the metadata (pausing while the tab is hidden) and normalizes whitespace; it is shared by the player (media session) and `NowPlaying.tsx`.

### Ratings

Thumbs up/down per track, stored in our own `ratings` table (primary key `(track_key, listener_id)`). `track_key` is lower-cased `artist|title` with whitespace collapsed, so a differently-titled release of the same song (e.g. "(2006 Remaster)") is a separate track. Listeners are anonymous: the browser keeps a random UUID in `localStorage` and sends it as `X-Listener-Id`. This is deliberately not hardened (no IP/fingerprint binding, no rate limit); that was discussed and postponed.

## Gotchas

- `bin/start.sh` / `bin/stop.sh` verify via `/proc/<pid>/comm` that the pid in nginx's pid file is really nginx before signalling it. After a reboot the stale pid can belong to an unrelated process; an earlier version signalled it. Keep that check.
- The Radio Calico stream and site belong to a third party. Don't call their `wp-json/ThumbsRatings/v1/ratings` endpoint (it writes to their system), and don't probe their hosts beyond what they publish.
- `RadioCalico*.png`, `RadioCalicoStyle.zip`, `RadioCalico_Style_Guide.txt` and `stream_URL.txt` in the repo root are the user's brand assets, intentionally **untracked**; don't `git add -A` them. The style guide (palette, typography) has not been applied to the UI yet.
- Git identity comes from `~/.gitconfig`; `origin` is `git@github.com:zenntkaixa/radiozk.git` over SSH, branch `main`. Commits end with the `Co-Authored-By` trailer given in the session's attribution reminder.
