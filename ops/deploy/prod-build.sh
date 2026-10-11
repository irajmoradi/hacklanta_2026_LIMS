#!/usr/bin/env bash
# Build only: no secrets, services, symlinks, DB provisioning, or Caddy changes.
set -euo pipefail
release=${1:?release directory}
export PATH=/opt/village/prod-tools/node/bin:/opt/village/prod-tools/bun/bin:/opt/village/prod-tools/uv:$PATH
IFS= read -r VITE_AUTH0_DOMAIN
IFS= read -r VITE_AUTH0_CLIENT_ID
IFS= read -r VITE_AUTH0_AUDIENCE
IFS= read -r VITE_AUTH0_ENABLED || VITE_AUTH0_ENABLED=0
[[ $VITE_AUTH0_ENABLED = 0 || $VITE_AUTH0_ENABLED = 1 ]]
[[ -n $VITE_AUTH0_DOMAIN && -n $VITE_AUTH0_CLIENT_ID && -n $VITE_AUTH0_AUDIENCE ]]
runuser -u village-prod -- env PATH="$PATH" VILLAGE_ENV_FILE=/dev/null VITE_MOCK=0 VITE_DEMO_AUTH=1 \
  VITE_AUTH0_DOMAIN="$VITE_AUTH0_DOMAIN" VITE_AUTH0_CLIENT_ID="$VITE_AUTH0_CLIENT_ID" VITE_AUTH0_AUDIENCE="$VITE_AUTH0_AUDIENCE" VITE_AUTH0_ENABLED="$VITE_AUTH0_ENABLED" \
  bash -ec 'cd "$1/apps/web"; bun install --frozen-lockfile; bun run build' _ "$release"
runuser -u village-prod -- env PATH="$PATH" VILLAGE_ENV_FILE=/dev/null \
  bash -ec 'cd "$1/apps/api"; uv sync --frozen --python /usr/bin/python3.12; cd ../imessage; bun install --frozen-lockfile' _ "$release"
