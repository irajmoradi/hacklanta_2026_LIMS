#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
export NO_DNA=1
if [ -d "$HOME/.nvm/versions/node/v22.23.2/bin" ]; then
  export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
fi
cd "$(dirname "$0")"
case "${1:-all}" in
  inspect) anchor --version; solana --version; rustc --version; node --version; npm --version ;;
  build) anchor build --ignore-keys ;;
  install) npm install --no-audit --no-fund ;;
  test) npm ci --no-audit --no-fund; npm test ;;
  all) anchor build --ignore-keys; npm ci --no-audit --no-fund; npm test ;;
  *) echo 'Usage: check.sh [inspect|install|build|test|all]' >&2; exit 2 ;;
esac
