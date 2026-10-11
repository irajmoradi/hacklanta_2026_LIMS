---
id: INTEG-001
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-001 (from main)
allowed_paths: [apps/**, packages/**, assets/**, docs/tasks/INTEG-001.md]
---
# INTEG-001 — Merge the finished feature batch into one integration branch

Merge these finished branches, in this order, into `integ/INTEG-001` with `git merge --no-ff <branch>` (one merge commit each,
message "Merge <TASK>: <one-line summary>"), resolving conflicts by KEEPING BOTH SIDES' behavior (never drop a feature):
1. `web/WEB-021`: shop lock reasons, hover nameplates, profile→shop, HUD overlap fix
2. `feat/FEAT-001`: accomplishments + emoji reactions. Rename its migration `014_reactions.sql` → `016_reactions.sql`
3. `web/WEB-020`: house style/color editor. Rename `014_house_colors.sql` → `017_house_colors.sql`
4. `feat/FEAT-003`: Destiny-style showcase + earn-only cosmetics (catalog `source`/`rarity`)
5. `feat/FEAT-004`: test seats + debug menu
Main already has: WEB-017 (idle activities; migration 015), FEAT-002 (villagergram; migration 014), WEB-018 (plaza, house styles),
and an integrator fix in apps/web/src/scene/layout/town.ts: the Mayor-event gather is limited to `phase < 120`. KEEP THAT.
Known overlaps: types.ts (SettingsInput/Me/ShopItem must carry idle_activity, has_equipped_pet, allow_voice_by_friends,
receive_villagergrams, house fields, `slot: EquipmentSlot | 'consumable'`), SettingsPanel, VillageScene/GridTown, Wardrobe,
Modals, styles.css, package.json scripts, catalog.json (union of entries; regenerate dist with `bun run validate` in
packages/catalog; update any hard-coded entry counts in tests), apps/api main.py router registration, api.md (keep all sections).
Fix stale test selectors (`villager-Dev` → `villager-Mario`; Dev was renamed to Mario).
After all merges: apply migrations to a scratch DB only through the test fixtures (do NOT touch the dev DB on 5433 directly),
and run: `python -m uv run pytest -q` (apps/api), `bun run typecheck && bun run test && bun run build` (apps/web),
`bun test` (packages/catalog), and the web e2e suites the branches added. All green before you finish. Do NOT merge to main;
the integrator fast-forwards. Final report per AGENTS.md: the list of conflicts and how each was resolved.


## Integration report

Branch: `integ/INTEG-001`. All five requested feature tips are ancestors of this branch.
Merge commits, in order:
- `161049f` WEB-021: shop reasons, hover labels, profile/shop navigation and HUD.
- `a8a6b0c` FEAT-001: accomplishments and reactions; migration renamed to 016.
- `27c237b` WEB-020: house style/color editor; migration renamed to 017.
- `46c4280` FEAT-003: showcases and earned cosmetics.
- `5f4c8e4` FEAT-004: demo seats and debug menu.
- `6f194c8` initial integration fixes and browser-fixture setup.
- `963b7e3` scene hit targets, compatible catalog fixtures, and final shared browser setup.
- `50ff34f` bounded activity-label collision spacing.
- `7bf2930` mobile-header controls and synthetic touch-hit-test layout fixes.

### Conflicts and resolutions

| Merge | Conflicting files | Resolution |
| --- | --- | --- |
| WEB-021 | `apps/web/package.json`, `src/api/types.ts`, `src/components/{Modals,Wardrobe}.tsx`, `src/scene/VillageScene.tsx`, `src/styles.css` (web paths) | Union test scripts and types; retain consent/idle/pet/consumable fields. Keep Villagergram plus focused shop cards, lock reasons and prerequisite links. Retain styled houses, activity badges and Gazette access while adding selected/hover/focus nameplates. Combine styles. |
| FEAT-001 | `apps/api/tests/test_catalog_registry.py`; web `package.json`, `src/App.tsx`, `src/api/mock.ts`, `src/components/ProfilePanel.tsx`, `src/scene/VillageScene.tsx`, `src/styles.css` | Retain catalog consumable assertions; combine mock state, reactions, accomplishment wall, goal bursts, activity labels, profile/shop links and Gazette callback. Union scripts/styles. Rename reactions migration to 016 and fix its test reference. |
| WEB-020 | API `app/{domain,main,models}.py`; web `package.json`, `playwright.config.ts`, `src/api/types.ts`, `src/components/ProfilePanel.tsx`, `src/scene/VillageScene.tsx` | Query/persist both idle and house settings; retain pet validation and consent fields. Add House tab alongside Wardrobe, reactions and shop navigation; preserve hover labels plus house color metadata. Include both browser/unit suites. Rename house migration to 017. |
| FEAT-003 | API `tests/{test_api,test_catalog_registry}.py`; web `src/App.tsx`, `src/api/{equipment,mock,types}.ts`, `src/components/{ProfileOutfit,ProfilePanel,Wardrobe}.tsx`, `src/scene/VillageScene.tsx`, `src/styles.css`, `tests/web016.spec.ts`; `packages/catalog/{catalog.json,dist/catalog.ts,validate.test.ts}`, `packages/contracts/api.md` | Union 168 catalog entries (including 18 authored houses, consumable, seven rewards), preserve source/rarity metadata and regenerate types. Keep consumables outside equipment/showcases. New showcase details retain explicit shop links; house clicks scroll to house showcase; owner House editor and reactions remain. Ordinary source=shop items remain buyable; earned items explain conditions without purchase buttons. Preserve idle routing and Mayor phase limit. Combine all contract sections. |
| FEAT-004 | API `app/domain.py`; web `src/App.tsx`, `src/api/mock.ts`, `src/styles.css`; `packages/contracts/api.md` | Keep both debug and voice/gram feed text, seat/debug state plus reactions/grams, all UI imports/styles and all contract sections. |

Additional integration choices:
- Older browser suites preselect the default seat using a shared explicit hook; FEAT-004 still tests first-visit seat onboarding.
- Update stale Dev labels/headings to Mario and old Outfit selectors to showcase item details, retaining authorization and purchase assertions.
- House showcase uses the same saved style/colors as the town/editor.
- Wider profile layout keeps all dock actions reachable by horizontal scrolling.
- Mobile demo controls occupy the existing header row; the seat picker replaces the duplicate Play as selector on small screens. Authenticated headers are unchanged.
- Scene label wrappers no longer intercept transparent areas; collision spacing searches above/below and stays inside the scene, preventing activity badges from being pushed into the header.
- Real HTTP browser suites run through `tests/test_integ_e2e.py`, using the existing `test_database` fixture and a private schema in `village_test`; no development DB migrations or catalog sync were run.
- Environment values are loaded at runtime from `VILLAGE_ENV_FILE`; no secrets were copied.

### Changed files relative to task start

- `apps/api/FEAT-004-REPORT.md`
- `apps/api/README.md`
- `apps/api/app/catalog_registry.py`
- `apps/api/app/competitions.py`
- `apps/api/app/config.py`
- `apps/api/app/demo.py`
- `apps/api/app/domain.py`
- `apps/api/app/main.py`
- `apps/api/app/models.py`
- `apps/api/app/reactions.py`
- `apps/api/app/rewards.py`
- `apps/api/app/weekly.py`
- `apps/api/app/world.py`
- `apps/api/migrations/016_reactions.sql`
- `apps/api/migrations/017_house_colors.sql`
- `apps/api/scripts/feat001_server.py`
- `apps/api/tests/test_api.py`
- `apps/api/tests/test_api008.py`
- `apps/api/tests/test_arch002.py`
- `apps/api/tests/test_arch003.py`
- `apps/api/tests/test_catalog_registry.py`
- `apps/api/tests/test_feat001.py`
- `apps/api/tests/test_feat003.py`
- `apps/api/tests/test_feat004.py`
- `apps/api/tests/test_house_colors.py`
- `apps/api/tests/test_integ_e2e.py`
- `apps/web/FEAT-003-REPORT.md`
- `apps/web/WEB-020-REPORT.md`
- `apps/web/WEB-021-REPORT.md`
- `apps/web/artifacts/web020-house-colors.png`
- `apps/web/artifacts/web020-house-desktop.png`
- `apps/web/artifacts/web020-house-mobile.png`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/playwright.web021-profile.config.ts`
- `apps/web/playwright.web021-real.config.ts`
- `apps/web/playwright.web021.config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api/auditMock.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/equipment.ts`
- `apps/web/src/api/house.test.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/api/reactionMock.ts`
- `apps/web/src/api/reactions.test.ts`
- `apps/web/src/api/reactions.ts`
- `apps/web/src/api/seat.ts`
- `apps/web/src/api/shopState.test.ts`
- `apps/web/src/api/shopState.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/components/Accomplishments.tsx`
- `apps/web/src/components/DemoTools.tsx`
- `apps/web/src/components/HouseEditor.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/ProfileOutfit.tsx`
- `apps/web/src/components/ProfilePanel.tsx`
- `apps/web/src/components/ReactionBar.tsx`
- `apps/web/src/components/ShowcasePreview.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/components/houseEditor.css`
- `apps/web/src/components/showcaseData.test.ts`
- `apps/web/src/components/showcaseData.ts`
- `apps/web/src/scene/LabelSpacing.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/cosmeticAssets.ts`
- `apps/web/src/scene/houseStyles.ts`
- `apps/web/src/styles.css`
- `apps/web/test-results/village-overview-1920.png`
- `apps/web/test-results/village-overview.png`
- `apps/web/test-results/village-profile-1920.png`
- `apps/web/test-results/village-profile.png`
- `apps/web/test-results/web017/map-mock.png`
- `apps/web/test-results/web017/settings-mock.png`
- `apps/web/tests/FEAT-001-REPORT.md`
- `apps/web/tests/artifacts/feat001/mock-desktop-wall.png`
- `apps/web/tests/artifacts/feat001/mock-laptop-wall.png`
- `apps/web/tests/artifacts/feat001/mock-mobile-wall.png`
- `apps/web/tests/artifacts/feat001/mock-profile.png`
- `apps/web/tests/artifacts/feat001/real-desktop-wall.png`
- `apps/web/tests/artifacts/feat001/real-laptop-wall.png`
- `apps/web/tests/artifacts/feat001/real-mobile-wall.png`
- `apps/web/tests/artifacts/feat001/real-profile.png`
- `apps/web/tests/demoSeat.ts`
- `apps/web/tests/equipment.spec.ts`
- `apps/web/tests/feat001.config.ts`
- `apps/web/tests/feat001.spec.ts`
- `apps/web/tests/feat003.config.ts`
- `apps/web/tests/feat003.spec.ts`
- `apps/web/tests/feat004.config.ts`
- `apps/web/tests/feat004.spec.ts`
- `apps/web/tests/house.spec.ts`
- `apps/web/tests/screenshots/FEAT-003/detail-1366.png`
- `apps/web/tests/screenshots/FEAT-003/detail-390.png`
- `apps/web/tests/screenshots/FEAT-003/fixture-fallback.png`
- `apps/web/tests/screenshots/FEAT-003/house-1366.png`
- `apps/web/tests/screenshots/FEAT-003/house-390.png`
- `apps/web/tests/screenshots/FEAT-003/reward-1366.png`
- `apps/web/tests/screenshots/FEAT-003/reward-390.png`
- `apps/web/tests/screenshots/FEAT-003/shop-rewards.png`
- `apps/web/tests/screenshots/FEAT-003/showcase-1366.png`
- `apps/web/tests/screenshots/FEAT-003/showcase-390.png`
- `apps/web/tests/screenshots/FEAT-004-debug.png`
- `apps/web/tests/screenshots/FEAT-004-mobile.png`
- `apps/web/tests/screenshots/FEAT-004-seats.png`
- `apps/web/tests/screenshots/INTEG-001/hud-profile.png`
- `apps/web/tests/screenshots/INTEG-001/hud-town.png`
- `apps/web/tests/screenshots/INTEG-001/shop-mock.png`
- `apps/web/tests/screenshots/INTEG-001/shop-real.png`
- `apps/web/tests/village.spec.ts`
- `apps/web/tests/web016-real.mjs`
- `apps/web/tests/web016.spec.ts`
- `apps/web/tests/web017.spec.ts`
- `apps/web/tests/web021-real.spec.ts`
- `apps/web/tests/web021.spec.ts`
- `docs/tasks/INTEG-001.md`
- `packages/catalog/catalog.json`
- `packages/catalog/catalog.schema.json`
- `packages/catalog/dist/catalog.ts`
- `packages/catalog/validate.test.ts`
- `packages/catalog/validate.ts`
- `packages/contracts/api.md`

### Verification

Completed: full API suite 318 passed / 3 opt-in skipped; 54 web unit tests; 23 catalog tests; 38 browser cases passed across the suites below (one additional mock-suite case is real-only and passed in the real run). Every final verification command exited 0.

API commands use `VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env` at runtime.
All DB changes are through test fixtures, restricted to `village_test` and disposable schemas.
No paid-provider live opt-in was enabled. Browser API fixtures use synthetic people/initials.

| Directory | Command | Result |
| --- | --- | --- |
| apps/api | `python -m uv run pytest -q` | Final exit 0: 318 passed, 3 opt-in skips (two provider-live cases and the separate browser harness). Initial run: exit 1, 309 passed, 9 failed, 2 skipped; all failures corrected. |
| apps/api | `python -m uv run pytest -q --lf --tb=short` | Exit 0; all 9 former failures passed. |
| apps/api | `python -m uv run pytest tests/test_integ_e2e.py -q -s --basetemp=.runtime/integ-browser` (with `INTEG_E2E=1`) | Exit 0; 1 harness test; FEAT-001 real 4 passed and WEB-021 real 1 passed. |
| apps/api | `python -m uv run ruff check tests/test_integ_e2e.py tests/test_api008.py tests/test_arch002.py tests/test_arch003.py tests/test_feat001.py` | Exit 0. |
| apps/web | `bun run typecheck`, `bun run test`, `bun run build` | Exit 0 each on final code; 54 unit tests, 832 assertions. Build reports the existing large-chunk warning. |
| packages/catalog | `bun run validate`, `bun test` | Exit 0 each; 168 entries regenerated, 23 tests passed. |
| apps/web | `bunx playwright test --config playwright.web021.config.ts` | Exit 0; all 14 shop/village/equipment tests passed. |
| apps/web | `bunx playwright test --config playwright.web021-profile.config.ts` | Exit 0; 2 desktop/mobile profile and custom-item regressions. |
| apps/web | `bunx playwright test --config tests/feat001.config.ts` | Exit 0; 3 passed, 1 real-only case skipped (passed in real fixture run). |
| apps/web | `bunx playwright test house.spec.ts --project=mock --output=test-results/integ-house` | Exit 0; 2 house editor/offline tests passed. |
| apps/web | `bunx playwright test --config tests/feat003.config.ts` | Exit 0; 3 desktop/mobile/offline showcase tests passed. |
| apps/web | `bunx playwright test --config tests/feat004.config.ts` | Exit 0; 4 seat/debug tests passed, including the new mobile header regression. |
| apps/web | `bunx playwright test web017.spec.ts --config playwright.web017.config.ts --project=mock --output=test-results/integ-web017` | Exit 0; 5 idle activity, pet gating, camera and profile focus regressions. |
| repository | `git diff --check` | Exit 0. |

Earlier browser runs exposed first-visit seat gates in old suites, obsolete profile selectors,
a debug-capability readiness race, transparent label wrappers intercepting house hover, and mobile demo controls spilling outside the header grid. Automatic label spacing was bounded; the synthetic touch target was moved out from behind the mobile self-card.
Those issues and test setup were corrected; interrupted stale runs are not counted as passes.
An early profile run also found the JSON import compatibility issue. An initial house command
used invalid Playwright argument ordering; the corrected command above ran both tests.

### Evidence and teammate walkthrough

Screenshots from the integrated code (synthetic fixtures):
- `apps/web/tests/screenshots/FEAT-003/showcase-1366.png` and `showcase-390.png`
- `apps/web/tests/screenshots/FEAT-003/fixture-fallback.png`
- `apps/web/artifacts/web020-house-desktop.png` and `web020-house-mobile.png`
- `apps/web/tests/artifacts/feat001/real-desktop-wall.png` and `real-mobile-wall.png`
- `apps/web/tests/screenshots/FEAT-004-debug.png`, `FEAT-004-seats.png`, and `FEAT-004-mobile.png`
- `apps/web/tests/screenshots/INTEG-001/{hud-profile,hud-town,shop-mock,shop-real}.png` preserves final HUD and shop captures.

From `apps/web` in PowerShell, run `$env:VITE_MOCK='1'; bun run dev --port 5198` and open
`http://localhost:5198`. Select a seat. Open My profile to use the showcase, item details,
shop link, Wardrobe, idle activity and House editor. Complete a goal and react in
Accomplishments. Open Shop to inspect prerequisites and earned-only rewards. Switch seats,
open Debug, add XP or toggle festival weather. No GPU or provider keys are needed.

For real browser validation, set `$env:INTEG_E2E='1'` and use the opt-in pytest harness above; it starts port 8021,
runs both real suites, shuts down the server and lets the fixture drop its private schema.
Do not run migrations or catalog sync directly against the development database for this task.

Blockers: none. Proposed contract changes: none outside
the combined `packages/contracts/api.md` sections already committed. No push or merge to main.
