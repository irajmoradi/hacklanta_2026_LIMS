# WEB-057 ? square Big town, full house models

Branch: `web/WEB-057`. Implementation milestone: `179330a`. The subsequent verification commit contains this report, browser tests, and screenshots (use `git log -2` for both hashes).

## Behavior and choices

- Only Big town opts into `createTown(..., 'lab-square')`, guarded by `sandbox` in VillageScene. Other Lab modes retain their layout. Main-village addresses, lots, streets, dimensions and serialized map order match nine pre-change SHA-256 snapshots across three seeds, empty/sparse membership and 100 residents. Existing layout tests are unchanged.
- Even-sided square grids grow in both axes. Shops and plaza occupy the center; lake, park activities and festival occupy different neighborhoods. Seeded residential placement leaves pocket parks and varied setbacks/yaw. Existing road/path/drive rules and navigation are retained; perimeter trees follow the expanded banks.
- All populations use the same House component, selected model/level, palette, surface options and decoration path as the village. Removed the population-triggered cottage fallback. Missing assets still use the normal procedural fallback.
- Houses use existing `batchStatic` geometry merging, shared source geometry and ref-counted static palette/surface materials. Animated glass remains private. This is per-model geometry batching, not cross-house instancing. Existing instanced trees/town props, crowd budget and adaptive shadows/DPR remain active. No house geometry LOD.
- Lab house labels, and Big town villager labels, mount only on hover/selection. Overview now applies at 25 as well as 50/100; wheel zoom and reset remain available. FPS stays visible.

## Verification

All commands below run from `apps/web` through the remote wrapper, using mock mode and an unreachable API URL for browser tests. No secrets or live-village mutations were needed.

| Command | Result |
| --- | --- |
| `bash ../../ops/remote_run.sh bun run test` | Exit 0; 264 tests passed, both baseline and after implementation. |
| `bash ../../ops/remote_run.sh bun test src/scene/layout/squareTown.test.ts src/scene/staticMaterials.test.ts` | Exit 0; 5 tests passed. Covers exact legacy output, deterministic square bounds, spacing, connected entrances/roads, trees in every quadrant and shared-material ownership/isolation. |
| `bash ../../ops/remote_run.sh bun run build` | Exit 0; TypeScript and Vite production build passed (existing chunk-size warning). |
| `bash ../../ops/remote_run.sh bunx playwright test --config tests/lab057.config.ts` | Exit 0 (1 passed); browser checks full house materials at 25/50/100, every house in frame, interaction-only labels, zoom retaining all model detail, reset, no API calls or page errors. |
| `bash ../../ops/remote_run.sh bunx playwright test --config tests/lab.config.ts` | Exit 0; 3 passed: disasters/repair, futures, mobile and missing models. |

An early runner connection reset returned exit 255 and left a worktree lock; after SSH recovered, only the verified orphan processes for this worktree were stopped. A first browser attempt returned exit 1 because one wheel event produces one OrbitControls zoom step regardless of delta magnitude; the test now sends repeated wheel events. No failing remote test was rerun locally.

## Evidence and performance

Screenshots, visually reviewed: `apps/web/tests/screenshots/WEB-057/town-25.png`, `town-50.png`, `town-100.png`, and `street-100.png`. Raw renderer, draw calls, geometry counts, house checks and five FPS samples per population are in `metrics.json` alongside them.

| Residents | FPS samples | Median FPS | Draw calls | Triangles |
| --- | --- | --- | --- | --- |
| 25 | 3, 3, 3, 5, 3 | 3 | 1230 | 210494 |
| 50 | 3, 3, 2, 3, 2 | 3 | 1575 | 298234 |
| 100 | 3, 2, 2, 1, 1 | 2 | 2425 | 438910 |

Final browser pass: exit 0, 1 test passed in 3.5 minutes; all 175 house checks across the three populations confirmed real wall/roof materials and every house inside the overview. Existing Lab suite: exit 0, 3 tests passed. Final build: exit 0. The runner uses ANGLE/Vulkan SwiftShader software rendering on a shared VM. These measurements do not establish the requested >=45 FPS on a typical laptop GPU. Hardware performance remains unverified; no hardware result is claimed.

## Try it

From `apps/web`, run `bun run dev`, open `/lab`, select Big town and move Population through 25/50/100. Drag to pan, scroll repeatedly to inspect a street, hover a house for its label and click Reset camera to return to the overview. Reload resets the sandbox. GPU worker and generated avatars are unnecessary.

Files changed: `src/lab/WorldDemo.tsx`, this report; `src/scene/VillageScene.tsx`, `OptionalModel.tsx`, `staticMaterials.ts`, `staticMaterials.test.ts`; `src/scene/layout/town.ts`, `streets.ts`, `variety.ts`, `squareTown.ts`, `squareTown.test.ts`; `tests/lab057-tools.ts`, `lab057.config.ts`, `lab057.spec.ts`, and the WEB-057 screenshots/metrics. All changes are within allowed paths.

Blocker/limitation: the laptop GPU FPS target needs a hardware measurement. Proposed contract changes: none.
