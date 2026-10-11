# FEAT-003 completion report

Branch: `feat/FEAT-003`.
Implementation commits: `76ba88e` (catalog and award hooks), `5b87a4d` (showcases, integration, screenshots).

Profiles now show a full villager turntable with equipment tiles, followed by a house turntable with decoration tiles. Drag rotates, wheel/pinch zooms, and equipped items highlight on hover/selection. Cards show description, slot, rarity, source, acquisition date when available, and owner-only equipment controls. Mobile tiles sit below the model. House clicks open the owner’s profile at the house section. The old Outfit list is replaced; the existing owner Wardrobe tab remains an alternate view, with the showcase hidden while that tab is open.

Seven cosmetics reuse existing GLBs and recolors. Server-owned triggers grant weekly-crown, perfect-week, 28-day-streak, auditor, festival-VIP, Mayor-event, and audited-competition rewards. Grants are transactional, idempotent, free, and unequipped. The shop rejects purchase attempts for earned items. Locked reward silhouettes explain their conditions in both shop and showcase.

Owner photo inventory uses the existing `/items` route, allowing removed photo items to be equipped again. Peers receive only public equipment. Photo decorations load authenticated GLBs with a geometric fallback. Missing generated assets and an offline GPU do not prevent showcase use.

## Verification

All commands below completed with exit code **0**. API commands ran from `apps/api`, with `VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env` supplied at runtime. Secrets were not copied. Database tests used the repository’s isolated `village_test` schemas and mocked providers.

| Directory | Command | Result |
| --- | --- | --- |
| `apps/api` | `python -m uv run pytest tests/test_feat003.py tests/test_catalog_registry.py tests/test_api003.py tests/test_api.py -q --tb=short` | 70 passed |
| `apps/api` | `python -m uv run pytest tests/test_feat003.py tests/test_catalog_registry.py -q --tb=short --basetemp=.runtime/feat003-final` | 22 passed after final shop scoping |
| `apps/api` | `python -m uv run pytest tests/test_api011.py -q --tb=short --basetemp=.runtime/feat003-photo-items` | 8 passed, 1 skipped; photo-item regressions |
| `apps/api` | `python -m uv run pytest tests/test_api012.py -q --tb=short --basetemp=.runtime/feat003-photo` | 14 passed, 1 skipped; additional gazette regressions |
| `apps/api` | `python -m uv run ruff check app/rewards.py tests/test_feat003.py app/catalog_registry.py app/domain.py app/main.py app/weekly.py app/competitions.py` | All checks passed |
| `packages/catalog` | `bun run validate` | 149 definitions validated and types regenerated |
| `packages/catalog` | `bun test` | 23 passed |
| `apps/web` | `bun test src/components/showcaseData.test.ts src/api/equipment.test.ts src/api/mock.test.ts src/scene/cosmeticAssets.test.ts src/scene/OptionalModel.test.ts` | 20 passed |
| `apps/web` | `bunx playwright test --config tests/feat003.config.ts` | 3 passed; desktop, mobile, all-models-offline |
| `apps/web` | `bunx playwright test --config tests/web016.config.ts` | 2 passed; prior profile/custom-item behavior |
| `apps/web` | `bun run typecheck` | Passed |
| `apps/web` | `bun run build` | Passed; Vite warns about existing large chunks |
| repository | `git diff --check` | Passed |

The two skipped API cases require explicit paid live-provider opt-in. No paid generation or messaging was requested by these changes. Initial setup and test-fixture failures were corrected before the successful runs above.

## Screenshots

Actual Playwright browser captures in fixture/mock mode, visually inspected:

- `apps/web/tests/screenshots/FEAT-003/showcase-1366.png`
- `apps/web/tests/screenshots/FEAT-003/showcase-390.png`
- `apps/web/tests/screenshots/FEAT-003/detail-1366.png`
- `apps/web/tests/screenshots/FEAT-003/detail-390.png`
- `apps/web/tests/screenshots/FEAT-003/house-1366.png`
- `apps/web/tests/screenshots/FEAT-003/house-390.png`
- `apps/web/tests/screenshots/FEAT-003/reward-1366.png`
- `apps/web/tests/screenshots/FEAT-003/reward-390.png`
- `apps/web/tests/screenshots/FEAT-003/fixture-fallback.png`
- `apps/web/tests/screenshots/FEAT-003/shop-rewards.png`

## Try it

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
bun run dev --port 5198
```

Open `http://localhost:5198`, choose **My profile**, click Headphones, and unequip/re-equip it. Expand **Earn your next signature** for the seven locked rewards. Click a neighbor’s house to jump to their house turntable; peer details have no equipment actions. Open **Shop** to see reward requirements without purchase buttons. Repeat at 390px width. The Playwright command above verifies model-offline fallback automatically.

For live API integration, after merging and before serving the new API, publish the registry using the existing command from `apps/api`:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
python -m uv run python scripts/sync_catalog.py
```

This live catalog sync was **not** run during the task. Existing database constraints provide award idempotency; no schema migration is needed.

## Choices and integration notes

- A perfect week means check-ins on every UTC date Monday–Sunday; a four-week streak means 28 consecutive UTC dates. Multiple submissions on one date count once.
- Festival VIP is granted for owner-confirmed rewarded Mayor `game_night` participation. Friendly competition wins do not grant the verified-win cosmetic.
- Historical events are not backfilled. Awards preserve acquisition date and equipped slots on retries.
- House style uses the current `homeEntry` model and level. WEB-018’s future palette fields are not assumed. Supplied decoration/photo equipment is rendered from existing contracts.
- Town event packs receive explicit event sources but stay outside personal shop inventory. Scene-only progression entries use `earned:village_progression`.
- The catalog validator still checks every referenced GLB. Unreferenced art-pack files may coexist, matching the API’s existing allowance for parallel art rollout.
- `packages/contracts/api.md` documents the metadata and award rules. No further contract changes are proposed.
- No blockers. Integrator should preserve both these showcase changes and parallel WEB-018/FEAT profile work when resolving merges.

## Changed files

API: `apps/api/app/{catalog_registry,competitions,domain,main,rewards,weekly}.py`; `apps/api/tests/{test_api,test_catalog_registry,test_feat003}.py`.

Web: `apps/web/src/App.tsx`; `apps/web/src/api/{client,equipment,mock,types}.ts`; `apps/web/src/components/{ProfileOutfit,ProfilePanel,ShowcasePreview,Wardrobe}.tsx`; `apps/web/src/components/{showcaseData,showcaseData.test}.ts`; `apps/web/src/scene/VillageScene.tsx`; `apps/web/src/scene/cosmeticAssets.ts`; `apps/web/src/styles.css`.

Tests/artifacts: `apps/web/tests/{feat003.config,feat003.spec,web016.spec}.ts`; `apps/web/tests/web016-real.mjs`; the ten PNGs listed above; this report.

Catalog/contracts: `packages/catalog/{catalog.json,catalog.schema.json,validate.ts,validate.test.ts}`; `packages/catalog/dist/catalog.ts`; `packages/contracts/api.md`.
