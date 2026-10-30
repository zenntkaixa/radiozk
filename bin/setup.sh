#!/usr/bin/env bash
# Recreate the git-ignored .local/ toolchain on a fresh clone, without root:
#   - Node from the official tarball (checksum-verified against nodejs.org's SHASUMS256.txt)
#   - nginx and PostgreSQL from Ubuntu/Debian packages, downloaded with apt-get and unpacked into .local/root
#   - the PostgreSQL data directory (dev/pgdata, trust auth on localhost, as start.sh expects)
#   - npm dependencies of app/ and web/
# Idempotent: every step is skipped when its result is already there. --force redoes the toolchain steps.
#
# Needs: Linux x86_64, an Ubuntu/Debian host with PostgreSQL 18 available to apt and a current package index
# (`sudo apt-get update` once, if nobody has done it), tzdata, curl, xz and dpkg-deb. libatomic1 (needed by Node) is
# downloaded along with nginx and PostgreSQL when the host lacks it. Nothing is installed system-wide.
# Bump NODE_VERSION together with the Dockerfile NODE_IMAGE, both node-version entries in ci.yml and @types/node.
set -euo pipefail

NODE_VERSION=26.13.0
PG_MAJOR=18

source "$(dirname "$0")/env.sh"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1
say() { printf '\n==> %s\n' "$*"; }
die() { echo "setup: $*" >&2; exit 1; }

[ "$(uname -s)" = Linux ] && [ "$(uname -m)" = x86_64 ] || die "only Linux x86_64 is supported (bin/env.sh hardcodes x86_64-linux-gnu)"
for tool in curl tar xz dpkg-deb apt-get sha256sum; do command -v "$tool" >/dev/null || die "missing tool: $tool"; done
[ -d /usr/share/zoneinfo ] || die "tzdata is missing (PostgreSQL needs it): sudo apt-get install tzdata"
mkdir -p "$PROJECT/.local"

# --- Node ---
if [ "$FORCE" = 0 ] && [ -x "$PROJECT/.local/node/bin/node" ] && [ "$("$PROJECT/.local/node/bin/node" -v)" = "v$NODE_VERSION" ]; then
  say "Node v$NODE_VERSION already installed"
else
  say "Node v$NODE_VERSION"
  DL="$PROJECT/.local/node-dl"; mkdir -p "$DL"
  TARBALL="node-v$NODE_VERSION-linux-x64.tar.xz"
  curl -fsSL -o "$DL/SHASUMS256-v$NODE_VERSION.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  [ -f "$DL/$TARBALL" ] || curl -fSL -o "$DL/$TARBALL" "https://nodejs.org/dist/v$NODE_VERSION/$TARBALL"
  (cd "$DL" && grep " $TARBALL\$" "SHASUMS256-v$NODE_VERSION.txt" | sha256sum -c -) || { rm -f "$DL/$TARBALL"; die "checksum mismatch for $TARBALL (deleted); run again"; }
  rm -rf "$PROJECT/.local/node" && mkdir "$PROJECT/.local/node"
  tar -xJf "$DL/$TARBALL" -C "$PROJECT/.local/node" --strip-components=1
fi

# --- nginx + PostgreSQL ---
if [ "$FORCE" = 0 ] && [ -x "$PGBIN/pg_ctl" ] && [ -x "$LOCAL_ROOT/usr/sbin/nginx" ]; then
  say "nginx and PostgreSQL $PG_MAJOR already unpacked"
else
  say "nginx and PostgreSQL $PG_MAJOR (apt-get download, unpacked into .local/root)"
  # A simulated install lists exactly the packages this host lacks (no root needed); libraries it already has are reused.
  PKGS=$(apt-get -s install --no-install-recommends nginx "postgresql-$PG_MAJOR" "postgresql-client-$PG_MAJOR" libatomic1 \
    | awk '/^Inst / { print $2 }') || true
  [ -n "$PKGS" ] || die "apt cannot resolve nginx and postgresql-$PG_MAJOR (not Ubuntu/Debian, or no package index: run 'sudo apt-get update')"
  DEBS="$PROJECT/.local/debs"; rm -rf "$DEBS"; mkdir -p "$DEBS"  # fresh, so only the versions just downloaded match
  echo "$PKGS" | tr '\n' ' '; echo
  (cd "$DEBS" && apt-get download $PKGS)
  rm -rf "$LOCAL_ROOT" && mkdir -p "$LOCAL_ROOT"
  for deb in $(printf '%s\n' $PKGS | while read -r p; do ls "$DEBS/${p}_"*.deb; done); do dpkg-deb -x "$deb" "$LOCAL_ROOT"; done
fi
[ -x "$PGBIN/pg_ctl" ] && [ -x "$LOCAL_ROOT/usr/sbin/nginx" ] || die "nginx or PostgreSQL binaries missing under .local/root"

# --- PostgreSQL data directory (start.sh creates the radiozk role and database) ---
if [ -f "$PGDATA/PG_VERSION" ]; then
  say "PostgreSQL data directory already initialised"
else
  say "Initialising $PGDATA"
  mkdir -p "$(dirname "$PGDATA")"
  initdb -D "$PGDATA" -U postgres --auth=trust --encoding=UTF8 >/dev/null
fi

# --- npm dependencies ---
for dir in app web; do
  if [ "$FORCE" = 0 ] && [ -d "$PROJECT/$dir/node_modules" ]; then
    say "$dir/node_modules already installed"
  else
    say "npm ci in $dir/"
    (cd "$PROJECT/$dir" && npm ci)
  fi
done

say "Done"
echo "node:       $(node -v)"
echo "nginx:      $(nginx -v 2>&1)"
echo "PostgreSQL: $(postgres --version 2>/dev/null || "$PGBIN/postgres" --version)"
echo
echo "Next: bin/start.sh && bin/build.sh, then bin/app.sh (see README). For the e2e test also run: (cd web && npx playwright install firefox)"
