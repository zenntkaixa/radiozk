#!/usr/bin/env bash
# Build the React app into www/ so nginx serves it at http://localhost:8080.
source "$(dirname "$0")/env.sh"
cd "$PROJECT/web" && npm run build
