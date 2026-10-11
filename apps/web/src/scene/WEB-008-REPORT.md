# WEB-008 handoff

Branch: `web/WEB-008`. Implementation milestone: `1be71f7`. The subsequent verification commit contains this report, visual refinements and browser coverage. No push or merge.

## Delivered

The island is now 20.55 m in radius (approximately 2.5 times the previous area). Seeded residential plots, festival grounds, park, lake/bridge and forest edge surround the existing Mayor plaza and shop. Pet owners receive backyards; `pet_shelter` renders only when explicitly unlocked, otherwise its lot is a construction site. All new district assets have procedural fallbacks. Alternate houses and the alternate dog are supported.

Local time updates every minute, with optional world time/weather overrides. Festival nights add animated colored stage lighting, emissive string lights and additive light cones. Fountain, fire, ferris wheel, birds and butterflies animate. Rain and fog have separate treatments. Villagers alternate wandering, bench sitting and visiting another member's house; night sends them to dance at the stage, while active, unexpired Mayor events take priority and gather them at the plaza. Existing generated heads, manifest polling, profile clicks, crowns and dogs remain intact.

Selection smoothly moves the camera target to the actual villager position. Idle orbit resumes after an interaction delay. Camera target and zoom are bounded for the larger island; reset still works. Tree and nature instances have computed bounding spheres for frustum culling. Paths use one mesh each instead of cloned tiles. District props and instanced nature do not cast shadows. Low-core devices start with reduced effects; two sustained slow frame-rate windows reduce DPR to 1, disable shadows and remove extra stage lights, beams, rain and some ambient creatures.

Missing GLBs are retried every 35 seconds; successful assets are cached and stop retrying. Named `wheel`, `lamp_0..3`, `water`, `fire`, `wing_l` and `wing_r` nodes animate when supplied. Synthetic browser coverage verifies late arrival without reloading.

## Files changed

All source changes stay in `apps/web/src/scene/`:

- `VillageScene.tsx`: larger terrain, activities, district integration and scene lighting.
- `TownDistricts.tsx`: festival, park, lake, shelter, backyards and ambient life.
- `TownCamera.tsx`: camera flights/orbit and adaptive effects.
- `worldTypes.ts`: defensive optional world state, seeded layout, unlock/time/activity rules.
- `InstancedTrees.tsx`: instanced nature and late GLB loading.
- `OptionalModel.tsx`: optional named-node animation, hero shadows, sitting pose and missing-model retries.
- `worldTypes.test.ts`: deterministic layout, spacing, gating, time and activity coverage.
- `WEB-008-REPORT.md`: this report, placed here to respect allowed paths.

Browser files: `apps/web/tests/scene.spec.ts`, `scene.config.spec.ts`, `scene.regression.config.spec.ts`. The standalone configs keep root/package files unchanged and isolate development servers from other worktrees. Existing tests are reused without modification.

## Verification

Commands ran from `apps/web` unless indicated. Final completed checks:

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --no-save` | 0 | Installed existing dependencies; no lockfile changes |
| `bun run build` | 0 | TypeScript and production build; existing large-chunk warning |
| `bun run test` | 0 | 26 existing tests passed, 164 assertions |
| `bun test src/scene/worldTypes.test.ts` | 0 | 4 new tests passed, 1491 assertions |
| `bunx playwright test --config tests/scene.config.spec.ts` | 0 | Initial software day/night fallback tests passed |
| `bunx playwright test --config tests/scene.config.spec.ts --grep "newly arriving"` | 0 | Missing optional and instanced models loaded after arrival |
| `$env:SCENE_HARDWARE='1'; bunx playwright test --config tests/scene.config.spec.ts` | 0 | Final three scene tests passed; RTX 5090 via Direct3D11 |
| `bunx playwright test --config tests/scene.regression.config.spec.ts --project=auth` | 0 | Existing Auth0 test passed on its required port 5177 |
| `bunx playwright test --config tests/scene.regression.config.spec.ts` | 0 | All 29 existing browser tests passed (2.4 minutes) |
| `git diff --check` (worktree root) | 0 | Clean |

At 1920x1080 the final hardware run measured **143.8 fps day and 143.8 fps night**, using three-second foreground requestAnimationFrame samples and explicitly asserting >=50 fps. Renderer: NVIDIA GeForce RTX 5090, ANGLE Direct3D11. These measurements use the complete zero-asset fallback town and fixture villagers. They do not certify every future GLB combination or laptop GPU. Software rendering measured approximately 20-21 fps with low-core reduced effects.

Earlier unsuccessful checks: the first typecheck lacked installed dependencies; development checks caught a JSX brace, shadowed size variable and strict test-config typing, all fixed. The default regression command could not start because port 5174 was occupied. The first isolated run passed 28 tests and failed only the Auth0 test's hardcoded redirect-origin assertion after moving it to 5197; the corrected config preserves 5177. An initial nominal hardware run actually selected SwiftShader and failed the 50 fps assertions; explicit Direct3D11 selected the RTX 5090 and passed. No failed run is counted as successful.

## Screenshots and try-it instructions

Visually reviewed final screenshots, local and ignored:

- `apps/web/test-results/web008-day.png`
- `apps/web/test-results/web008-night.png`

Screenshots deliberately force every model request to 404 and use synthetic fixture data, demonstrating that the whole town works without GPU/generated assets. Older tracked screenshots regenerated by existing tests are restored before committing.

From `apps/web`, run `bun install --no-save`, then in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5188
```

Open http://localhost:5188. Select a villager to fly over, drag/scroll to explore, and reset the camera. Wait for activities and idle orbit. For reproducible day/night examples run the scene Playwright config instead of a manually started server. Set `SCENE_HARDWARE=1` for the Direct3D11 performance assertions; omit it for portable software browser tests.

## Choices, limits and upstream proposal

- Interpreted 2.5x growth as land area, preserving a readable island overview.
- `world` is optional and kept scene-local. Missing unlocks mean locked, never unlocked by a guessed level. Supported time values are numeric hours, `HH:mm`, or named dawn/morning/day/afternoon/dusk/evening/night. Without an override, browser local time applies. Festival weather forces night. Propose documenting the optional API-007 `world` shape and these time units in the shared contract; no contract was edited.
- ASSET-002's new GLBs were not in this worktree at verification time (17 existing model files). Their actual geometry/node axes cannot be visually certified here. Fallbacks, optional loading and retry behavior are verified; named-node hooks are ready for those files. No implementation blocker.
- No API, components, styles, root config, environment, contract, public models, real portraits or voice files were changed. No secrets were needed for these provider-free tests; none were read into outputs or copied. No paid generation, messages or transactions were sent.
