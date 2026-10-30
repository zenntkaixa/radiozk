#!/usr/bin/env bash
# Smoke-test the production Docker release: build, start, hit the real endpoints through nginx, tear down.
# Needs only docker (no bin/env.sh). Uses its own project name, port and throwaway volume.
set -euo pipefail
cd "$(dirname "$0")/.."
export COMPOSE_PROJECT_NAME=radiozk-smoke POSTGRES_PASSWORD=smoke-test WEB_PORT=${WEB_PORT:-18080}
BASE="http://127.0.0.1:$WEB_PORT"
trap 'docker compose logs --tail=30 >&2 || true; docker compose down -v >/dev/null 2>&1' ERR
trap 'docker compose down -v >/dev/null 2>&1' EXIT

docker compose up -d --build --wait --wait-timeout 120

check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected '$2', got '$3'" >&2; exit 1; fi
}
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "index"                200 "$(status "$BASE/")"
check "SPA fallback"         200 "$(status "$BASE/about")"
check "api health via nginx" 200 "$(status "$BASE/api/health")"
# `compose port` prints ":0" for a port that is not published
published() { local p; p=$(docker compose port "$@" 2>/dev/null || true); [ -z "$p" ] || [ "$p" = ":0" ] && echo no || echo yes; }
check "api not published"    no "$(published api 3000)"
check "db not published"     no "$(published db 5432)"

L=$(cat /proc/sys/kernel/random/uuid)
vote=$(curl -s -X POST "$BASE/api/ratings" -H "x-listener-id: $L" -H 'content-type: application/json' \
  -d '{"artist":"Smoke","title":"Test","value":1}')
check "vote round trip"      '{"up":1,"down":0,"mine":1}' "$vote"
check "bad request rejected" 400 "$(status -X POST "$BASE/api/ratings" -H 'content-type: application/json' -d '{}')"

docker compose restart db >/dev/null
docker compose up -d --wait --wait-timeout 60 >/dev/null
for i in $(seq 1 20); do [ "$(status "$BASE/api/health")" = 200 ] && break; sleep 1; done
after=$(curl -s "$BASE/api/ratings?artist=Smoke&title=Test" -H "x-listener-id: $L")
check "vote survives db restart" '{"up":1,"down":0,"mine":1}' "$after"
# nginx must follow the api container when it is recreated (new address), not keep a stale one
docker compose up -d --force-recreate --no-deps --wait --wait-timeout 60 api >/dev/null
check "proxy follows recreated api" 200 "$(status "$BASE/api/health")"
echo "docker smoke test passed"
