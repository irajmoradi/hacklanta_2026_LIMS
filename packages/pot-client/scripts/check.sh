#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v bun >/dev/null 2>&1; then
  task_bun="$(command -v bun)"
elif [ -x .local/bun/package/bin/bun ]; then
  task_bun="$PWD/.local/bun/package/bin/bun"
else
  echo 'Install Bun in this Linux/WSL environment, then rerun scripts/check.sh.' >&2
  exit 1
fi
export PATH="$(dirname "$task_bun"):$PATH"
"$task_bun" install --frozen-lockfile
bash scripts/build-program.sh
"$task_bun" run generate
"$task_bun" run typecheck
"$task_bun" test
