#!/usr/bin/env bash
# Smoke-test the production Docker release: build, start, hit the real endpoints through nginx, tear down.
# Needs only docker (no bin/env.sh). Uses its own project name, port and throwaway volume.
set -euo pipefail
cd "$(dirname "$0")/.."
# TAG=smoke keeps the images off the production names (radiozk-api:latest), which a real deployment may be using.
export COMPOSE_PROJECT_NAME=radiozk-smoke POSTGRES_PASSWORD=smoke-test TAG=smoke WEB_PORT=${WEB_PORT:-18080}
BASE="http://127.0.0.1:$WEB_PORT"
cleanup() { docker compose down -v >/dev/null 2>&1; docker image rm radiozk-api:smoke radiozk-web:smoke >/dev/null 2>&1 || true; }
trap 'docker compose logs --tail=30 >&2 || true; cleanup' ERR
trap cleanup EXIT

docker compose up -d --build --wait --wait-timeout 120

check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected '$2', got '$3'" >&2; exit 1; fi
}
status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "index"                200 "$(status "$BASE/")"
check "SPA fallback"         200 "$(status "$BASE/about")"
check "api health via nginx" 200 "$(status "$BASE/api/health")"
# Security headers must reach every kind of response: page, hashed asset, API, and an error (add_header in a location
# replaces inherited ones, and without `always` nginx skips error responses).
header() { curl -s -D - -o /dev/null "$2" | tr -d '\r' | awk -v h="$1" 'tolower($1) == tolower(h ":") { $1 = ""; print substr($0, 2) }'; }
ASSET=$(curl -s "$BASE/" | grep -o '/assets/[^"]*\.js' | head -1)
for url in "$BASE/" "$BASE$ASSET" "$BASE/api/health" "$BASE/assets/missing.js"; do
  check "nosniff on ${url#$BASE}"  nosniff "$(header X-Content-Type-Options "$url")"
  check "CSP on ${url#$BASE}"      yes "$(header Content-Security-Policy "$url" | grep -q "frame-ancestors 'none'" && echo yes || echo no)"
done
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
# Rate limiting through the real stack. The API was just recreated, so its counters are empty. nginx overwrites
# X-Forwarded-For, so forged addresses must not buy extra votes: 30 votes with 30 different forged addresses still hit 429.
limited=0
for i in $(seq 1 30); do
  [ "$(status -X POST "$BASE/api/ratings" -H "x-listener-id: $(cat /proc/sys/kernel/random/uuid)" -H "x-forwarded-for: 203.0.113.$i" \
    -H 'content-type: application/json' -d '{"artist":"Smoke","title":"Flood","value":1}')" = 429 ] && limited=$((limited + 1))
done
check "forged X-Forwarded-For does not dodge the rate limit" yes "$([ "$limited" -ge 5 ] && echo yes || echo "no ($limited of 30 limited)")"
echo "docker smoke test passed"
