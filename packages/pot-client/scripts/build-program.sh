#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Build a copy: SOL-002 may export IDL but must not modify the program worktree.
mkdir -p .local/programs/village-pot/src
cp ../../programs/{Anchor.toml,Cargo.toml,Cargo.lock} .local/programs/
cp ../../programs/village-pot/Cargo.toml .local/programs/village-pot/
cp ../../programs/village-pot/src/lib.rs .local/programs/village-pot/src/
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
export NO_DNA=1
(cd .local/programs && anchor build --ignore-keys)
cp .local/programs/target/idl/village_pot.json idl/village_pot.json
