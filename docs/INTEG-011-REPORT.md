# INTEG-011 final report

Branch: `integ/INTEG-011`. Integration milestone: `27816b7` (two-parent merge of `feat/FEAT-013`, tip `f26d99a`). Follow-up verification/report commit is the branch tip. No merge or push to main.

## Result

- Retained the coin-only API/catalog schema, wallet components, coin buy buttons and lock reasons. Shop purchases update local `coins`, never XP. Removed the obsolete feature-branch XP compatibility helper. Interior price signs also say coins; village unlock progress still correctly uses XP.
- Kept both furnished interiors, successful-purchase coin/bag animation and sound, outdoor farm fence, seven pet GLBs/thumbnails, followable cats/dogs, and fixture/missing-model fallbacks.
- Mannequins now use the existing villager rig and `OptionalModel.equipment`, applying FIX-008's cosmetic attachment, body fitting, skin binding and sleeve rules. Browser assertions verify all four displayed outfits attach through that path.
- Preserved WASD, dragging, ride parenting, temporary activities, modal/input guards, organic map and ambience. Shop and farm-store drops open their corresponding interiors; locked/closed destinations remain excluded.
- `ShopInterior` has a default export and is consumed through React lazy/Suspense. Vite emits a separate approximately 13.5 kB interior chunk. PERF-002 can defer its mounting/prewarming independently.
- Regenerated the catalog: 300 content entries, 64 shop items, six event packs. Existing API/catalog count assertions already derive their expectations from the registry, so no stale numeric count remained to replace. Seven additional catalog tests inspect shipped pet GLB headers, triangle limits, idle pivots, PNG signatures, coin prices and followability.

## Scope and choices

All final tree changes are in `apps/**`, `packages/**`, or `docs/**`. The incoming `assets/blender/pets_013.py`, `assets/validate_pets_013.py`, and `assets/pets_013_validation.json` were excluded because `assets/**` is outside this integration task's allowed paths. The equivalent shipped-asset validation is now in `packages/catalog/pets.test.ts`; runtime assets are included. No root, env, contract, or other branch edits. API code resolved to the existing main implementation.

Secrets were read only at runtime using `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env`; none were copied or printed. API tests used their isolated `village_test` schemas. No paid generation, messages, signing, or shared deployment catalog writes.

## Checks (actual commands and exit codes)

PowerShell API command prefix: `$env:VILLAGE_ENV_FILE='C:/Users/mourn/Downloads/hacklanta/.env'`; interpreter: `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`.
Browser commands use `$env:VILLAGE_BROWSER_GPU='hardware'` on this machine.

| Directory | Command | Exit | Result |
| --- | --- | --- | --- |
| packages/catalog | `bun install --frozen-lockfile` | 0 | Locked dependencies installed |
| apps/web | `bun install --frozen-lockfile` | 0 | Includes existing nested pot postinstall |
| packages/catalog | `bun run validate` | 0 | 300 entries; dist regenerated |
| packages/catalog | `bun test` | 0 | 43 passed, including seven shipped-pet validators |
| apps/web | `bun run build` | 0 | TS + Vite; separate ShopInterior chunk |
| apps/web | `bun run test` | 0 | 126 passed |
| apps/web | `bunx playwright test --config playwright.feat013.config.ts` | 0 | 3 passed: coin checkout/XP preservation/fitted mannequins, outfit rotation, mobile/reduced motion/missing assets |
| apps/web | `bunx playwright test --config playwright.integ010.config.ts coins.spec.ts web019.spec.ts` | 1 | 5 passed, 2 drag-test failures; both coin/SOL tests passed |
| apps/web | `bunx playwright test --config playwright.integ010.config.ts web019.spec.ts` | 0 | All 5 passed after targeting actual ground coordinates, collapsing the obstructing dashboard and waiting for stable pickup labels; includes both shop entrances |
| apps/api | `& 'C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe' -m pytest -q` | 1 | 417 passed, 3 skipped, one intermittent scheduler idle-message assertion failed |
| apps/api | `& 'C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe' -m pytest tests/test_v2.py::test_scheduler_limits_consent_roast_and_idle tests/test_catalog_registry.py -q` | 0 | 17 passed; failed scheduler test passed unchanged on isolated rerun |
| apps/api | `& 'C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe' scripts/sync_catalog.py --dry-run` | 0 | 300 content entries, 64 shop items, 6 event packs |
| root | `git diff --check` | 0 | Clean |

Initial build/validation attempts exited 1 because this fresh worktree had no dependencies; fixed by locked installs. Early interior tests also exited 1 on a mistaken 25-coin beanie expectation (actual catalog price 30; corrected) and cold-start timing. The timed prewarm test now waits for initial model network activity to settle, without relaxing the 400 ms assertion. The full API suite is **not** reported as green: its one intermittent failure is retained above. No unrelated scheduler code was changed.

## Visual and performance review

Reviewed coin-era screenshots:

- `apps/web/artifacts/feat013/boutique.png`
- `apps/web/artifacts/feat013/farm.png`
- `apps/web/artifacts/feat013/farm-mobile-fallback.png`
- `apps/web/artifacts/integ011/drop-shop.png` (town after returning from the drag-opened shop)

`apps/web/artifacts/feat013/performance.json`: warmed entrance 369.5 ms; boutique 12,646 triangles; farm 8,362 triangles; both median and p95 frame intervals approximately 16.7 ms on RTX 5090/D3D11 at 1440x900. Cold-start openings while town models/shaders were still loading measured 771-910 ms in failed timing runs. The warmed transition target passes; cold startup is a performance limitation for PERF-002, not a universal sub-400 ms guarantee. Existing large-bundle build warnings remain.

## Try it

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5193
```

Choose Iraj. Open Shop, buy Cozy Beanie (420 -> 390 coins, XP stays 420), switch to Farm Store and buy Tabby Cat. Observe checkout; Escape or Back to town returns to town. Hold the current avatar and drop onto Shop or the unlocked Farm Store to open the corresponding room. Collapse the dashboard if it covers the target. No GPU worker or generated assets required.

For API deployment, run the existing catalog sync against the migrated deployment after this branch is integrated; only dry-run and isolated database sync tests were performed here.

Blockers: no integration blockers. Verification limitations: one full-suite API flake (passes isolated), cold-start entrance latency, existing bundle warnings. Proposed contract changes: none.

## Files changed from task base

- `apps/web/FEAT-013-REPORT.md`
- `apps/web/artifacts/feat013/boutique.png`
- `apps/web/artifacts/feat013/farm-mobile-fallback.png`
- `apps/web/artifacts/feat013/farm.png`
- `apps/web/artifacts/feat013/performance.json`
- `apps/web/artifacts/integ011/drop-shop.png`
- `apps/web/playwright.feat013.config.ts`
- `apps/web/public/models/pet_bunny.glb`
- `apps/web/public/models/pet_cat_black.glb`
- `apps/web/public/models/pet_cat_calico.glb`
- `apps/web/public/models/pet_cat_tabby.glb`
- `apps/web/public/models/pet_hamster.glb`
- `apps/web/public/models/pet_husky.glb`
- `apps/web/public/models/pet_pug.glb`
- `apps/web/public/thumbs/pet_bunny.png`
- `apps/web/public/thumbs/pet_cat_black.png`
- `apps/web/public/thumbs/pet_cat_calico.png`
- `apps/web/public/thumbs/pet_cat_tabby.png`
- `apps/web/public/thumbs/pet_hamster.png`
- `apps/web/public/thumbs/pet_husky.png`
- `apps/web/public/thumbs/pet_pug.png`
- `apps/web/src/App.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/components/shopInterior.css`
- `apps/web/src/scene/FarmAnimals.tsx`
- `apps/web/src/scene/ShopInterior.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/playerControl.test.ts`
- `apps/web/src/scene/playerControl.ts`
- `apps/web/src/scene/usePlayerController.ts`
- `apps/web/tests/feat013.spec.ts`
- `apps/web/tests/web019.spec.ts`
- `apps/web/tests/web019Scene.ts`
- `packages/catalog/catalog.json`
- `packages/catalog/dist/catalog.ts`
- `packages/catalog/pets.test.ts`
- `docs/INTEG-011-REPORT.md`
