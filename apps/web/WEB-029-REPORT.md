# WEB-029 ? Bigger, more organic town

Branch: `web/WEB-029`. Implementation: `ff01e1f`; additional prop batching: `18545f8`. Browser evidence and this report are in the final verification commit.

The starter island grows from 116?116 to 146?146 (1.584? area), with 21m lot pitch instead of 16m. Stable row/column addresses and the existing seed-to-house-slot offset survive membership growth, sparse slots and reordering. Seeded bends offset the blocks; lot centers and setbacks vary; occupied houses, their attachments and paddocks rotate together by ?8?15?. The civic center, commercial row, parks and festival district remain recognizable; the farm store prefers the commercial edge.

Catmull?Rom road and path samples are shared by merged ground geometry and the waypoint graph. Each entrance connects to an exact curve knot, with two diagonal park greenways, two short cul-de-sacs, and a connected pet-walking loop. Study seats retain their internal aisles. Euclidean A* supports diagonals. Vegetation is excluded from path footprints. Irregular lawn patches, clustered trees/hedges and an eastern creek soften the block boundaries. Camera zoom derives from the enlarged dimensions and reset stays focused on the original civic center as new rows grow.

Roads/paths are merged, trees and props are instanced by material, and static building meshes are merged by their original material before per-instance recoloring. This is opt-in: animated rigs, skinned/morph meshes and multi-material meshes retain their hierarchy. The study nook retains its material-only night lighting; moving animals and the Ferris wheel retain their animation nodes. The shared source cache is not recolored or disposed by an instance.

## Files changed

- Layout/routing: `src/scene/layout/{town.ts,navigation.ts,streets.ts,town.test.ts}`.
- Rendering/camera: `src/scene/{GridTown.tsx,TownSurfaces.tsx,VillageScene.tsx,TownCamera.tsx}`.
- Static batching: `src/scene/{staticModel.ts,staticModel.test.ts,OptionalModel.tsx,InstancedTrees.tsx,MayorPlaza.tsx,StudyNook.tsx,ShelterPets.tsx,FarmAnimals.tsx}`; `package.json` adds its tests to the standard suite.
- QA: `playwright.web029.config.ts`, `tests/web029.spec.ts`, `tests/web029-baseline.py`, `artifacts/web029/*`, this report.

All paths are under `apps/web`. No contracts, API files, root files, environment files or catalog files changed.

## Verification

- `bun run test`: exit 0; 101 tests, 142,546 assertions across 26 files.
- `bun test src/scene/staticModel.test.ts src/scene/layout/`: exit 0; 18 tests, 134,955 assertions.
- `bun run typecheck`: exit 0.
- `bun run build`: exit 0; existing large-chunk warning remains.
- `VILLAGE_BROWSER_GPU=hardware python tests/web029-baseline.py`: exit 0; 1 real-mode baseline smoke passed.
- `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.web029.config.ts`: exit 0; 1 final real-mode smoke passed (53.1s). PowerShell runs used `$env:VILLAGE_BROWSER_GPU='hardware'` before these commands.
- `git diff --check`: exit 0.

Layout coverage includes seeded determinism, stable sparse/growing addresses, every lot reachable, a connected curved graph, all study seats, pet walking, event priority, exact segment intersection checks against rotated house/paddock envelopes, and separation of conservative 14m circumscribed house envelopes across seven seeds. Against that same envelope the guaranteed gap is at least 1.5? the old layout's. Static batching tests verify transformed bounds, triangle counts, source ownership, recoloring and animation exclusions.

The browser suite uses a real FastAPI/PostgreSQL disposable schema seeded by the existing `apps/api/scripts/feat009_preview.py`, with paid providers and the GPU worker disabled. It verifies connected state, real scene rendering, house-profile interaction, reset, missing-model fallbacks, and mobile layout. No real-person images/voice or secrets were added. Early obsolete grid assertions and one batching test uncovered issues that were fixed before the passing runs above.

## Screenshots and performance

`artifacts/web029/{before,after}-{overview,street,fallback,mobile}.png` and `{before,after}-performance.json`. The baseline harness temporarily loads only the original scene source files from `0674e80`, then restores exact working bytes in `finally`. Both captures use the same browser viewport, API schema and test camera procedure. All images are real API mode with preset avatars.

The final paired captures report 1,781 ? 371 meshes, 3,477 ? 657 draw calls (81.1% fewer), and 243,774 ? 123,378 triangles. Instanced batches fall from 126 to 18 without increasing tree/prop draw calls as the map grows. Both captures have shadows enabled.

Recorded five-second browser RAF samples were 9.9 FPS before and 22.8 FPS after, with 166.6ms final p95. An earlier optimized run measured 57.9 FPS / 16.8ms p95; timing varied substantially on this shared host. **The 60 FPS laptop acceptance target is not certified and was not met in the final recorded sample.** The raw measurements are retained rather than presenting smoke-test success as performance acceptance. The remaining performance check requires an uncontended target laptop; no unrelated host processes were stopped.

Visually reviewed the final overview, residential street, no-model fallback and mobile images, plus the original overview/street. The mobile HUD still covers part of the scene as in the original UI; this task changes the map/camera, not the surrounding HUD.

## Try it

For fixture mode, from `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev
```

Choose a demo seat. Pan/zoom the larger village, inspect a rotated home, reset to the civic center, and try studying or walking a pet in Settings. Existing paddocks and backyard equipment rotate with the home.

For reproducible real-mode QA, use the existing Python environment with the API dependencies, set `VILLAGE_ENV_FILE` to the supplied external root `.env`, and set `PYTHONDONTWRITEBYTECODE=1`. From `apps/web`, run `python ../api/scripts/feat009_preview.py` (port 8029). Then run `bunx playwright test --config playwright.web029.config.ts`. Optional `VILLAGE_BROWSER_GPU=hardware` selects native hardware graphics; the default uses portable software rendering. `python tests/web029-baseline.py` repeats the original-layout capture. Stop the disposable API through `POST http://127.0.0.1:8029/qa/stop` so its schema is removed.

## Scope and limitations

Remaining acceptance limitation: the 60 FPS target above. No functional blockers or proposed contract changes. The task's INTEG-003/004 prerequisites are present in this checkout. Existing graph consumers receive the curved routes; this checkout has camera dragging but no separate villager drag-to-destination implementation to modify. No new drag interaction was invented.

Hardware performance was measured on the available Windows NVIDIA RTX 5090 host, not a laptop. A physical laptop and real mobile device were not available for certification. Missing generated assets and an offline worker remain supported.
