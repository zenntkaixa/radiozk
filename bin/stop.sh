#!/usr/bin/env bash
source "$(dirname "$0")/env.sh"
NGINX_PID=$(cat "$PROJECT/dev/nginx/logs/nginx.pid" 2>/dev/null); [ "$(cat "/proc/$NGINX_PID/comm" 2>/dev/null)" = nginx ] && nginx -p "$PROJECT/dev/nginx" -c nginx.generated.conf -s quit
pg_ctl stop -m fast 2>/dev/null
echo stopped
