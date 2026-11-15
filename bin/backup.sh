#!/usr/bin/env bash
# Dump a PostgreSQL database (meant for the Neon one behind the API) to dev/backups/radiozk-<time>.sql.gz.
# You run it, with your own connection string: it is read from BACKUP_DATABASE_URL, or asked for (hidden) in a
# terminal, and it is never printed or written anywhere. Restore: see "Backups" in README.md.
set -euo pipefail
source "$(dirname "$0")/env.sh"
# env.sh points the PG* variables at the local dev database; only the URL below may decide where we connect.
unset PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD

URL=${BACKUP_DATABASE_URL:-}
if [ -z "$URL" ]; then
  [ -t 0 ] || { echo "Set BACKUP_DATABASE_URL, or run this from a terminal to be asked for it." >&2; exit 1; }
  read -rsp "Connection string (hidden): " URL
  echo
fi
case $URL in postgres://* | postgresql://*) ;; *) echo "That is not a postgres:// or postgresql:// URL." >&2; exit 1 ;; esac

umask 077 # the dump holds listener ids
dir="$PROJECT/dev/backups"
mkdir -p "$dir"
out="$dir/radiozk-$(date +%Y%m%d-%H%M%S).sql.gz"
tmp="$out.part"
trap 'rm -f "$tmp"' EXIT # a failed dump leaves nothing behind

# Plain SQL, no owners or grants (the restore target has its own role). pipefail makes a pg_dump failure fail the script.
pg_dump --no-owner --no-privileges --dbname="$URL" | gzip > "$tmp"
# An empty or wrong database still "succeeds", so check that the table we care about is in there.
gzip -dc "$tmp" | grep -q '^CREATE TABLE public.ratings ' || { echo "The dump has no ratings table: wrong database?" >&2; exit 1; }

mv "$tmp" "$out"
echo "Wrote $out ($(du -h "$out" | cut -f1))"
