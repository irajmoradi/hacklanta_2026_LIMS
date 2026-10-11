#!/usr/bin/env bash
# Owner-run devnet deployment of programs/village-pot (see docs/solana/README.md).
# Run inside WSL:  bash /mnt/c/Users/mourn/Downloads/hacklanta/ops/deploy_devnet.sh
# It builds + tests, prints the program id, fee payer, balance and size, then asks you to type DEPLOY.
set -euo pipefail
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
export NO_DNA=1
for d in "$HOME/.nvm/versions/node"/*/bin; do [ -d "$d" ] && export PATH="$d:$PATH"; done
cd "$(dirname "$0")/../programs"

URL=https://api.devnet.solana.com
WALLET="$HOME/.config/solana/id.json"
anchor keys sync >/dev/null
PROGRAM_ID=$(anchor keys list | awk '/village_pot/ {print $2}')
grep -q '^\[programs.devnet\]' Anchor.toml || printf '\n[programs.devnet]\nvillage_pot = "%s"\n' "$PROGRAM_ID" >> Anchor.toml
anchor build
npm ci --no-audit --no-fund >/dev/null && npm test

SO=target/deploy/village_pot.so
echo
echo "Cluster:        devnet ($URL)"
echo "Program id:     $PROGRAM_ID"
echo "Fee payer:      $(solana address -k "$WALLET")  balance: $(solana balance -k "$WALLET" --url $URL)"
echo "Program size:   $(stat -c %s "$SO") bytes  (rent ~ $(solana rent "$(( $(stat -c %s "$SO") * 2 ))" --url $URL | head -1))"
echo "Upgrade auth:   fee payer wallet"
read -r -p "Type DEPLOY to send the devnet deployment transactions: " ok
[ "$ok" = "DEPLOY" ] || { echo "Aborted."; exit 1; }
solana program deploy --url $URL --keypair "$WALLET" --program-id target/deploy/village_pot-keypair.json "$SO"
echo "VITE_SOLANA_PROGRAM_ID=$PROGRAM_ID   # add to the repo-root .env, then rebuild the web app"
