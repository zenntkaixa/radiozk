#!/usr/bin/env bash
# Vite dev server with hot reload at http://localhost:5173 (proxies /api to the Node app).
source "$(dirname "$0")/env.sh"
cd "$PROJECT/web" && exec npm run dev
