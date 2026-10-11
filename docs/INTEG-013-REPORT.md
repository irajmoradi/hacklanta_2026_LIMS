# INTEG-013 integration report

Branch: `integ/INTEG-013`. WEB-034 merge: `7910548`. COPY-001 merge: `426a3ad`.
Follow-up integration and regression fixes: `27c15e9`. Visual evidence: `d961781`. Final contrast and face-check fixes: `cbf17f6`.
Both source branches are ancestors of this integration branch. Nothing was merged or pushed to main.

## Integration decisions

- Kept the current alert badge, five dashboard widgets, duotone icons, profile overview grid/settings gear, weekly auditor exclusion, colosseum scoring tooltips, auditor booth, and currency layout.
- Replaced the old notification component with WEB-034's queue, measured viewport, accessible actions, persistent errors, and celebration cards. The placement observer also tracks the newer alerts dropdown. Toast kind icons use the current Village icon set; XP and coin labels retain the currency artwork. Repair keeps the existing prayer chime and scene effects.
- Applied COPY-001's wording to current components instead of bringing back old layouts. Extended the wording pass to widgets, weekly review, colosseum, auditor booth, reconnection, and celebration messages.
- Kept fixture goal details empty, as required by FIX-013. Kept the legacy boilerplate filter and its original test input: that historical string is deliberately not new UI copy.
- Added toast-store and Gazette tests to the regular web test command. Added a repeatable mock integration browser configuration and a copy smoke test.
- Corrected the XP level caption color in the peach corner popup; all three widget viewport contrast audits pass.
- Updated historical assertions and navigation to the current controls. Synthetic model responses remain unchanged where they test parsing rather than authored product copy.
- API tests read the external env file at runtime and use `village_test` with isolated schemas. Browser tests use mock fixtures. No live demo mutations, paid generation, real messages, or transactions were performed.

COPY-001's before/after table is in [DEMO_TESTING.md](DEMO_TESTING.md#copy-001-copy-review). That section is the original branch report; the validation below supersedes its integration blockers.

## Validation

Commands run from `apps/web`, unless otherwise stated:

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Installed web dependencies and local pot dependencies; no lockfile changes. |
| `bun run typecheck` | 0 | TypeScript passes. Initial attempt before install exited 1 (`tsc` missing). |
| `bun run test` | 0 | 166 tests across 39 files. |
| `bun test src --timeout 30000` | 0 | 192 tests across 45 files. |
| `bun run build` | 0 | Production build succeeds; existing large-chunk warning remains. |
| `bunx playwright test --config tests/web034.config.ts` | 0 | Seven tests: three viewport sizes, open alerts dropdowns, notification kinds/actions, queue/timers, actual check-in/purchase/settings, mock repair. |
| `$env:VILLAGE_BROWSER_GPU='hardware'; bunx playwright test --config playwright.integ013.config.ts` | 1 | 60 passed, 1 intentionally skipped live-API case, 8 failed. Failures identified a corner caption contrast issue and obsolete face-check/status selectors; corrected in the follow-up below. |
| `$env:VILLAGE_BROWSER_GPU='hardware'; bunx playwright test --config playwright.integ013.config.ts village.spec.ts web015.spec.ts web035.spec.ts` | 0 | All 14 tests pass after fixes, including every previously failing browser case. |
| `bun install --frozen-lockfile` (`apps/imessage`) | 0 | No lockfile changes. |
| `bun test` (`apps/imessage`) | 0 | 20 tests. |
| `bun run typecheck` (`apps/imessage`) | 0 | TypeScript passes. |
| API `python -m pytest -q` | 1 | Initial broad run: 426 passed, 3 skipped, 6 failed, 5 errors. Two failures were stale fallback-copy assertions; five errors were a secondary test fixture replaying folded migrations. Four repair-count failures passed unchanged in isolation. |
| API `python -m pytest -q --tb=short` | 1 | Final full run: 433 passed, 3 skipped, 4 repair-related failures; no setup errors. See limitations below. |
| API `python -m pytest -q tests/test_feat012.py tests/test_v2.py tests/test_catalog_registry.py tests/test_arch003.py --tb=short` | 0 | All 57 tests pass after the assertion and fixture corrections. |

API commands use `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe` with `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env`. Providers are mocked by the test fixtures.

Across the broad run and final affected-suite rerun, all 68 mock integration cases passed; the live-API case was intentionally skipped. This is coverage across runs, not a claim that the earlier full run exited zero. The separate WEB-034 suite passed all seven tests. The production build was rerun after the contrast fix and exited zero.

The initial broad browser runs exposed stale selectors for emoji icons, removed mobile menus, profile settings, competition controls, and the current mannequin catalog. Tests now follow current controls and assert rotation without assuming an obsolete catalog item. A competition selector also matched the new toast dismiss button and is now anchored. Shop transition timing has varied with renderer/load; the 400 ms assertion remains unchanged.

## Try it

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 15313
```

Choose a demo seat, submit a check-in, buy an item, save settings, and open a profile. Notifications share one queue and clear the open panels. Open Weekly review and Compete to check the retained layouts and revised copy.

Automated toast checks: `bunx playwright test --config tests/web034.config.ts`.
Integration checks: `bunx playwright test --config playwright.integ013.config.ts`.
On Windows with a working GPU, set `VILLAGE_BROWSER_GPU=hardware` for the existing hardware-rendering test option.

No contract changes are proposed.


## API limitations

The full API suite is not green. The final broad run failed `test_api007.py::test_failure_fog_and_linked_repair` and `test_api009.py::test_penalties_recover` for `blight-game_night`, `blight-village_project`, and `blight-weekend_build`. They assert that check-ins clear disaster/penalty state. The earlier broad run failed four different repair-count cases, all of which passed unchanged in the focused 57-test run. Repair algorithms were not changed by this integration; the only production change in `disasters.py` is wording. A focused rerun of `test_api007.py::test_failure_fog_and_linked_repair` plus `test_api009.py::test_penalties_recover` exited 1 with 14 passed and 3 failures, now in different parameter cases (`scorch-buddy_chat`, `blackout-weekend_build`, `blight-buddy_chat`). An in-memory comparison using `git show 045fc08:apps/api/app/disasters.py`, `exec` into `app.disasters`, and `pytest.main` for those same 17 tests exited 0 (one pytest import-rewrite warning). This is not a full baseline run and does not establish a cause. These variable repair failures need a separate repair-state/timing investigation. No contract change is indicated by the evidence so far.


## Screenshots

Visually reviewed captures:

- `apps/web/tests/artifacts/integ013/hud-1280-profile.png`: current HUD and profile grid, revised copy and icons.
- `apps/web/tests/artifacts/integ013/corner-1280.png`: corrected XP caption contrast in the expanded widget.
- `apps/web/tests/artifacts/integ013/profile-copy.png`: copy smoke flow and profile.
- `apps/web/tests/artifacts/integ013/weekly-mobile.png`: auditor exclusion and goal/evidence cards.
- `apps/web/tests/artifacts/web034/repair-390.png`: mobile repair moment above the profile.
- `apps/web/tests/artifacts/web034/dialog-1600.png`: error notification above the current check-in dialog.
- `apps/web/tests/artifacts/web034/alerts-390.png`: notification below an open alerts dropdown.
- `apps/web/tests/artifacts/web034/`: regenerated desktop/mobile panels and all notification kinds.

## Changed files

Source, configuration, tests, and existing documentation changed from task-start commit `045fc08`:

- `apps/api/app/disasters.py`
- `apps/api/app/inbound.py`
- `apps/api/app/mayor.py`
- `apps/api/app/newspaper.py`
- `apps/api/tests/test_api006.py`
- `apps/api/tests/test_catalog_registry.py`
- `apps/api/tests/test_feat011.py`
- `apps/api/tests/test_v2.py`
- `apps/imessage/src/agent.ts`
- `apps/web/package.json`
- `apps/web/playwright.integ013.config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/Auth.tsx`
- `apps/web/src/api/fixtures.ts`
- `apps/web/src/api/gazette.test.ts`
- `apps/web/src/api/gazette.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/components/Accomplishments.tsx`
- `apps/web/src/components/AgentPanel.tsx`
- `apps/web/src/components/Celebration.tsx`
- `apps/web/src/components/Colosseum.tsx`
- `apps/web/src/components/Dashboard.css`
- `apps/web/src/components/Dashboard.tsx`
- `apps/web/src/components/FaceCheck.tsx`
- `apps/web/src/components/Gazette.tsx`
- `apps/web/src/components/HouseEditor.tsx`
- `apps/web/src/components/MakeItReal.tsx`
- `apps/web/src/components/MayorModal.tsx`
- `apps/web/src/components/Messages.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/Onboarding.tsx`
- `apps/web/src/components/ProfileOutfit.tsx`
- `apps/web/src/components/ProfilePanel.tsx`
- `apps/web/src/components/ProfileSections.tsx`
- `apps/web/src/components/Reconnecting.tsx`
- `apps/web/src/components/SettingsPanel.tsx`
- `apps/web/src/components/Toast.tsx`
- `apps/web/src/components/Tour.tsx`
- `apps/web/src/components/VillageIcon.test.tsx`
- `apps/web/src/components/VillageIcon.tsx`
- `apps/web/src/components/VillagePanel.tsx`
- `apps/web/src/components/Villagergram.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/components/WeekPanel.tsx`
- `apps/web/src/components/colosseumData.ts`
- `apps/web/src/components/nativePopover.d.ts`
- `apps/web/src/components/shared.tsx`
- `apps/web/src/components/toastStore.test.ts`
- `apps/web/src/components/toastStore.ts`
- `apps/web/src/styles.css`
- `apps/web/tests/WEB-034-REPORT.md`
- `apps/web/tests/artifacts/web034/.gitignore`
- `apps/web/tests/audits.spec.ts`
- `apps/web/tests/colosseum.spec.ts`
- `apps/web/tests/connection.spec.ts`
- `apps/web/tests/feat012.spec.ts`
- `apps/web/tests/feat013.spec.ts`
- `apps/web/tests/features.spec.ts`
- `apps/web/tests/fix006.spec.ts`
- `apps/web/tests/fix013.spec.ts`
- `apps/web/tests/integ009.spec.ts`
- `apps/web/tests/integ013.spec.ts`
- `apps/web/tests/polish.spec.ts`
- `apps/web/tests/vfx001.spec.ts`
- `apps/web/tests/village.spec.ts`
- `apps/web/tests/web012.spec.ts`
- `apps/web/tests/web015.spec.ts`
- `apps/web/tests/web021.spec.ts`
- `apps/web/tests/web025.spec.ts`
- `apps/web/tests/web028.spec.ts`
- `apps/web/tests/web031.spec.ts`
- `apps/web/tests/web034.config.ts`
- `apps/web/tests/web034.spec.ts`
- `docs/DEMO_TESTING.md`

Also added this report and the integration screenshots listed above; updated the WEB-034 PNG captures. No files outside `apps/**` and `docs/**` changed.
