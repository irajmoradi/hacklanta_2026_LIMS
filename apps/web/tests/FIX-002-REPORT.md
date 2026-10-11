# FIX-002 verification

Branch: `fix/FIX-002`. Implementation commits: `368b352` (pot client),
`4671d6d` (HUD and automatic install), `c60e90a` (scene fixture and wallet docs).

## Changes

- QA4-B01: `.scene { isolation: isolate }` contains all projected HTML in the
  scene's stacking context, beneath sibling HUD controls. Label buttons remain
  interactive. Regression tests position a real label over My profile and verify
  HUD input, then verify label selection in clear scene space using mouse and
  touch at 1280x900 and 390x844. The original mobile recording case also passes.
- QA4-B02: `apps/web` postinstall runs the wallet island's locked
  `npm ci --prefix src/components/pot --install-links --no-audit --no-fund`.
  This retains React 18 for R3F and React 19 for the wallet. Both READMEs explain
  prerequisites and refreshing the copied pot client after source changes.
- QA4-B03: exported the current Anchor IDL and ran Codama. The default program
  and PDA helpers now use `4m7xFhBQcWfa7u3kP8i78QaTYjkQXSxt5iUfj2689Ehu`.
  The LiteSVM lifecycle test also asserts that exact default address.
- Scene browser mocks now forward JSON request bodies, including presence
  heartbeats, as described by QA-004's harness correction.

Files changed:

```text
apps/web/package.json
apps/web/README.md
apps/web/src/styles.css
apps/web/src/components/pot/README.md
apps/web/tests/village.spec.ts
apps/web/tests/scene.spec.ts
apps/web/tests/FIX-002-REPORT.md
packages/pot-client/README.md
packages/pot-client/idl/village_pot.json
packages/pot-client/src/generated/programs/villagePot.ts
packages/pot-client/src/generated/pdas/pot.ts
packages/pot-client/src/generated/pdas/vault.ts
packages/pot-client/tests/pot.test.ts
```

## Validation

Windows Bun 1.3.11, Node 24.20.0, npm 11.19.0; Linux Bun 1.3.11 under
Ubuntu-24.04 WSL. Commands below ran from `apps/web` unless specified otherwise.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install` | 0 | Automatic wallet dependency install completed |
| `bun run build` | 0 | TypeScript and production Vite bundle passed |
| `bun test src` | 0 | 59 passed, 2,993 assertions |
| `bun run typecheck` | 0 | Includes new browser regressions |
| `bunx playwright test --workers=1` | 0 | 37 passed, including desktop/touch overlap and native mobile recording |
| Fresh clone: `bun install`, then `bun run build` | 0 each | No preexisting node_modules, no manual wallet install, lockfiles unchanged |
| Fresh clone: `bunx playwright test --config tests/web012.config.ts --workers=1` | 0 | 10 passed, 1 existing flag-off-only skip; all 5 flag-on cases and actual wallet hooks passed |
| `bunx playwright test --config tests/web014.config.ts --workers=1` | 0 | 6 passed, including forced offline social flows |
| `bunx playwright test --config tests/scene.config.spec.ts --workers=1` | 0 | 4 passed; day/night fallback, late assets, locked buildings |
| `git diff --check` | 0 | No whitespace errors |

Fresh clone created using `git clone --no-hardlinks --branch fix/FIX-002 .
apps/web/test-results/fix002-clean` at commit `4671d6d`. It is retained under the
ignored test-output directory, entirely within the allowed web path.

Pot validation used the existing build at
`C:/Users/mourn/Downloads/hacklanta/programs`. Before reuse, compared all five
program source/configuration files against this checkout, normalizing only CRLF:
`Cargo.toml`, `Cargo.lock`, `Anchor.toml`, `village-pot/Cargo.toml`, and
`village-pot/src/lib.rs`. Copied its IDL and binary into the client IDL and ignored
`.local/programs/target/deploy` paths. Binary SHA-256:
`9ec3129e493c9aa9f8e3a1152a99ede620eff2e1de1e0989677438d7d43875fc`.

From `packages/pot-client` in WSL, using the Linux Bun executable at
`/mnt/c/Users/mourn/Downloads/hl-sol2/packages/pot-client/.local/bun/package/bin/bun`:

- `bun install --frozen-lockfile`: exit 0.
- `bun run generate`: exit 0; Codama output matches current Anchor IDL.
- `bun node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `bun test`: exit 0; all 19 passed, 156 assertions, including all LiteSVM cases.

Initial WSL launch attempts failed from Windows/bash quoting and a CRLF in a
temporary runner, before completing the suite. Corrected invocations above passed.
No failing assertion was skipped or weakened.

## Try it and evidence

From `apps/web`, run `bun install`, `bun run build`, and the browser commands
above. For interactive offline testing, set `VITE_MOCK=1`, run `bun run dev`,
and open the displayed URL at 390x844. My profile works without moving the camera;
villager labels remain selectable wherever visible outside the HUD.

For a fresh program build and complete client check, use
`bash scripts/check.sh` from `packages/pot-client` in Linux/WSL with Bun, Anchor,
Rust, and the Solana SBF toolchain installed. It builds only locally.

Visually inspected screenshots (relative to the worktree; ignored, retained):

- Mobile: `apps/web/test-results/e2e/village-touch-labels-HUD-w-3b0fd-villagers-remain-selectable-mock/hud-labels.png`.
- Wallet: `apps/web/test-results/fix002-clean/apps/web/tests/artifacts/web012-wallet-review.png`.
- Desktop: `apps/web/test-results/e2e/village-desktop-labels-HUD-3f881-villagers-remain-selectable-mock/hud-labels.png`.

No secrets were required or copied. No live provider, GPU, API mutation, or devnet
transaction was used. All signing in tests uses emulator signers or mocked wallets.
Shared seeded live-browser suites were not run; these checks use offline fixtures
and contract mocks. Vite's existing large-chunk warning remains informational.
No contract changes are proposed; no FIX-002 blockers remain.
