#!/usr/bin/env bash
# Dependency audit for app/ and web/ (dev dependencies included). Fails on high or critical advisories; lower
# severities are reported but do not fail. Works with the project toolchain or with any node/npm on PATH (CI).
set -uo pipefail
cd "$(dirname "$0")/.."
[ -d .local ] && source bin/env.sh
LEVEL=${AUDIT_LEVEL:-high}
status=0
for dir in app web; do
  echo "== npm audit ($dir, fail on $LEVEL and above)"
  (cd "$dir" && npm audit --audit-level="$LEVEL") || status=1
done
exit $status
