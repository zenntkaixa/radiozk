#!/usr/bin/env bash
source "$(dirname "$0")/env.sh"
nginx -p "$PROJECT/dev/nginx" -c nginx.generated.conf -s quit 2>/dev/null
pg_ctl stop -m fast 2>/dev/null
echo stopped
