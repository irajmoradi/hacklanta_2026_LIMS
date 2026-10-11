# FEAT-007 final report

Branch: `feat/FEAT-007` (based on `0674e80`, after INTEG-001).
Milestones: `7ce8596` (API/catalog/migration), `f5a81cc` (web currencies).
The final verification/report commit follows those milestones; see `git log -3 --oneline`.

## Result and choices

Coins are spendable; all positive XP inserts atomically grant equal coins, including
seed/import jobs. The migration copies historical awards and spending by unique
source key exactly once. Shop prices retain their numbers as `price_coins`.
Purchases, photo tokens, Villager-grams and Mayor bribes debit coins only. XP and
levels now represent lifetime positive awards; communal/building XP is unchanged.
A fresh acquisition after clearing demo inventory gets a fresh debit source;
concurrent owned-item retries still fail atomically without another debit.

The existing seed automatically receives sensible coin balances from the ledger
trigger. Demo story reset cascades coin history with the village and recreates both
currencies. +coins debug buttons grant 100/500/2000 coins without XP; +XP grants both.

Inline SVGs show a gold angled coin, purple-to-green Solana bars, and a green faceted
octahedron. Amounts use these in the HUD, shops, showcase details, rewards, toasts,
Mayor UI, competition terms and wallet simulation review. SOL has a devnet/test tag;
unconnected HUD balance is a dash, never a fabricated zero. Existing wallet
simulation/signature approval remains; no transaction was signed or broadcast.
The React 19 wallet island renders the same SOL artwork locally to avoid crossing
its React 18 boundary.

Mayor bribes are coins too, because XP is never spendable and SOL is reserved for
competition pots. HTTP input is now `{currency?: "coins", coins, wish}`. Legacy
internal `mayor_bribes.xp` and currency `xp` storage are retained for scheduler
compatibility and explicitly documented; they no longer debit XP. Old XP/SOL-intent
bribe HTTP requests return 422.

## Verification

API commands ran from `apps/api` using Python 3.12 at
`C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe` (called `$py`
below), with `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env` loaded only
at runtime. Tests use isolated schemas in `village_test`, mocked paid providers,
and temporary synthetic evidence. No secrets or personal assets were copied.

| Command | Result / exit |
| --- | --- |
| `& $py -m pytest -q` | Initial run during implementation: 366 passed, 13 failed, 3 skipped; exit 1. Failures were obsolete XP spending/bribe/demo expectations. |
| `& $py -m pytest --lf --basetemp=.runtime/pytest-final -q` | All 13 failures corrected and rerun: 13 passed; exit 0. |
| `& $py -m pytest tests/test_feat007.py -q --basetemp=.runtime/pytest-currency-final` | 11 currency cases passed before the additional inventory-reset case; exit 0. |
| `& $py -m pytest tests/test_feat007.py tests/test_api.py::test_purchase_concurrent_cannot_overspend tests/test_api.py::test_purchase_rolls_back_inventory_on_failure -q --basetemp=.runtime/pytest-final-purchases` | 14 passed (12 currency cases plus concurrency and rollback regressions); exit 0. |
| `bun run test --timeout 30000` (web) | 100 passed; exit 0. An earlier run hit the existing geometry test's five-second limit under machine load. |
| `bun test src/api/social.test.ts` (web) | 7 passed; exit 0. |
| `bun run build` (web) | TypeScript and Vite passed; exit 0. Existing bundle-size warning remains. |
| `bunx playwright test coins.spec.ts --project=mock` (web) | 2 passed; exit 0. Actual browser screenshots; cap purchase 420 -> 395 coins with XP 420 unchanged, +500 debug -> 895 coins, SOL terms tagged devnet/test. |
| `bunx playwright test coins.spec.ts village.spec.ts equipment.spec.ts --project=mock` | 8 passed, 1 animated-label click timeout; exit 1. |
| `bunx playwright test village.spec.ts --project=mock --grep '1920' --timeout 90000` | The timed-out layout/focus case passed; exit 0. |
| `bun run validate` (catalog) | 258 entries validated, generated types refreshed; exit 0. |
| `bun test` (catalog) | 29 passed; exit 0. |
| `& $py -m ruff check <all changed Python files>` | Passed after formatting; exit 0. |
| `git diff --check` | Passed; exit 0. |

One overlapping early pytest invocation used the same temporary directory as the
full run and had a setup error. Subsequent invocations used distinct `--basetemp`
directories. The initial full API command was not rerun wholesale; every failing
case was rerun successfully, with separate final coverage for the new feature.

## Screenshots (actual Playwright captures, mock-backed browser)

Visually inspected HUD, shop, desktop competition and mobile competition images.
All are under `apps/web/tests/screenshots/FEAT-007/`:
`hud.png`, `shop.png`, `debug.png`, `competition.png`, `competition-mobile.png`.
The purchase screenshot flow deliberately blocks model files to verify fallback
avatars and shop behavior with GPU assets unavailable.

## Try it

Offline: from `apps/web`, run `bun install`, set `VITE_MOCK=1` and
`VITE_DEMO_AUTH=1`, then `bun run dev`. Choose Iraj, open Shop, buy Village Cap:
coins decrease, XP/level do not. Open Debug and use +coins. Create a competition
with 0.01 SOL entry intent to inspect its devnet/test display (no payment).

Real API: set `VILLAGE_ENV_FILE` to the existing secret file, run
`python scripts/migrate.py`, then `python scripts/seed.py` from `apps/api`, and
start the API/web using the existing run instructions. Apply migration before
running the new API/catalog code. No shared live village was migrated by this task.

## Integration / blockers

No implementation blocker. The existing wallet flow only simulates/signs locally;
SOL transfers remain outside this task and require owner approval.

`packages/contracts/api.md` is updated within the allowed scope. Proposed integrator
follow-up: fold `027_coins.sql` into `packages/contracts/schema.sql` and add `coins`
to any external stored Villager fixtures. The schema/fixtures were outside this
task's allowed paths. Keep the migration compatibility column/default when folding;
the HTTP/catalog contract uses only `price_coins`.

## Changed files

- `apps/api/app/bribes.py`
- `apps/api/app/catalog.py`
- `apps/api/app/catalog_registry.py`
- `apps/api/app/demo.py`
- `apps/api/app/domain.py`
- `apps/api/app/inbound.py`
- `apps/api/app/main.py`
- `apps/api/app/newspaper.py`
- `apps/api/app/photo_items.py`
- `apps/api/app/scheduler.py`
- `apps/api/migrations/027_coins.sql`
- `apps/api/scripts/demo_story.py`
- `apps/api/tests/test_api.py`
- `apps/api/tests/test_api008.py`
- `apps/api/tests/test_api010.py`
- `apps/api/tests/test_api010_bribes_scheduler.py`
- `apps/api/tests/test_api011.py`
- `apps/api/tests/test_arch002.py`
- `apps/api/tests/test_arch003.py`
- `apps/api/tests/test_catalog_registry.py`
- `apps/api/tests/test_demo_story.py`
- `apps/api/tests/test_farm.py`
- `apps/api/tests/test_feat003.py`
- `apps/api/tests/test_feat007.py`
- `apps/api/tests/test_web025.py`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api/auditMock.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/coins.test.ts`
- `apps/web/src/api/equipment.ts`
- `apps/web/src/api/fixtures.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/api/shopState.test.ts`
- `apps/web/src/api/shopState.ts`
- `apps/web/src/api/social.test.ts`
- `apps/web/src/api/social.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/components/AgentPanel.tsx`
- `apps/web/src/components/BribePanel.tsx`
- `apps/web/src/components/Colosseum.tsx`
- `apps/web/src/components/CompetitionsPanel.tsx`
- `apps/web/src/components/Currency.test.tsx`
- `apps/web/src/components/Currency.tsx`
- `apps/web/src/components/DemoTools.tsx`
- `apps/web/src/components/EventTerms.tsx`
- `apps/web/src/components/MayorModal.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/Onboarding.tsx`
- `apps/web/src/components/PhotoItems.tsx`
- `apps/web/src/components/ProfileOutfit.tsx`
- `apps/web/src/components/SolanaPot.tsx`
- `apps/web/src/components/VillagePanel.tsx`
- `apps/web/src/components/Villagergram.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/components/pot/mount.tsx`
- `apps/web/src/components/shared.tsx`
- `apps/web/src/components/showcaseData.test.ts`
- `apps/web/src/components/showcaseData.ts`
- `apps/web/src/scene/catalog.fallback.json`
- `apps/web/src/styles.css`
- `apps/web/tests/coins.spec.ts`
- `apps/web/tests/colosseum.spec.ts`
- `apps/web/tests/connection.spec.ts`
- `apps/web/tests/feat002.spec.ts`
- `apps/web/tests/feat003.spec.ts`
- `apps/web/tests/feat004.spec.ts`
- `apps/web/tests/feat010.spec.ts`
- `apps/web/tests/polish.spec.ts`
- `apps/web/tests/screenshots/FEAT-007/competition-mobile.png`
- `apps/web/tests/screenshots/FEAT-007/competition.png`
- `apps/web/tests/screenshots/FEAT-007/debug.png`
- `apps/web/tests/screenshots/FEAT-007/hud.png`
- `apps/web/tests/screenshots/FEAT-007/shop.png`
- `apps/web/tests/village.spec.ts`
- `apps/web/tests/web014.spec.ts`
- `apps/web/tests/web021.spec.ts`
- `apps/web/tests/web028.spec.ts`
- `packages/catalog/catalog.json`
- `packages/catalog/catalog.schema.json`
- `packages/catalog/dist/catalog.ts`
- `packages/catalog/validate.test.ts`
- `packages/contracts/api.md`
- `apps/api/FEAT-007-REPORT.md` (this report)
