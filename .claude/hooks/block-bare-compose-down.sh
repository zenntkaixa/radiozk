#!/usr/bin/env bash
# PreToolUse hook for Bash: refuse `docker compose down -v` unless the same
# command names a compose project other than the production one (`radiozk`).
# A bare `down -v` here resolves to the production project and deletes its
# database volume. Exit 2 blocks the call and shows the message to the model.
cmd=$(jq -r '.tool_input.command // empty')
[ -n "$cmd" ] || exit 0

compose='(docker[[:space:]]+compose|docker-compose)'
echo "$cmd" | grep -Eq "$compose" || exit 0
echo "$cmd" | grep -Eq '(^|[[:space:];&|(])down([[:space:]]|$)' || exit 0
echo "$cmd" | grep -Eq '(^|[[:space:]])(-[a-zA-Z]*v[a-zA-Z]*|--volumes)([[:space:]]|$)' || exit 0

name=$(echo "$cmd" | grep -Eo 'COMPOSE_PROJECT_NAME=[^[:space:]]+|(-p|--project-name)[ =][^[:space:]]+' | head -n1 | sed -E 's/^(COMPOSE_PROJECT_NAME=|-p[ =]|--project-name[ =])//; s/["'"'"']//g')
if [ -n "$name" ] && [ "$name" != radiozk ]; then
  exit 0
fi

echo "Blocked: 'docker compose down -v' without a non-production project name. In this directory it targets the production project 'radiozk' and deletes the radiozk_pgdata volume. Name the throwaway project in the same command, e.g. COMPOSE_PROJECT_NAME=radiozk-e2e TAG=e2e WEB_PORT=18081 POSTGRES_PASSWORD=x docker compose down -v (see 'Agent contract' in CLAUDE.md)." >&2
exit 2
