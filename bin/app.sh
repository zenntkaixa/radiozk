#!/usr/bin/env bash
# Run the Node app in the foreground with auto-reload (Ctrl-C to stop).
source "$(dirname "$0")/env.sh"
cd "$PROJECT/app" && exec npm run dev
