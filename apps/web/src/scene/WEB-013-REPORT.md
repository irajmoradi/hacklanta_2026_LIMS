# WEB-013 handoff

Branch: `web/WEB-013`. Implementation commit: `a50cff7`. The following verification commit contains this report, browser coverage and the isolated QA helper. No push or merge.

**Visual quality gate: not passed.** Three visual rounds completed, as capped by the task. The result is substantially better than the rejected grid: actual buildings fill their plots, villagers are readable, the street grid is smaller, floating labels are gone, and the island has a planted, rounded edge. However, the supplied round village still has the stronger cozy composition: more continuous grass, a tighter social center, and less repetitive paving/roof rhythm. I do not recommend treating the "better than round" requirement as satisfied merely because the functional and performance tests pass.

## Changes and choices

- Starter town: 36 lots in nine 2x2 blocks, replacing 63 individually road-bounded lots. Complete two-row block bands accommodate more members or catalog overflow. Existing home coordinates remain stable; sparse home slots remain reserved. Lake/shelter catalog districts map to park space locally.
- Roads occur between blocks; the preserved sidewalk graph/A* also connects pedestrian passages inside each block. Schedules, goal-related destinations, registry placement, model retries and infrastructure instancing remain active.
- Town geometry is rendered at 0.55 of navigation coordinates. Houses occupy 10 navigation units (5.5 world units); civic/storefront assets use proportional, bounded sizes. Villagers stay 1.8 world units tall. House attachments scale with their house.
- Every vacant or locked plot gets trees and garden beds. No for-sale signs or permanent building labels. A single shared inspection state displays only the hovered building/home name. Existing accessible Shop/Mayor controls remain available outside the canvas.
- Rounded extruded island, mixed flowering/evergreen perimeter, narrower sidewalks, warmer ground/background, fog and emissive night streetlights. Existing festival illumination remains active.
- Default camera points along `[52,64,76]`, the same direction as the round implementation's `[26,32,38]`. Zoom fits the compact town more closely; bounded pan, eased zoom, villager tracking and reset remain available.
- Level unlocks convert reserved gardens into buildings; membership/catalog capacity adds blocks. This intentionally avoids changing existing addresses on a level-up. Zero assets and an offline GPU still work.

## Files changed

Under `apps/web/src/scene/`: `.gitignore`, `GridTown.tsx`, `InstancedTrees.tsx`, `TownCamera.tsx`, `VillageScene.tsx`, `layout/town.ts`, `layout/town.test.ts`, `qa.py`, and this report.

Under `apps/web/tests/`: `scene.config.spec.ts`, `scene.spec.ts`, `scene.town.spec.ts`.

No root files, contracts, environment files, other apps or real-person photos were committed.

## Validation

This worktree initially lacked dependencies. `python apps/web/src/scene/qa.py` (exit 0) stages the exact app/packages inside the ignored `apps/web/src/scene/.qa` directory and copies existing web dependencies there. It accepts `VILLAGE_WEB_DEPS`; the local default is the sibling hacklanta checkout. Dependency caches and test outputs stay in that staging directory. The wallet panel's documented `npm ci --ignore-scripts --install-links` ran inside the staged `src/components/pot` (exit 0). No application source outside allowed paths was edited.

Commands below ran from `apps/web/src/scene/.qa/apps/web`. Browser commands used `$env:VILLAGE_ENV_FILE='C:/Users/mourn/Downloads/hacklanta/.env'`; Vite reads public values at runtime. Secret values were never printed or copied.

| Command | Exit | Final result |
| --- | --- | --- |
| `bun test src/scene` | 0 | 19 tests, 2,761 assertions; growth, sparse slots, registry placement, A*, schedules, models and cosmetics |
| `bun run test` | 0 | 32 existing unit tests passed |
| `bun run build` | 0 | TypeScript and production bundle passed; existing large-chunk warning |
| `$env:SCENE_HARDWARE='1'; bunx playwright test --config tests/scene.town.config.spec.ts` | 0 | 2 real-mode tests passed, actual GLB response magic checked, hover-only labels, zoom/pan/reset, no page errors |
| `$env:SCENE_HARDWARE='1'; bunx playwright test --config tests/scene.config.spec.ts` | 0 | 4 tests passed: all GLBs unavailable, late GLB arrival, locked assets not requested, profiles/camera |
| `$env:SCENE_SKIP_AUTH='1'; bunx playwright test village.spec.ts --config tests/scene.regression.config.spec.ts --project=mock` | 0 | 3 smoke tests passed: profile/check-in/shop, goals/Mayor/user switching, 1080p and keyboard focus |
| `git diff --check` (repository root) | 0 | Clean |

Final real-mode foreground RAF samples at 1920x1080: **143.8 fps day, 120.2 fps night**. All-GLB-missing fallback: **143.8 fps day and night**. Renderer: NVIDIA RTX 5090 / ANGLE Direct3D11. These are this machine's foreground browser measurements, not a mobile performance guarantee.

Earlier failures were resolved: missing wallet dependencies; one missing JSX closing brace during the third pass; obsolete level-3 fixture assumptions after the catalog moved Ferris wheel unlock to level 5. An initial smoke-test CLI invocation also placed a filename after Playwright's variadic `--project` option; no tests ran in that invocation. Tests were rerun after each relevant fix, without changing live backend state.

## Visual evidence

All final evidence is in `apps/web/src/scene/artifacts/`, intentionally git-ignored because live UI screenshots include profile photos:

- `web013-real-day.png` and `web013-real-night.png`: 1920x1080, same fixed default camera, live API and real GLBs. Only response time/weather is overridden for repeatable lighting.
- `web013-overview-day.png` and `web013-overview-night.png`: camera zoom interaction.
- `web013-fallback-day.png` and `web013-fallback-night.png`: all GLB requests return 404.
- `web013-comparison.png`: supplied round reference next to final real-mode day screenshot, original aspect ratios preserved and equal-height fitting. The supplied reference is 1158x917, so this is an honest visual comparison, not a pixel-identical viewport comparison. Camera direction matches the round source; the reference screenshot's historical user pan/rotation cannot be recovered exactly.

Round 1 restored density/scale but was too paved and rigid. Round 2 restored the island outline, tree variety and human scale. Round 3 improved planting, closer framing, house inspection and night lamps. No fourth redesign was attempted.

## Try it / remaining work

From an installed `apps/web`, set `VILLAGE_ENV_FILE` to the existing root env, then `bun run dev --port 5198` and visit `http://localhost:5198`. For exact live demo settings, use `tests/scene.town.config.spec.ts` (real API :8010, seeded village and demo user). In this dependency-free worktree, run `qa.py` and execute those commands from the staging app instead. No paid generation is needed.

Inspect buildings, select a villager, drag/right-drag, scroll and reset. To reproduce all-asset-offline coverage, run the scene browser config above.

Remaining blocker: the subjective "better than round" visual gate, despite meeting the measured performance gate. Keep the branch reviewable; do not auto-merge on the strength of passing tests. **Proposed contract changes: none.**
