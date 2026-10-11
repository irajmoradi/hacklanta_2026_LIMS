# FEAT-008 final report

Branch: `feat/FEAT-008`.

Milestones:

- `9d29507`: seven procedural farm assets and XP registry.
- `eb8bea7`: API prerequisites, six-animal cap, migration tracking, contract documentation.
- `dbaed42`: Farm Store UI, house paddocks, fountain flock, offline fallbacks, browser screenshots.
- Final verification commit: the commit containing this report and final regression updates.

## Delivered

Farm Store unlocks with Pet Shelter at 2,500 earned village XP. Four species and
their second companions cost XP, require an 80-XP paddock, and have a serialized
six-animal ownership cap. The shop offers the paddock before the first animal
purchase. Farm equipment coexists with dogs and house upgrades; only dogs follow.
Purchasing a paddock reserves a side yard by shifting and scaling the house within
its lot. Actual GLB bounds for all 30 style/tier combinations pass overlap checks.

Eight fountain pigeons walk/peck, scatter on villager proximity, flap instanced
wings, and return. Two draw calls, no shadows. Farm-store display animals and
house animals have gentle motion. All new objects work with model requests
returning 404; the GPU worker is not required.

Design decisions and exact asset budgets: [FARM-008.md](FARM-008.md).

## Verification

Commands run from the repository root unless a directory is given. Python API
commands used the existing Python 3.12 environment at
`C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe` (`$apiPython`
below), with `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env` read at runtime.
No credentials were copied into this worktree. API tests use isolated schemas in
`village_test` and mocked providers.

| Command | Result | Exit |
| --- | --- | ---: |
| Blender `--background --python-exit-code 1 --python assets/blender/farm_kit.py` | Seven GLBs exported | 0 |
| Blender `--background --python-exit-code 1 --python assets/blender/farm_preview.py` | Contact sheet rendered and visually reviewed | 0 |
| `python assets/check_glb.py` | 163 GLBs, zero failures | 0 |
| `python assets/test_check_glb.py` | 24 passed | 0 |
| `bun run --cwd packages/catalog validate` | 172 entries validated, TypeScript regenerated | 0 |
| `bun test --cwd packages/catalog` | 23 passed | 0 |
| `bun run test` (apps/web) | 44 passed, including actual-model paddock bounds and farm economy | 0 |
| `bun run build` (apps/web) | Production bundle built; existing large-chunk warning | 0 |
| `bun run typecheck` (apps/web) | Final UI types valid | 0 |
| `bun run test:e2e farm.spec.ts equipment.spec.ts --project=mock` (apps/web) | 4 passed; purchases, scene objects, scatter/return, offline fallbacks, wardrobe regression | 0 |
| `& $apiPython -m pytest tests/test_farm.py tests/test_catalog_registry.py tests/test_api008.py -q` (apps/api) | 25 passed | 0 |
| `& $apiPython -m ruff check app/domain.py scripts/migrate.py tests/test_farm.py tests/conftest.py tests/test_api.py tests/test_api007.py tests/test_catalog_registry.py tests/test_api008.py tests/test_arch003.py tests/test_demo_story.py` (apps/api) | All checks passed | 0 |

The complete `& $apiPython -m pytest -q` sweep exited **1** with **291 passed,
6 failed, 2 skipped**. Five failures were superseded shop/unlock/demo-count
assertions. One revealed that a direct replay of migration 007 in an earlier test
recreated the exclusive equipment index; later farm purchases then failed. Migration
007 now preserves the multi-animal slot too. These failures were fixed and the
ordered regression rerun below covers every failed case plus their surrounding tests.
The ordered rerun completed **39 passed, exit 0**:

```powershell
# apps/api, same runtime environment described above
& $apiPython -m pytest tests/test_api.py::test_seed_and_contract tests/test_api007.py::test_growth_idempotency_purchase_and_event_bonus tests/test_api008.py tests/test_arch003.py tests/test_demo_story.py tests/test_farm.py -q
```

This includes the direct legacy-migration replay **before** multi-animal purchases,
so the test-order failure is covered. The full 299-test sweep was not repeated after
those corrections. No unresolved failures or implementation blockers remain.

## Screenshots

These are actual browser/WebGL captures using fixture people and mock purchases.

- [First-animal offer](../apps/web/test-results/farm-offer-models.png)
- [Farm Store](../apps/web/test-results/farm-shop-models.png)
- [House paddock](../apps/web/test-results/farm-paddock-models.png)
- [Paddock with GLBs offline](../apps/web/test-results/farm-paddock-offline.png)
- [Fountain pigeons](../apps/web/test-results/farm-pigeons-models.png)
- [Barn and display animals](../apps/web/test-results/farm-barn-models.png)
- [Village overview](../apps/web/test-results/farm-village-models.png)
- [Asset contact sheet](previews/farm_contact_sheet.png)

## Try it

1. Install web dependencies with `bun install` in `apps/web`. Run
   `bun run test:e2e farm.spec.ts --project=mock` for a self-contained demo that earns
   village XP, buys the paddock/chicken/duckling, verifies the scene and flock, and
   writes close-up screenshots. It makes no provider calls.
2. For an interactive offline village, set `VITE_MOCK=1` and run `bun run dev`.
   Earn village XP through goal progress until 2,500, then open Shop → Farm Store.
   Buy Chicken, accept the 110-XP paddock-plus-chicken offer, and inspect the house.
3. For the API deployment, install API dependencies, keep `VILLAGE_ENV_FILE` pointing
   at the shared root secrets, run `python scripts/migrate.py`, then
   `python scripts/sync_catalog.py` from `apps/api` before serving the app.
   Existing villages acquire the farm unlock when their world next synchronizes.

## Integration notes

The first-animal flow uses two existing purchase requests. If the second fails,
the paddock remains owned and the shop reloads inventory/balance for retry.
Companion variants share species meshes; no repeat purchase of the same item ID.
Paddock ownership is permanent, while individual animals may be unequipped.

`packages/contracts/api.md` is updated within this task's permission. Proposed
integrator follow-up: fold migration 016's `farm_animal` / `house_addon` checks and
partial equipment index into `packages/contracts/schema.sql` when updating the
baseline. This task does not edit that file. The application migration is complete
and supports fresh databases and tracked replay without requiring that follow-up.
Legacy migration 007 also preserves the farm slot when explicitly replayed directly.

## Files changed

- `apps/api/app/domain.py`
- `apps/api/migrations/007_shop_equipment.sql`
- `apps/api/migrations/020_farm_animals.sql`
- `apps/api/scripts/migrate.py`
- `apps/api/tests/conftest.py`
- `apps/api/tests/test_api.py`
- `apps/api/tests/test_api007.py`
- `apps/api/tests/test_arch003.py`
- `apps/api/tests/test_catalog_registry.py`
- `apps/api/tests/test_demo_story.py`
- `apps/api/tests/test_farm.py`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/public/models/calf.glb`
- `apps/web/public/models/chicken.glb`
- `apps/web/public/models/duckling.glb`
- `apps/web/public/models/farm_store.glb`
- `apps/web/public/models/goat_kid.glb`
- `apps/web/public/models/paddock_fence.glb`
- `apps/web/public/models/pigeon.glb`
- `apps/web/src/App.tsx`
- `apps/web/src/api/equipment.ts`
- `apps/web/src/api/farm.test.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/api/world.ts`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/ProfileOutfit.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/scene/FarmAnimals.tsx`
- `apps/web/src/scene/GridTown.tsx`
- `apps/web/src/scene/Pigeons.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/catalog.fallback.json`
- `apps/web/src/scene/paddock.test.ts`
- `apps/web/src/scene/paddock.ts`
- `apps/web/src/styles.css`
- `apps/web/test-results/farm-barn-models.png`
- `apps/web/test-results/farm-offer-models.png`
- `apps/web/test-results/farm-paddock-models.png`
- `apps/web/test-results/farm-paddock-offline.png`
- `apps/web/test-results/farm-pigeons-models.png`
- `apps/web/test-results/farm-shop-models.png`
- `apps/web/test-results/farm-village-models.png`
- `apps/web/tests/farm.spec.ts`
- `assets/FARM-008.md`
- `assets/FEAT-008-REPORT.md`
- `assets/README.md`
- `assets/blender/farm_kit.py`
- `assets/blender/farm_preview.py`
- `assets/check_glb.py`
- `assets/previews/farm_contact_sheet.png`
- `assets/register_farm.py`
- `packages/catalog/catalog.json`
- `packages/catalog/catalog.schema.json`
- `packages/catalog/dist/catalog.ts`
- `packages/catalog/validate.test.ts`
- `packages/contracts/api.md`
