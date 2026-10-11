---
id: INTEG-003
status: done
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-003 (from main)
allowed_paths: [apps/**, packages/**, assets/**, workers/**, docs/tasks/INTEG-003.md]
---
# INTEG-003 — Merge the third batch

Same rules as INTEG-001/002 (read their reports): `git merge --no-ff` in order into `integ/INTEG-003`, keeping BOTH sides' behavior:
1. `feat/FEAT-008`: farm store, farm animals, house paddock, fountain pigeons
2. `feat/FEAT-009`: study nook + 📚 Studying idle activity
3. `asset/ASSET-007`: shop art pass + thumbnails. Also link `shirt_stripes.glb` in the catalog, as its report (assets/SHOP_007.md) proposes.
**Migrations:** main uses up to 019 (014 villagergram, 015 idle_activity, 016 reactions, 017 house_colors, 018 gram_video,
019 item_colors). Renumber any new migration on these branches to 020+, in merge order, and update references. FEAT-009 extends
the idle_activity CHECK, so make sure the final CHECK includes every value: home, gardening, dancing, reading, food,
walk_pet, studying.
Keep the Mayor-gather `phase < 120` limit and FIX-004 anchors. Catalog: union, regenerate dist, fix count assertions.
Run all checks (API pytest, web typecheck/test/build, catalog, asset validator, branch e2e) using scratch DBs only. All green.
Don't merge to main. Final report: conflicts and resolutions.


## Integration report

Branch: `integ/INTEG-003`. Baseline: `e92281c`. All three requested feature tips are ancestors of this branch. No push or merge to main.

Merge milestones, in requested order:
- `8fa2c9d` Merge FEAT-008: farm store, house paddocks, animals and fountain pigeons.
- `0bc24a5` Merge FEAT-009: study nook and studying idle activity.
- `302ad4a` Merge ASSET-007: shop art and thumbnails; register striped-shirt model.
- `ccdd626` Integration fixes: farm showcase, debug progression, bounded thumbnail previews and scratch browser harness.
- `5091511` Unlock expectations and art-pack validator scope.
- `72045ed` Thirteen synthetic browser screenshots, including real scratch-API study views.
- `eda7d17` Final seeded-demo decision count and lint correction.

### Conflicts and resolutions

| Branch | Conflicting paths | Resolution |
| --- | --- | --- |
| FEAT-008 | API domain and API/catalog tests; web package/config, App, equipment/mock/types, Modals, ProfileOutfit, Wardrobe, VillageScene, styles; asset validator; catalog JSON/generated TS/test; API contract | Retain earned reward restrictions, acquired metadata/colors, demo seats/debug, goal bursts, Colosseum pause, house settings and shop focus/lock reasons. Add farm departments, first-animal paddock offer, permanent house add-on and six-animal equipment. Union catalog entries, buildings and level unlocks; regenerate TS. Combine styles/contracts. Rename farm migration 016 to 020, update references. |
| FEAT-009 | API models and progression/catalog tests; web package/config, GridTown, VillageScene, scene fallback catalog; asset validator; catalog JSON/generated TS/test; API contract | Preserve all house/consent/pet settings and farm behavior. Add study nook in the park, authored seating/animation and studying preference. Keep house selection, transparent label hit handling and goal bursts. Union starter study unlock with farm progression. Rename studying migration 016 to 021; CHECK includes home, gardening, dancing, reading, food, walk_pet, studying. |
| ASSET-007 | Wardrobe imports, styles, assets/CATALOG.md, asset catalog/preview scripts | Retain color editor and rotating preview alongside thumbnails, farm department and reward gates. Keep outfit and shop-fit preview modes and both documentation sections. Regenerate asset catalog from final GLBs. |

Integration choices:
- 197 catalog entries; striped shirt uses `/models/shirt_stripes.glb`, villager-base anchor, zero offset/rotation, scale 1, shirt/wall tint materials and skinned/rebind tags. Voice sculptures remain presentation assets.
- Mayor gathering still requires `phase < 120`. FIX-004 rig anchors and cosmetic fitting code are unchanged from baseline. Color tests inspect descendant meshes through its existing wrapper.
- Farm items appear in house showcase details, with no unequip action for permanent paddocks. Shop links switch to the appropriate department and preserve focused-item behavior.
- Mock debug XP advances persistent earned village XP; purchases cannot revoke farm unlocks. Level-up feed and debug weather remain intact.
- Thumbnail art is scoped to the 29 authored ASSET-007 cards. Newer outfits and farm items retain icons; failed authored thumbnails keep the live GLB/procedural fallback. This prevents a canvas per missing newer-item PNG.
- Browser suites use the shared seat hook. Real study checks use the existing scratch-DB fixture with test-only day/night endpoints and no paid providers or generated personal assets.
- Credentials load at runtime from `VILLAGE_ENV_FILE`; no secret values copied. DB writes are restricted to `village_test` and disposable test schemas.

### Validation

All required checks are green. Final API sweep: 340 passed, 3 expected opt-in skips; web: 88 unit tests; catalog: 25 tests; asset validator: 24 regressions and 185 GLBs; 14 distinct browser cases passed. Every final verification command exited 0. The real study browser case passed through the opt-in harness separately.

| Directory | Command | Result |
| --- | --- | --- |
| apps/api | `python -m uv run pytest -q --tb=short` | Initial exit 1: 337 passed, 3 opt-in skipped, two stale count assertions and one scratch-DB connection timeout. |
| apps/api | `python -m uv run pytest -q --lf --tb=short` | Exit 0; all 3 affected cases passed. |
| apps/api | `python -m uv run pytest -q --tb=short` | Final exit 0: 340 passed, 3 opt-in skips in 217.29 seconds. |
| apps/web | `bun run typecheck` | Exit 0. |
| apps/web | `bun run test` | Final exit 0: 88 tests, 9512 assertions. Initial two stale pre-FIX-004 mesh-path assertions fixed. |
| apps/web | `bun run build` | Final exit 0; existing large-chunk advisory only. |
| packages/catalog | `bun run validate` / `bun test` | Exit 0 each; 197 entries, 25 tests. |
| repository | `python assets/check_glb.py` | Exit 0; 185 GLBs, zero failures. |
| repository | `python assets/test_check_glb.py` | Exit 0; 24 tests. |
| repository | `python assets/validate_shop_007.py` | Final exit 0; 16 preserved material/node contracts, 29 RGBA 512px thumbnails. Initial expanded-catalog scope corrected. |
| repository | `python assets/validate_houses_006.py` | Exit 0; 28 houses, zero failures. |
| repository | `python assets/catalog.py` | Exit 0; regenerated final asset documentation. |
| apps/web | `bunx playwright test farm.spec.ts equipment.spec.ts colors.spec.ts house.spec.ts --project=mock` | Initial exit 1: 8 passed, offline farm timed out while implementation was still changing. |
| apps/web | `bunx playwright test farm.spec.ts --project=mock` | Final exit 0; 2 model/offline farm cases. |
| apps/web | `bunx playwright test --config playwright.feat009.config.ts` | Final exit 0; 2 model/offline study cases. Initial offline run lost the test fixture override during hot reload; rerun on stable code passed. |
| apps/api | `python -m uv run ruff check app/domain.py app/models.py scripts/migrate.py tests/test_integ_e2e.py tests/test_farm.py tests/test_catalog_registry.py tests/test_web017.py tests/test_api007.py tests/test_demo_story.py` | Final exit 0; wrapped long SQL/type/assertion lines. |
| repository | `node apps/web/node_modules/@playwright/test/cli.js test --config assets/shop007.playwright.config.ts` | Final exit 0; 2 cases covering shop/wardrobe/showcase, live fallback and offline purchases. Stable screenshots recaptured after catalog regeneration. |
| apps/api | `python -m uv run pytest tests/test_integ_e2e.py -q -s --basetemp=.runtime/integ003-browser` with `INTEG_E2E=1`, `INTEG_E2E_CONFIG=playwright.feat009-real.config.ts` | Exit 0; 1 harness and 1 real browser case, settings persistence plus day/night seating; clean server/schema teardown. |
| repository | `git diff --check` | Exit 0. |

### Teammate walkthrough

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5198
```

Open http://localhost:5198 and select Iraj. Use Debug to grant 2,000 XP, then open
Shop > Farm Store. Buy Chicken and accept the 110-XP paddock-plus-animal offer;
buy Duckling and inspect the house side yard. Dogs and house cosmetics remain
independent. In My profile, select Studying and watch friends share the study
nook. Open Shop/Wardrobe/showcase to inspect thumbnails, colors and rotating
previews. The same flows work without GPU assets.

For real study persistence, from `apps/api` set `VILLAGE_ENV_FILE` to the external
env, `INTEG_E2E=1`, and `INTEG_E2E_CONFIG=playwright.feat009-real.config.ts`; run
`python -m uv run pytest tests/test_integ_e2e.py -q -s --basetemp=.runtime/integ003-browser`.
The harness owns port 8021 and removes its private `village_test` schema on exit.

Evidence is under `apps/web/tests/screenshots/INTEG-003/`: farm shop/paddock/pigeons,
study day/night with loaded and missing models, and shop/wardrobe/live fallback; `study-day-real.png` and `study-night-real.png` capture the scratch API.
Farm paddock, study profile, real study seating and final shop screenshots were visually reviewed.

Blockers: none. No proposed contract changes beyond the merged API documentation, farm slot/kind
schema and catalog registration. No paid generation, messaging or Solana calls.
Hardware-GPU frame-rate certification is not claimed; browser tests use SwiftShader.


### Files changed relative to task baseline

- `apps/api/app/domain.py`
- `apps/api/app/models.py`
- `apps/api/migrations/007_shop_equipment.sql`
- `apps/api/migrations/020_farm_animals.sql`
- `apps/api/migrations/021_idle_studying.sql`
- `apps/api/scripts/feat009_preview.py`
- `apps/api/scripts/migrate.py`
- `apps/api/tests/conftest.py`
- `apps/api/tests/test_api007.py`
- `apps/api/tests/test_catalog_registry.py`
- `apps/api/tests/test_demo_story.py`
- `apps/api/tests/test_farm.py`
- `apps/api/tests/test_integ_e2e.py`
- `apps/api/tests/test_web017.py`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/playwright.feat009-real.config.ts`
- `apps/web/playwright.feat009.config.ts`
- `apps/web/public/models/calf.glb`
- `apps/web/public/models/chicken.glb`
- `apps/web/public/models/duckling.glb`
- `apps/web/public/models/farm_store.glb`
- `apps/web/public/models/flowers_a.glb`
- `apps/web/public/models/fountain.glb`
- `apps/web/public/models/glasses_round.glb`
- `apps/web/public/models/goat_kid.glb`
- `apps/web/public/models/hat_beanie.glb`
- `apps/web/public/models/hat_cap.glb`
- `apps/web/public/models/hat_cowboy.glb`
- `apps/web/public/models/hat_crown.glb`
- `apps/web/public/models/hat_festival.glb`
- `apps/web/public/models/hat_headphones.glb`
- `apps/web/public/models/house_backyard.glb`
- `apps/web/public/models/jacket_denim.glb`
- `apps/web/public/models/lantern.glb`
- `apps/web/public/models/paddock_fence.glb`
- `apps/web/public/models/pet_dog.glb`
- `apps/web/public/models/pet_dog_b.glb`
- `apps/web/public/models/pigeon.glb`
- `apps/web/public/models/scarf.glb`
- `apps/web/public/models/shirt_hoodie.glb`
- `apps/web/public/models/shirt_stripes.glb`
- `apps/web/public/models/study_nook.glb`
- `apps/web/public/models/voice_hype_coach.glb`
- `apps/web/public/models/voice_pirate.glb`
- `apps/web/public/models/voice_shakespearean.glb`
- `apps/web/public/thumbs/auditor_badge.png`
- `apps/web/public/thumbs/champion_mantle.png`
- `apps/web/public/thumbs/competition_laurels.png`
- `apps/web/public/thumbs/decor_flowers.png`
- `apps/web/public/thumbs/decor_fountain.png`
- `apps/web/public/thumbs/decor_lamp.png`
- `apps/web/public/thumbs/festival_vip.png`
- `apps/web/public/thumbs/glasses_round.png`
- `apps/web/public/thumbs/hat_beanie.png`
- `apps/web/public/thumbs/hat_cap.png`
- `apps/web/public/thumbs/hat_cowboy.png`
- `apps/web/public/thumbs/hat_crown.png`
- `apps/web/public/thumbs/hat_festival.png`
- `apps/web/public/thumbs/hat_headphones.png`
- `apps/web/public/thumbs/house_backyard.png`
- `apps/web/public/thumbs/house_lv2.png`
- `apps/web/public/thumbs/house_lv3.png`
- `apps/web/public/thumbs/jacket_denim.png`
- `apps/web/public/thumbs/mayor_medal.png`
- `apps/web/public/thumbs/perfect_week_halo.png`
- `apps/web/public/thumbs/pet_dog.png`
- `apps/web/public/thumbs/pet_dog_b.png`
- `apps/web/public/thumbs/scarf.png`
- `apps/web/public/thumbs/shirt_hoodie.png`
- `apps/web/public/thumbs/shirt_stripes.png`
- `apps/web/public/thumbs/streak_flame_scarf.png`
- `apps/web/public/thumbs/voice_hype_coach.png`
- `apps/web/public/thumbs/voice_pirate.png`
- `apps/web/public/thumbs/voice_shakespearean.png`
- `apps/web/src/App.tsx`
- `apps/web/src/api/equipment.ts`
- `apps/web/src/api/farm.test.ts`
- `apps/web/src/api/idleActivity.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/api/settings.test.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/api/world.ts`
- `apps/web/src/components/ItemThumbnail.test.tsx`
- `apps/web/src/components/ItemThumbnail.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/ProfileOutfit.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/components/showcaseData.ts`
- `apps/web/src/scene/FarmAnimals.tsx`
- `apps/web/src/scene/GridTown.tsx`
- `apps/web/src/scene/OptionalModel.tsx`
- `apps/web/src/scene/Pigeons.tsx`
- `apps/web/src/scene/StudyNook.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/catalog.fallback.json`
- `apps/web/src/scene/itemColors.test.ts`
- `apps/web/src/scene/layout/navigation.ts`
- `apps/web/src/scene/layout/studySeats.test.ts`
- `apps/web/src/scene/layout/studySeats.ts`
- `apps/web/src/scene/layout/town.ts`
- `apps/web/src/scene/paddock.test.ts`
- `apps/web/src/scene/paddock.ts`
- `apps/web/src/scene/worldTypes.ts`
- `apps/web/src/styles.css`
- `apps/web/test-results/farm-barn-models.png`
- `apps/web/test-results/farm-offer-models.png`
- `apps/web/test-results/farm-paddock-models.png`
- `apps/web/test-results/farm-paddock-offline.png`
- `apps/web/test-results/farm-pigeons-models.png`
- `apps/web/test-results/farm-shop-models.png`
- `apps/web/test-results/farm-village-models.png`
- `apps/web/tests/farm.spec.ts`
- `apps/web/tests/feat009-real.spec.ts`
- `apps/web/tests/feat009.spec.ts`
- `apps/web/tests/screenshots/INTEG-003/farm-paddock-models.png`
- `apps/web/tests/screenshots/INTEG-003/farm-paddock-offline.png`
- `apps/web/tests/screenshots/INTEG-003/farm-pigeons-models.png`
- `apps/web/tests/screenshots/INTEG-003/farm-shop-models.png`
- `apps/web/tests/screenshots/INTEG-003/shop_fallback_ui.png`
- `apps/web/tests/screenshots/INTEG-003/shop_ui.png`
- `apps/web/tests/screenshots/INTEG-003/shop_wardrobe_ui.png`
- `apps/web/tests/screenshots/INTEG-003/study-day-fallback.png`
- `apps/web/tests/screenshots/INTEG-003/study-day-glb.png`
- `apps/web/tests/screenshots/INTEG-003/study-day-real.png`
- `apps/web/tests/screenshots/INTEG-003/study-night-fallback.png`
- `apps/web/tests/screenshots/INTEG-003/study-night-glb.png`
- `apps/web/tests/screenshots/INTEG-003/study-night-real.png`
- `assets/CATALOG.md`
- `assets/FARM-008.md`
- `assets/FEAT-008-REPORT.md`
- `assets/README.md`
- `assets/SHOP_007.md`
- `assets/STUDY_NOOK_009.md`
- `assets/blender/farm_kit.py`
- `assets/blender/farm_preview.py`
- `assets/blender/preview.py`
- `assets/blender/shop_007.py`
- `assets/blender/shop_preview_007.py`
- `assets/blender/study_nook.py`
- `assets/check_glb.py`
- `assets/previews/.gitignore`
- `assets/previews/farm_contact_sheet.png`
- `assets/previews/shop_after.png`
- `assets/previews/shop_baseline_models/flowers_a.glb`
- `assets/previews/shop_baseline_models/fountain.glb`
- `assets/previews/shop_baseline_models/glasses_round.glb`
- `assets/previews/shop_baseline_models/hat_beanie.glb`
- `assets/previews/shop_baseline_models/hat_cap.glb`
- `assets/previews/shop_baseline_models/hat_cowboy.glb`
- `assets/previews/shop_baseline_models/hat_crown.glb`
- `assets/previews/shop_baseline_models/hat_festival.glb`
- `assets/previews/shop_baseline_models/hat_headphones.glb`
- `assets/previews/shop_baseline_models/house_backyard.glb`
- `assets/previews/shop_baseline_models/house_lv2.glb`
- `assets/previews/shop_baseline_models/house_lv3.glb`
- `assets/previews/shop_baseline_models/jacket_denim.glb`
- `assets/previews/shop_baseline_models/lantern.glb`
- `assets/previews/shop_baseline_models/pet_dog.glb`
- `assets/previews/shop_baseline_models/pet_dog_b.glb`
- `assets/previews/shop_baseline_models/scarf.glb`
- `assets/previews/shop_baseline_models/shirt_hoodie.glb`
- `assets/previews/shop_before.png`
- `assets/previews/shop_before_after.png`
- `assets/previews/shop_before_tiles/auditor_badge.png`
- `assets/previews/shop_before_tiles/champion_mantle.png`
- `assets/previews/shop_before_tiles/competition_laurels.png`
- `assets/previews/shop_before_tiles/decor_flowers.png`
- `assets/previews/shop_before_tiles/decor_fountain.png`
- `assets/previews/shop_before_tiles/decor_lamp.png`
- `assets/previews/shop_before_tiles/festival_vip.png`
- `assets/previews/shop_before_tiles/glasses_round.png`
- `assets/previews/shop_before_tiles/hat_beanie.png`
- `assets/previews/shop_before_tiles/hat_cap.png`
- `assets/previews/shop_before_tiles/hat_cowboy.png`
- `assets/previews/shop_before_tiles/hat_crown.png`
- `assets/previews/shop_before_tiles/hat_festival.png`
- `assets/previews/shop_before_tiles/hat_headphones.png`
- `assets/previews/shop_before_tiles/house_backyard.png`
- `assets/previews/shop_before_tiles/house_lv2.png`
- `assets/previews/shop_before_tiles/house_lv3.png`
- `assets/previews/shop_before_tiles/jacket_denim.png`
- `assets/previews/shop_before_tiles/mayor_medal.png`
- `assets/previews/shop_before_tiles/perfect_week_halo.png`
- `assets/previews/shop_before_tiles/pet_dog.png`
- `assets/previews/shop_before_tiles/pet_dog_b.png`
- `assets/previews/shop_before_tiles/scarf.png`
- `assets/previews/shop_before_tiles/shirt_hoodie.png`
- `assets/previews/shop_before_tiles/shirt_stripes.png`
- `assets/previews/shop_before_tiles/streak_flame_scarf.png`
- `assets/previews/shop_before_tiles/voice_hype_coach.png`
- `assets/previews/shop_before_tiles/voice_pirate.png`
- `assets/previews/shop_before_tiles/voice_shakespearean.png`
- `assets/previews/shop_fallback_ui.png`
- `assets/previews/shop_fit.png`
- `assets/previews/shop_ui.png`
- `assets/previews/shop_wardrobe_ui.png`
- `assets/previews/study_nook_contact.png`
- `assets/previews/study_nook_day.png`
- `assets/previews/study_nook_night.png`
- `assets/register_farm.py`
- `assets/shop007.playwright.config.ts`
- `assets/shop_baseline_007.json`
- `assets/shop_sheet_007.py`
- `assets/tests/shop007.spec.ts`
- `assets/validate_shop_007.py`
- `docs/tasks/INTEG-003.md`
- `packages/catalog/catalog.json`
- `packages/catalog/catalog.schema.json`
- `packages/catalog/dist/catalog.ts`
- `packages/contracts/api.md`
