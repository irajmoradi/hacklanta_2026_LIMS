#!/usr/bin/env bash
# Linux-only test copy: no generated client/IDL changes outside tests/.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
target="$root/tests/.runtime/pot-client"
mkdir -p "$target/.local/programs/target/deploy"
cp "$root/packages/pot-client/"{package.json,bun.lock,tsconfig.json} "$target/"
cp -R "$root/packages/pot-client/"{src,tests,idl} "$target/"
# Reuse an existing build only after checking the program source and manifests.
: "${QA_POT_BUILD:?Set QA_POT_BUILD to an existing .local/programs build directory}"
for file in Cargo.toml Cargo.lock Anchor.toml village-pot/Cargo.toml village-pot/src/lib.rs; do
  test -f "$root/programs/$file"
  test -f "$QA_POT_BUILD/$file"
  # Windows checkouts may differ only by CRLF. Compare every source byte after
  # line-ending normalization; program IDs and all configuration still must match.
  cmp <(sed 's/\r$//' "$root/programs/$file") <(sed 's/\r$//' "$QA_POT_BUILD/$file")
done
cp "$QA_POT_BUILD/target/deploy/village_pot.so" "$target/.local/programs/target/deploy/"
sha256sum "$target/.local/programs/target/deploy/village_pot.so"
cd "$target"
"${QA_BUN:-bun}" install --frozen-lockfile
"${QA_BUN:-bun}" test
