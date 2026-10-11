# VFX-001 delivery report

Branch: `vfx/VFX-001`. Implementation milestone: `08206a0` (`feat(web): add single-batch cinematic disaster effects and repair reveals`). The subsequent QA commit contains this report, tests, recordings, and final reduced-motion fixes.

Implemented all four disaster treatments, repair celebration, and revival feedback. **The whole-scene 60 fps acceptance target remains unmet in the measured browser environment.** Functional checks and the one-extra-draw-call budget pass; the timing limitation is documented below rather than described as a performance pass.

## Changes

- `src/scene/DisasterEffects.tsx`: event lifecycle, 250 ms camera shake, bounded lightning, live reduced-motion preference, pet-return/repair celebration, signs, resource cleanup.
- `src/scene/disasterVisuals.ts`: one instanced primitive atlas/material for every disaster, including props and particles. Meteor/trail/soft bloom-style halo/shockwave; faceted dark crater, orange cracks, embers and alpha-faded billboard smoke; wooden barricade and quota-driven scaffold tiers; cream/teal vet van, cones, paw decals and escaping trails; cloud clusters, instanced rain streaks and ripples; tan garden patches, wilting leaves, cartoon bugs and dust; confetti, hearts and sparkles.
- `src/scene/GridTown.tsx`: preserve closed buildings, add a 750 ms rebuild reveal, dry garden tint, short streetlight flicker followed by darkness.
- `src/scene/OptionalModel.tsx`: tint cloned building materials while closed and restore their original colors on repair.
- `src/scene/VillageScene.tsx`, `src/scene/gamingLight.ts`: candlelit windows during blackout, restored afterward; observe equipped-pet returns.
- `src/App.tsx`: use the existing gentle prayer chime for completed repairs. Revival uses the same sound engine, which respects mute/reduced-motion settings.
- `package.json`, `src/scene/disasterVisuals.test.ts`: add bounded-particle, quota, lightning and material-restoration checks to the normal unit suite.
- `playwright.vfx001.config.ts`, `tests/vfx001*.spec.ts`: isolated port 5291, shader-console assertions, real renderer draw-call measurements, live reduced-motion changes, repair/revival and low-quality checks, optional native GPU measurements.
- `artifacts/vfx001/**`: before/after stills, close views, four short WebMs, loaded-model stills, edge-case stills and GPU timing JSON.

## Choices

All geometry and effects are procedural; no paid calls, generated assets, secrets, or GPU worker are needed. Existing GLBs continue to work, and offline fallbacks remain usable. The flash uses an emissive-looking soft halo inside the same batch rather than a separate bloom postprocessing pass. Low quality reduces particles/clouds/wisps; reduced motion independently disables moving particles, camera shake and lightning. Celebration becomes a static sparkle/heart display in reduced motion. Scaffolding follows the minimum completion ratio of both repair quotas. Return feedback follows an increase in equipped pets during an outbreak, including a real revival-potion purchase.

Only `apps/web/**` changed. Root files, task records, `.env` files, contracts, API and worker code were not changed. No credentials were needed for fixture-backed validation.

## Validation

Commands run from `apps/web` unless stated otherwise:

- `bun install --frozen-lockfile`: exit 0 (dependencies were absent initially).
- Baseline `bunx playwright test --config playwright.vfx001.config.ts` using the original FEAT-012 test before implementation: exit 0, 1 test. Port 5186 was occupied, so the isolated config uses 5291.
- `bun run test`: exit 0, **146 tests** across 36 files. A subsequent concurrent run hit the pre-existing 5-second paddock test timeout (145 passed, 1 timed out; exit 1); the final serial `bun run test` rerun passed all 146 tests (exit 0, 26.58 seconds).
- `bun run typecheck`: exit 0.
- `bun run build`: exit 0. Vite retains its existing large-chunk warning.
- `bunx playwright test --config playwright.vfx001.config.ts`: exit 0, **5 tests** together (four disasters plus the low-quality/reduced-motion repair and revival scenario).
- Four-disaster offline browser pass: all 4 tests passed, including exactly **one** extra renderer draw call for each effect, no shader errors, repair recovery, and runtime reduced-motion toggling.
- Native GPU functional/benchmark pass: `$env:VFX_GPU='1'; bunx playwright test --config playwright.vfx001.config.ts` (four-disaster version): exit 0, 4 tests, all models available. Recording was disabled for the final timing samples.
- The first native run with a strict FPS gate failed (exit 1). Its 25.8–32.1 fps recording samples led to the no-recording baseline comparison below. A diagnostic GLSL reserved-word failure was fixed and shader-error assertions were added. Edge-case test fixtures also required correcting cloned-response mutation and waiting for the seat dialog after reload.

- `bunx playwright test --config playwright.vfx001.config.ts -g 'partial scaffolding'`: exit 0, 1 test. Confirms partial scaffold tiers, low quality, reduced motion, expired outbreak paw trails, actual revival-potion purchase, returned equipment, and static heart/sparkle feedback.

## Performance limitation

Actual renderer: NVIDIA GeForce RTX 5090 via ANGLE Direct3D11, headless Chromium, 1440 x 1000 viewport. Samples cover 120 rendered animation-frame intervals after an eight-second warmup, with loaded models and adaptive quality enabled. Baseline here means the same active-disaster town with only the VFX batch hidden; it is not a separate pristine-world benchmark.

| Effect | VFX visible fps | Batch hidden fps | Added draws |
| --- | ---: | ---: | ---: |
| Scorch | 28.8 | 27.2 | 1 |
| Outbreak | 34.8 | 31.7 | 1 |
| Blackout | 33.8 | 44.7 | 1 |
| Blight | 53.3 | 47.4 | 1 |

These short samples vary with the rest of the scene and machine load. They do not establish a reliable isolated VFX cost or meet 60 fps. All hidden-batch samples also fall below 60; blackout warrants further profiling. The test can enforce the unresolved target with `VFX_GPU=1 VFX_REQUIRE_60=1` (PowerShell: set both environment variables before running). Performance measurements are retained in `artifacts/vfx001/gpu/*-performance.json`.

## Try it

Run `bun run dev` with the project's usual demo setup. Choose Iraj, open the bug/debug menu, choose **Trigger disaster**, and select each kind. Close the dialog to see the intro. Use **Repair now** to see restoration and hear the chime when sound is enabled. Scroll toward the shelter/gardens for a closer view. The fixture-backed reproducible review command is `bunx playwright test --config playwright.vfx001.config.ts`; it supplies its own mock backend and never needs live credentials.

Open [the visual index](artifacts/vfx001/README.md) for all before/after images and recordings. Example still: [scorch with existing models](artifacts/vfx001/gpu/scorch-detail.png). Example recording: [storm blackout](artifacts/vfx001/after/blackout.webm).

Blocker: full-scene 60 fps target remains unmet, as measured above. Proposed contract changes: **none**.
