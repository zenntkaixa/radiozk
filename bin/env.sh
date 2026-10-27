# Sourced by the other scripts. Project-local nginx + PostgreSQL (no root needed).
export PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export LOCAL_ROOT="$PROJECT/.local/root"
export PGBIN="$LOCAL_ROOT/usr/lib/postgresql/18/bin"
export LD_LIBRARY_PATH="$LOCAL_ROOT/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PATH="$PROJECT/.local/node/bin:$PGBIN:$LOCAL_ROOT/usr/sbin:$PATH"
export PGDATA="$PROJECT/dev/pgdata"
export PGHOST=127.0.0.1
export PGPORT=5433
export PGUSER=radiozk
export PGDATABASE=radiozk
export PGPASSWORD=radiozk
export NGINX_PORT=8080
export APP_PORT=3000

# --- nginx helpers (shared by start.sh and stop.sh) ---
nginx_ctl() { nginx -p "$PROJECT/dev/nginx" -c nginx.generated.conf "$@"; }
# The pid file survives reboots, so a stale pid may belong to an unrelated process.
# Only treat nginx as running (and safe to signal) if that pid is really an nginx process.
nginx_running() {
  local pid
  pid=$(cat "$PROJECT/dev/nginx/logs/nginx.pid" 2>/dev/null) || return 1
  [ "$(cat "/proc/$pid/comm" 2>/dev/null)" = nginx ]
}
