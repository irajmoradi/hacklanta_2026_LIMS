# FIX-015 — Missing villager bodies

Branch: `fix/FIX-015`. Implementation commit: `50d339f`. The subsequent verification commit contains this report and the browser evidence.

## Cause and fix

This was a cached skinning-bounds failure, not a torso-item requirement. `geometryPoints` called `updateWorldMatrix`, which updates transforms but bypasses `SkinnedMesh.updateMatrixWorld` and its bind-inverse refresh. It refreshed only accepted meshes afterward. During generated-head fitting, the torso and legs were therefore left with stale bind inverses at the villager's town position. A pointer raycast before the next render computed and cached their bounding spheres in the wrong coordinate frame. Subsequent renders corrected the vertices but retained the bad spheres, culling the body while leaving the generated head and hat visible.

The fix synchronizes the root's ancestors, then updates the entire subtree through `updateMatrixWorld` before measuring selected geometry. It preserves normal frustum culling, materials, outfit visibility, and animation behavior.

The unit regression failed on the original implementation: the torso's actual world-space box intersected the camera frustum, but its cached sphere did not. A browser-only replay of the original implementation also reproduces the missing body using Lance's real generated head, `#ccc0bc` shirt, Festival Hat, dog, and no torso item. All six torso/leg checks (front and side) fail culling before the fix and pass afterward.

## Files

- `src/scene/headFit.ts`: production transform synchronization.
- `src/scene/bodyVisibility.test.ts`, `tests/bodyVisibility.ts`, `package.json`: failing-before/passing-after regression and shared visible-body measurements, included in the normal test command.
- `tests/fix008-review.ts`, `tests/fix008.spec.ts`: production emote rig preparation, real avatar palettes, non-origin placement, pre-render raycast, body and culling guards, explicit no-outfit and Lance loadout rows, and dog rendering.
- `tests/fix015.spec.ts`, `playwright.fix015.config.ts`: real-head before/after replay and GET-only live-town validation/screenshots.
- `artifacts/fix015/`: before/after measurements, screenshots, and compact matrix summary. Large reproducible contact sheets and full matrix report remain locally available under `matrix/` and are gitignored.

## Verification

Commands run from `apps/web` unless noted. Final results:

| Command | Result | Exit |
| --- | --- | --- |
| `bun test src/scene/bodyVisibility.test.ts` on original code | Expected failure: torso incorrectly culled | 1 |
| `bun test src/scene/bodyVisibility.test.ts src/scene/generatedHead.test.ts src/scene/cosmeticAssets.test.ts src/scene/emotes.test.ts` | 21 passed | 0 |
| `bun run test` | 150 passed, 68,941 assertions | 0 |
| `bun run typecheck` | Passed | 0 |
| `bun run build` | Passed; existing large-chunk advisory | 0 |
| `$env:FIT_MATRIX_OUTPUT='artifacts/fix015/matrix'; node node_modules/@playwright/test/cli.js test --config playwright.fix008.config.ts` | 1,836 combinations, zero failures, all 725 factor pairs covered per avatar | 0 |
| `$env:FIX015_BASELINE='1'; node node_modules/@playwright/test/cli.js test --config playwright.fix015.config.ts -g 'pre-render pointer'` | Old-code replay reproduces six culled body parts | 0 |
| `node node_modules/@playwright/test/cli.js test --config playwright.fix015.config.ts` | Before-render guard and five-villager live-town test passed | 0 |
| `git diff --check` (repository root) | Passed | 0 |

The matrix covers 306 combinations each for Iraj, Lance, Stefanny, Maya, Mario, and the preset head. Every combination has visible base torso, left leg, and right leg; combined world-space height is 100% of the corresponding bare-body baseline (required minimum 80%). The baseline compares torso-and-leg geometry to the same geometry without equipment, excluding heads and pets. Both front and side frustum checks pass. There are no browser errors.

An early matrix run was interrupted by Vite reloading while the fix was edited (exit 1); the completed final run supersedes it. Early live-town attempts that intercepted/normalized village responses stalled and were stopped (exit 1). The final test passes with GET responses unmodified. No API mutations, generation calls, transactions, or live debug actions were sent.

## Screenshots and trying it

- `artifacts/fix015/before-lance.png`: original implementation, head/hat/dog but no body.
- `artifacts/fix015/after-lance.png`: same real loadout, complete body.
- `artifacts/fix015/town-all-five.png`: normal live town.
- `artifacts/fix015/town-lineup.png`: owned clones of all five town avatars staged locally for a clear view, left to right Iraj, Lance, Stefanny, Maya, Mario. Only the test browser scene/camera/labels change. No world state is saved.
- `artifacts/fix015/town-bodies.json`: actual town body measurements before staging. An avatar intentionally hidden by the gaming activity is temporarily exposed only for body inspection, then restored; the lineup exposes everyone.
- `artifacts/fix015/matrix/summary.json`: committed compact results. Full per-combination measurements and contact sheets are regenerated by the matrix command.

With the existing API on `:8010`, set `VILLAGE_ENV_FILE` to the shared env file if public settings are needed, then run the final browser command above. The config starts real-mode Vite on `:5298`. To replay the old bug, set `FIX015_BASELINE=1` and select only `pre-render pointer`; clear that variable for normal verification. The replay changes the served module only within its test browser.

For manual review, run `bun run dev --port 5298` in real demo mode, select a demo seat, and inspect Lance at home. Move the pointer over villagers as generated heads arrive, then zoom/orbit: bodies remain present. Fixture/preset heads remain covered by the matrix and normal unit suite. The test runner uses the existing reduced-quality setting for the town capture to avoid software-rendered shadow overhead.

No blockers or proposed contract changes. No files outside `apps/web` remain changed; no secrets or source head assets were copied.
