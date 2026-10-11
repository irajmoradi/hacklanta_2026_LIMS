> Historical feature-branch report. Integrated behavior, coin screenshots, and current verification: [INTEG-011 report](../../docs/INTEG-011-REPORT.md).

# FEAT-013 — walk-in shops and more pets

Branch: `feat/FEAT-013`.

Implementation commits: `d2d1a8d` (pet assets), `cd95ed4` (interiors and interactions), `c781fb7` (coin compatibility). The final report/evidence commit follows these. No push or merge performed.

## Delivered

- Fenced the farm store's outdoor animals with the existing paddock fence and its procedural fallback.
- Added both sketch-based interiors, a pre-warmed renderer, a 360 ms doorway camera transition, current-user avatar at checkout, success-only coin handoff/bag animation with the existing purchase sound, and Escape/back to town. Town rendering pauses inside shops.
- Boutique: shelves, folded clothing, hanging rack, four catalog-driven mannequins rotating their featured set every 20 seconds, accessories case, mirror, checkout/register/plant, fitting curtain, rug, pendant lights, sale/price signs, hat stand and shoe boxes.
- Farm: feed/toy/leash shelves, counter, cat bed/bowl, two labelled pet houses, two pens, all seven new pets, hamster cage, duckling bath, hay, trough, barn wall, chalkboard and string lights.
- Seven deterministic GLBs and transparent thumbnails: tabby, black and calico cats; pug and husky; bunny; hamster in a cage. 276–900 triangles each, with named idle bob pivots. Dogs/cats follow; bunny/hamster remain at home; farm animals retain paddock behavior.
- Existing purchase, equipment, voice, photo-item and villager-gram functionality remains accessible. Mobile, reduced-motion and missing-model modes work.

## Currency and integration

This worktree fork predates INTEG-010, but current `main` includes its coin wallet migration (`e80ec8f`). **New pet entries use `price_coins`**, priced at 65–140 coins. Their entries were independently validated against current main's catalog schema.

The local catalog schema accepts either legacy XP or coin pricing so this older checkout/API can still run. Legacy adapters map numeric prices into their existing XP response; the UI detects actual coin-shaped API responses, uses coin prices, and avoids overwriting villager XP with a coin balance. Consequently the isolated legacy mock screenshots show XP; after integration with main the same entries/UI use coins.

Integrator: retain main's INTEG-010 wallet, API SQL, `price_coins` types/schema, and currency components when resolving conflicts. Incorporate the seven new coin-priced entries and shop callbacks/layout. Do not replace main's migrated registry SQL with this branch's older XP SQL. No HTTP/schema contract changes are proposed beyond the already-landed INTEG-010 contract. Run the existing catalog sync against the migrated deployment to publish the new items; this task validated sync but did not mutate the shared production catalog.

## Validation

All final commands below exited **0**:

| Working directory | Command | Result |
| --- | --- | --- |
| root | `& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python assets/blender/pets_013.py` | Generated all seven models/thumbnails; triangle assertions passed |
| root | `python assets/validate_pets_013.py` | Independently checked GLB headers, triangle counts, pivots, thumbnails, prices and followability |
| `packages/catalog` | `bun run validate` | 300 entries; generated types/data |
| `packages/catalog` | `bun test` | 36 passed |
| `apps/web` | `bun run build` | TypeScript and Vite passed; existing large-chunk warning remains |
| `apps/web` | `bun run test` | 102 passed |
| `apps/web` | `bun test src/api/shopCurrency.test.ts` | 2 passed |
| `apps/web` | `$env:VILLAGE_BROWSER_GPU='hardware'; bunx playwright test --config playwright.feat013.config.ts` | 3 passed: purchases/bag animation, live pet displays, outfit rotation, Escape/back, mobile/missing assets/reduced motion |
| `apps/api` | `& 'C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe' -m pytest tests/test_catalog_registry.py -q` | 16 passed, including isolated database sync tests |
| `apps/api` | `& 'C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe' scripts/sync_catalog.py --dry-run` | 300 content entries, 64 shop items, 6 event packs |
| root | `git diff --check` | Clean |

API commands used `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env` at runtime. No secrets were copied, printed or committed. No paid generation or messaging calls were made.

Initial checks exposed a missing nested pot dependency installation (resolved with the existing `npm ci --prefix src/components/pot --install-links --no-audit --no-fund` workflow), a stale API test expectation missing the already-existing fitness corner (updated), and an ambiguous duplicate display-name selector (scoped to the item ID). Bare `bun test` in web exits 1 because it tries to execute Playwright suites; the supported `bun run test` passes. Screenshot QA also caught and fixed the pre-existing modal width rule overriding the new fullscreen layout.

## Visual and performance evidence

Reviewed screenshots:

- `apps/web/artifacts/feat013/boutique.png`
- `apps/web/artifacts/feat013/farm.png`
- `apps/web/artifacts/feat013/farm-mobile-fallback.png`

`apps/web/artifacts/feat013/performance.json` records an approximately 364 ms entrance, 11,766 boutique triangles and 8,362 farm triangles (whole visible scene graph, including fixture shopper and displays). Both rooms measured a 16.7 ms median / 16.8 ms p95 frame interval on RTX 5090 / D3D11 at 1440×900, approximately 60 fps. This is hardware-specific evidence, not a guarantee for software GL or arbitrary generated user heads. Software GL was exercised during development but did not sustain 60 fps.

## Changed files

- `apps/web/src/App.tsx`; `components/Modals.tsx`, `Wardrobe.tsx`, `shopInterior.css`; `scene/ShopInterior.tsx`, `FarmAnimals.tsx`, `VillageScene.tsx`.
- `apps/web/src/api/equipment.ts`, `types.ts`, `shopState.ts`, `shopCurrency.ts`, `shopCurrency.test.ts`.
- `apps/web/playwright.feat013.config.ts`, `tests/feat013.spec.ts`, this report and `artifacts/feat013/*`.
- Seven `apps/web/public/models/pet_*.glb` and matching `public/thumbs/pet_*.png`: `cat_tabby`, `cat_black`, `cat_calico`, `pug`, `husky`, `bunny`, `hamster`.
- `assets/blender/pets_013.py`, `assets/validate_pets_013.py`, `assets/pets_013_validation.json`.
- `packages/catalog/catalog.json`, `catalog.schema.json`, `dist/catalog.ts`.
- `apps/api/app/catalog_registry.py`, `apps/api/tests/test_catalog_registry.py`.

## Try it

From `apps/web` in PowerShell: `$env:VITE_MOCK='1'; $env:VITE_DEMO_AUTH='1'; bun run dev --port 5193`. Choose Iraj, open Shop, buy Cozy Beanie, then choose Farm Store and buy Tabby Cat. Watch checkout; Escape/back returns to town. The mannequin set changes after 20 seconds. Alternatively run the dedicated Playwright command above for an isolated preview and fresh evidence. No GPU worker is needed.

No runtime blockers on this branch. The expected parallel-branch currency conflict handling and deployment catalog sync are the integration steps described above.
