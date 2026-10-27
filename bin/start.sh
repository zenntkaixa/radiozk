#!/usr/bin/env bash
set -e
source "$(dirname "$0")/env.sh"
mkdir -p "$PROJECT/dev/nginx/logs" "$PROJECT/dev/nginx/tmp"
# PostgreSQL (localhost only; socket in dev/)
if ! pg_ctl status >/dev/null 2>&1; then
  pg_ctl start -w -l "$PROJECT/dev/postgres.log" -o "-p $PGPORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=$PROJECT/dev"
fi
if ! psql -U postgres -d postgres -tAc "select 1 from pg_roles where rolname='radiozk'" | grep -q 1; then
  psql -U postgres -d postgres -qc "create role radiozk login password 'radiozk' createdb"
  createdb -U postgres -O radiozk radiozk
fi
# nginx
MIME=$(ls "$LOCAL_ROOT"/etc/nginx/mime.types)
sed -e "s|MIMETYPES|$MIME|" -e "s|WWWROOT|$PROJECT/www|" -e "s|NGINX_PORT|$NGINX_PORT|" -e "s|APP_PORT|$APP_PORT|" \
  "$PROJECT/dev/nginx/nginx.conf" > "$PROJECT/dev/nginx/nginx.generated.conf"
if nginx_running; then
  nginx_ctl -s reload
else
  nginx_ctl -e "$PROJECT/dev/nginx/logs/error.log"
fi
echo "web:      http://localhost:$NGINX_PORT"
echo "database: postgresql://radiozk:radiozk@127.0.0.1:$PGPORT/radiozk"
