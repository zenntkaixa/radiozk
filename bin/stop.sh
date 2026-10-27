#!/usr/bin/env bash
source "$(dirname "$0")/env.sh"
if nginx_running; then nginx_ctl -s quit; fi
pg_ctl stop -m fast 2>/dev/null
echo stopped
