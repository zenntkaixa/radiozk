#!/usr/bin/env bash
# Unit/API tests for app/ and web/. Needs PostgreSQL running (bin/start.sh). The e2e browser test is separate: `npm run e2e` in web/.
set -e
source "$(dirname "$0")/env.sh"
(cd "$PROJECT/app" && npm test)
(cd "$PROJECT/web" && npm test)
