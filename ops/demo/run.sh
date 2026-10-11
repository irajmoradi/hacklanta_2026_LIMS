#!/usr/bin/env bash
set -euo pipefail
# Invoke from apps/web through ops/remote_run.sh --with-api.
: "${VILLAGE_API_URL:?A disposable API is required}"
export VITE_MOCK=1 VITE_DEMO_AUTH=1 VILLAGE_ENV_FILE=/dev/null
bunx vite build --outDir ../../ops/demo/artifacts/build
if [[ "${1:-}" == '--all' ]]; then
  node ../../ops/demo/record.mjs --rehearse
  node ../../ops/demo/record.mjs
else
  node ../../ops/demo/record.mjs "$@"
fi
