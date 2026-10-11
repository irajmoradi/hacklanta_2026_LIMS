#!/usr/bin/env bash
# Compatibility entrypoint: preparation and activation share one deployment lock.
set -euo pipefail
exec python3 "$(dirname "$0")/prod-release.py" "$@"
