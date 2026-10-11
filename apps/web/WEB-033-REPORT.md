# WEB-033 ? Rectangular town, larger map

Branch: `web/WEB-033`. Implementation commit: `62b5702`. QA evidence and this report are committed separately.

Restored straight, axis-aligned streets and pedestrian lanes, exact rectangular parcels, consistent setbacks, and south-facing houses (yaw 0). Removed the two cul-de-sacs, diagonal park shortcuts, coordinate bends, lot jitter, and irregular lawn outlines. The same street points drive merged pavement and the routing graph.

Preserved the 146 ? 146 starter footprint (1.584? the former 116 ? 116 area), 21m pitch, paddock space, seeded house-slot allocation, sparse reservations, append-only neighborhood growth, ASSET-009 vegetation/garden variety, eastern creek and park lake, camera bounds, merged surfaces, static building batching and instancing. Rectangular lawns are 15 ? 15m. All homes face south to retain the existing entrance side and avoid changing attachment conventions. Alternating road and pedestrian-lane widths remain unchanged.

## Files changed

- `src/scene/layout/streets.ts`, `town.ts`: grid streets and lot placement.
- `src/scene/TownSurfaces.tsx`: rectangular lawns and removal of turning-circle geometry.
- `src/scene/GridTown.tsx`: scene group name.
- `src/scene/layout/navigation.ts`, `src/scene/playerControl.ts`: updated comments; existing routing/control behavior retained.
- `src/scene/layout/town.test.ts`, `src/scene/playerControl.test.ts`: grid, clearance, connectivity, growth, and control regression coverage.
- `playwright.web033.config.ts`, `tests/web033.spec.ts`: paired fixture browser QA with native GPU measurement and explicit 55 FPS assertion for hardware after-captures.
- `artifacts/web033/*`: before/after overview, street, fallback, mobile screenshots and renderer measurements.
- `WEB-033-REPORT.md`: this report.

All edits are under `apps/web`. No secrets, environment files, API code, contracts or paid generation were used. Browser checks use fixture avatars and require neither the API nor GPU worker.

## Verification

- `bun install --frozen-lockfile`: exit 0.
- `bun run test`: exit 0; 131 tests, 64,262 assertions across 33 files.
- `bun run typecheck`: exit 0.
- `bun run build`: exit 0; existing large-chunk warning remains.
- Baseline: `$env:VILLAGE_BROWSER_GPU='hardware'; $env:WEB033_STAGE='before'; bunx playwright test --config playwright.web033.config.ts`: exit 0, one smoke passed.
- `$env:VILLAGE_BROWSER_GPU='hardware'; bunx playwright test --config playwright.web019.config.ts`: exit 0; all 10 WEB-017/WEB-019 interaction tests passed, including drag-to-ride, WASD, offline controls and civic drops.
- `$env:VILLAGE_BROWSER_GPU='hardware'; $env:WEB033_STAGE='after'; bunx playwright test --config playwright.web033.config.ts --headed`: exit 1 solely on the 55 FPS assertion; measured 44.5 FPS, all functional assertions completed.
- `git diff --check`: exit 0.
- Initial after-capture, same command with stage `after`, before adding the strict FPS assertion: exit 0, one smoke passed.

Tests assert all lot entrances are reachable across seeds and expanding/sparse membership, axis-aligned nonzero street segments, exact setbacks, stable homes, disjoint conservative lot envelopes, pavement clearance against house collision envelopes, study/pet/idle destinations, WASD collision and drag target routing. The first clearance assertion used an inflated 5.5m envelope plus pavement width, which falsely rejected reserved-lot entrances; it now uses the actual 5.35m collision half-width plus pavement half-width. The initial browser adaptation expected ?Demo? instead of ?Demo village?; corrected before baseline capture. Initial setup attempts failed because the worktree had no dependencies and one `bunx --cwd` invocation was invalid; installation and running from `apps/web` resolved both.

## Visual evidence and performance

Screenshots: `artifacts/web033/{before,after}-{overview,street,fallback,mobile}.png`. Visually reviewed the overview comparison, aligned houses and streets, rectangular lawns, fallback geometry and mobile rendering. Mobile dashboard obstruction is existing UI behavior outside this map task.

The hardware renderer reports NVIDIA GeForce RTX 5090 via ANGLE D3D11, viewport 1440 ? 1000. Baseline: 52.0 FPS. Initial after-sample: 50.1 FPS while a production build ran concurrently; retained as `after-concurrent-build-performance.json`. Standalone headless repeat with the strict assertion: exit 1, 33.3 FPS / 66.7ms p95; functional assertions passed. Retained as `after-headless-performance.json`.

Both initial captures recorded 1,205 draw calls, 660 meshes and 18 instanced meshes with adaptive shadows disabled. No batching code was removed.

## Try it

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev
```

Choose a demo seat. Inspect the larger rectangular map, pan/zoom/reset, walk with WASD, change idle activity in Settings, or hold your villager and drop onto an unlocked attraction. For browser QA run the WEB-033 Playwright command above. No external env file is needed in fixture mode; Vite retains its existing runtime support for `VILLAGE_ENV_FILE` when using live mode.

## Remaining acceptance blocker

The >=55 FPS requirement is **not met** on this shared RTX 5090 host: the final headed run measured 44.5 FPS / 34.8ms p95 (`after-performance.json`). The standalone headless run measured 33.3 FPS; initial before/after samples measured 52.0/50.1 FPS. These are distinct runs, not a controlled proof of a performance regression or improvement. No other host processes were stopped, and no quality or asset settings were changed to manufacture a passing result. The WEB-033 hardware test intentionally remains failing until this is resolved.

The requested grid behavior is implemented and all interaction regressions pass. Whole-app optimization is assigned separately to PERF-002; integrate that work and rerun this strict hardware check before accepting the performance criterion. No claim of full task acceptance is made. No functional blockers or proposed contract changes.
