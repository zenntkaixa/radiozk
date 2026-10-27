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
export GIT_EXEC_PATH="$LOCAL_ROOT/usr/lib/git-core"
export GIT_TEMPLATE_DIR="$LOCAL_ROOT/usr/share/git-core/templates"
export PATH="$PATH:$LOCAL_ROOT/usr/bin"  # last: its psql/pg_* wrappers must not shadow the real ones
export MANPATH="$LOCAL_ROOT/usr/share/man${MANPATH:+:$MANPATH}"
