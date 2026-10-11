# FEAT-009: park Study Spot

Original procedural geometry, authored locally with Blender; no external textures,
likenesses, model weights, credentials, generated audio, or paid provider calls.
`study_nook.glb`: **2,212 triangles** (8,000 budget), ground anchor Y=0,
glTF +Y up/+Z front, footprint within a 10 m square. Named materials:
wood, wall, leaf, chalk, metal, glass, light. Warm emissive light material.

Three picnic tables have open books, laptops and mugs. An open pergola has a warm
string-light strand; the central table has a lamp. Cream beanbags, a little free
library, potted plants, a sage rug and a mesh-lettered “Study Spot” chalkboard
complete the set. The contact sheet reimports the exported GLB before rendering.

The registry places it in an existing empty park lot, preserving the garden and
fountain. It is available from level 1, free, and excluded from shop items.
The scene uses authored metre coordinates rather than bounding-box normalization,
so seat anchors match the asset and the procedural model-free fallback.

There are 12 seats, four per table. Active studying villagers are sorted by unique
house slot and assigned distinct seats; overflow waits at home. Home visits and
Mayor/festival overrides retain the existing WEB-017 schedule. Paths enter from
the sidewalk and follow the gaps between tables. Villagers face their table and
use a seated typing motion, including the fixture rig and primitive fallback.
The standard activity picker and live badge show “📚 Studying”. A soft warm point
light comes on at night. Optional audio was omitted: the nook adds no sound and
cannot bypass the existing sound toggle.

## Reproduce

From the repository root (PowerShell):

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/study_nook.py
python assets/check_glb.py
```

From `packages/catalog`: `bun run validate`, then `bun test`.
From `apps/web`: `bun install`, `bun run build`, `bun run test`, then
`bunx playwright test --config playwright.feat009.config.ts`.
The dedicated browser configuration uses Chromium's default renderer because the
shared suite's forced SwiftShader failed to create WebGL on this machine.

For real API QA, in `apps/api` set `VILLAGE_ENV_FILE` to the existing root env file
at runtime and run `python -m uv run python scripts/feat009_preview.py`.
This uses only a disposable schema in `village_test`, disables paid providers,
and seeds study preferences. With that running, from `apps/web`:
`bunx playwright test --config playwright.feat009-real.config.ts`.
Stop gracefully with POST `http://127.0.0.1:8029/qa/stop` to drop the preview schema.
The QA-only night/stop routes exist solely in this local preview script.

For normal integration, run the API's existing migration command with
`VILLAGE_ENV_FILE` set; it applies `021_idle_studying.sql` idempotently. Start the
API/web normally, open My profile, select **Studying**, and close the card to let
the avatar walk. Friends choosing the same activity share the tables. The nook
also works entirely offline in fixture mode without the GPU worker.

## Artifacts

- `assets/previews/study_nook_contact.png`: exported-asset render.
- `assets/previews/study_nook_day.png`, `study_nook_night.png`: committed real API captures, visually reviewed.
- `apps/web/test-results/feat009/day-real.png`, `night-real.png`: real API browser captures.
- `apps/web/test-results/feat009/day-glb.png`, `night-glb.png`: mock GLB captures.
- `apps/web/test-results/feat009/day-fallback.png`, `night-fallback.png`: model-free captures.

## Validation

| Working directory | Command | Exit | Result |
| --- | --- | --- | --- |
| root | Blender command above | 0 | GLB exported and reimported for contact render |
| root | `python assets/check_glb.py` | 0 | 157 GLBs, zero failures; nook 2,212 triangles |
| root | `python assets/test_check_glb.py` | 0 | 24 passed |
| packages/catalog | `bun run validate` | 0 | 162 entries; generated types |
| packages/catalog | `bun test` | 0 | 23 passed |
| apps/web | `bun run build` | 0 | Production build; existing large-chunk warnings |
| apps/web | `bun run typecheck` | 0 | TypeScript clean |
| apps/web | `bun run test` | 0 | 54 passed, including placement, seat assignment and routing |
| apps/api | `python -m uv run pytest -q --tb=short` | 1 | 291 passed, 2 skipped, 5 assertion failures corrected below |
| apps/api | targeted pytest command below | 0 | 43 passed, including all five formerly failing tests and migration repeatability |
| apps/web | `bunx playwright test --config playwright.feat009.config.ts` | 0 | 2 passed: GLB and all models unavailable |
| apps/web | `bunx playwright test --config playwright.feat009-real.config.ts` | 0 | 1 passed: real API persistence, four distinct seats, day and night captures |

API regression command (with `VILLAGE_ENV_FILE` supplied at runtime):

```text
python -m uv run pytest -q --tb=short tests/test_web017.py tests/test_catalog_registry.py tests/test_arch003.py tests/test_api007.py::test_growth_idempotency_purchase_and_event_bonus tests/test_demo_story.py::test_demo_replay_and_state
```

The full API run exposed three stale catalog assertions (143 entries / 22 shop
rows) and two expectations affected by the additional level-one unlock. Updated
counts and unlock/demo expectations passed on the targeted rerun. The full suite
was not rerun a second time. Ruff checks passed on every changed Python API file.
The initial shared Playwright configuration failed to create WebGL; the dedicated
configuration passed. Real-API QA also needed a 30-second assertion window under
load; its GPU health target is deliberately an offline loopback port.

Implementation milestones: `e54ac56` (asset/catalog) and `3b5920b` (activity/API).
No outstanding blockers. Optional audio was intentionally omitted.
The only HTTP contract change is the allowed `studying` preference, documented in
`packages/contracts/api.md`; no changes to the integrator-owned base schema are needed.

## Changed files

- `assets/previews/study_nook_day.png`
- `assets/previews/study_nook_night.png`
- `apps/api/app/models.py`
- `apps/api/migrations/021_idle_studying.sql`
- `apps/api/scripts/feat009_preview.py`
- `apps/api/tests/test_api007.py`
- `apps/api/tests/test_arch003.py`
- `apps/api/tests/test_catalog_registry.py`
- `apps/api/tests/test_demo_story.py`
- `apps/api/tests/test_web017.py`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/playwright.feat009-real.config.ts`
- `apps/web/playwright.feat009.config.ts`
- `apps/web/public/models/study_nook.glb`
- `apps/web/src/api/idleActivity.ts`
- `apps/web/src/api/settings.test.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/scene/GridTown.tsx`
- `apps/web/src/scene/OptionalModel.tsx`
- `apps/web/src/scene/StudyNook.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/catalog.fallback.json`
- `apps/web/src/scene/layout/navigation.ts`
- `apps/web/src/scene/layout/studySeats.test.ts`
- `apps/web/src/scene/layout/studySeats.ts`
- `apps/web/src/scene/layout/town.ts`
- `apps/web/src/scene/worldTypes.ts`
- `apps/web/tests/feat009-real.spec.ts`
- `apps/web/tests/feat009.spec.ts`
- `assets/STUDY_NOOK_009.md`
- `assets/blender/study_nook.py`
- `assets/check_glb.py`
- `assets/previews/study_nook_contact.png`
- `packages/catalog/catalog.json`
- `packages/catalog/dist/catalog.ts`
- `packages/catalog/validate.test.ts`
- `packages/contracts/api.md`
