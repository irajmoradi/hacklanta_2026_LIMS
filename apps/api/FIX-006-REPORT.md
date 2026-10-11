# FIX-006 delivery

Branch: `fix/FIX-006`. API milestone: `b1765a9`. Web fixes, browser tests, and screenshots: `7a253f4`. Baseline: `aa9610215f068baf64feecc61f2fd5584a226954`. This report and timing data are delivered in the final documentation commit.

## Changes

- QA-010-00: every pooled psycopg connection now has `prepare_threshold=None`. The regression warms the real authenticated village route beyond the default preparation threshold, alters both `users` and `village_members`, and verifies village and identity requests still return 200 on the same PostgreSQL backend PID.
- QA-010-01: village assembly uses a fixed set of batched reads instead of a per-member query loop. Single profiles use the same assembler. World and villager assembly share one request-local catalog snapshot. Runtime catalog validation runs once on the final merged definitions. Five-seat village requests dropped from 83 to 28 SQL executions; the villager assembler uses seven reads for either one or five people. No cross-request response cache or changes to world/disaster synchronization were introduced.
- Accepted check-ins, goals, houses, idle choices, settings, outfit changes, shop purchases, and wardrobe colors acknowledge success without awaiting village refresh. Check-ins reconcile awarded XP immediately; shop/equipment controls adopt accepted response data. Failed background refreshes report that the write was saved. Refresh generations prevent an older response overwriting a newer refresh, and self-profile reads are shared when viewing one's own profile.
- QA-010-02: the full conflict message is available as accessible text and a tooltip on a compact `Shared seat` chip inside the existing seat button. The mobile test measures the chip against the header bounds and checks horizontal overflow.
- QA-010-03: explicit foreground/background pairs for light management panels preserve readable filled buttons, including hover. The browser test calculates contrast for enabled management controls and requires at least 4.5:1.
- QA-010-04: photo tokens retain the full shop response and use `itemState` for affordability and prerequisite reasons. Accepted purchases immediately decrement the displayed balance and increment tokens; other shop purchases invalidate the token balance. Unit coverage includes exact-price affordability and prerequisites.
- Test setup uncovered a replay issue: disaster columns are already folded into the contract baseline. Migration `026_disasters.sql` now uses `ADD COLUMN IF NOT EXISTS`, allowing fresh isolated test schemas to initialize. No contract file was edited.

## Measurement method

`tests/test_fix006.py::test_core_timings` sends authenticated HTTP requests through FastAPI's ASGI transport against an isolated PostgreSQL test schema seeded with the five demo villagers. Each operation has one cold request and 20 sequential warm requests; p95 is the nineteenth sorted warm sample. Every measured request must return 200. SQL counts instrument `AsyncConnection.execute`.

The initial baseline measured village GET at **635.16 ms p95 / 83 queries**, house save **7.77 ms / 7 queries**, idle save **5.47 ms / 6 queries**, and text check-in **15.43 ms / 21 queries**. Thus write latency alone did not explain the busy-form delays in this environment. Measurements do not include browser rendering, a reverse proxy, production data volume, or network transit. QA-010's shared live-stack measurements are separate observations, not a controlled before/after comparison.

Final measurements, with this task's browser suite finished:

| Operation | Before p95 | After p95 | SQL before / after | Target |
| --- | ---: | ---: | ---: | ---: |
| Village GET | 635.16 ms | **114.48 ms** | 83 / 28 | <250 ms |
| House PATCH | 7.77 ms | **8.82 ms** | 7 / 7 | <400 ms |
| Idle PATCH | 5.47 ms | **10.95 ms** | 6 / 6 | <400 ms |
| Text check-in POST | 15.43 ms | **18.71 ms** | 21 / 21 | <400 ms |

Village p95 fell by approximately 82%. Write queries were preserved; the small increase in measured write timings is reported rather than described as an improvement. The UI improvement is independently verified by withholding refresh responses after acceptance. The final cold village read was 143.46 ms. [Timing data, including every final sample](fix006-timings.json). During simultaneous API/browser runs, intermediate village p95 ranged from 161 to 273 ms before the final duplicate-validation removal; these are not used as an isolated benchmark.

## Validation and known baseline failures

- Full API suite: `python -m pytest -q` — exit **1**, **386 passed, 3 skipped, 5 failed**. Four failures are `tests/test_api009.py::test_penalties_recover[...]` expecting fog despite the current disaster system; the fifth is `test_shipped_registry_and_legacy_parity` expecting 258 entries when the catalog has 259. All five failures were reproduced using the original baseline API modules, retaining only the migration replay repair needed to initialize tests. They were not hidden or changed to make this task green.
- Focused API/catalog suite: `python -m pytest tests/test_fix006.py tests/test_catalog_registry.py -k 'not shipped_registry_and_legacy_parity' -q -s` — exit **0**, **18 passed, 1 deselected**.
- API lint: `python -m ruff check app/db.py app/domain.py app/main.py app/world.py tests/test_fix006.py` — exit **0**.
- Web unit suite: `bun run test` — exit **0**, **99 passed**.
- Web typecheck: `bun run typecheck` — exit **0**.
- Production build: `bun run build` — exit **0**. Vite retains its existing warning about chunks larger than 500 kB.
- Browser regressions: `bunx playwright test --config playwright.fix006.config.ts` — exit **0**, **8 passed**. Covers every QA-010 finding and accepted check-in, goal, house, idle, and shop purchase behavior while refresh is blocked.
- Final API regression/benchmark: `python -m pytest tests/test_fix006.py -q -s` — exit **0**, **3 passed**, final timings above.
- Final whitespace checks: `git diff --check` and `git diff --cached --check` — exit **0**.

Python commands run from `apps/api` using the existing `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`. `VILLAGE_ENV_FILE` points to the supplied root environment file at runtime. Browser tests use synthetic fixtures behind intercepted API routes: no live demo writes, paid generation, messages, uploads, or transactions. Installed web dependencies are reused through ignored local directory junctions. Initial browser attempts exposed harness routing/seat/selector mistakes; those runs failed and were corrected, rather than counted as passes.

## Screenshots and teammate verification

Evidence uses preset initials and generated fixture bodies only:

- [Mobile seat conflict](../web/artifacts/fix006/mobile-seat.png)
- [Enabled arena management controls](../web/artifacts/fix006/arena-contrast.png)
- [Unaffordable photo token](../web/artifacts/fix006/photo-token.png)

From `apps/web`, run `bunx playwright test --config playwright.fix006.config.ts`. This starts this worktree's Vite server on port 5186, intercepts the API with fixture responses, and regenerates the screenshots. The save tests deliberately block village GET after a successful write and assert the form is usable within 1.5 seconds. Use `bun run dev` for manual verification: choose a seat, save a house/idle choice/check-in, inspect a duplicate-seat notice at 390px, inspect competition management, and open Make it real with less than 25 XP.

From `apps/api`, set `VILLAGE_ENV_FILE` to the shared environment file and run `python -m pytest tests/test_fix006.py -q -s` to repeat the benchmark and migration regression. Existing server pools must be recreated by the normal API restart/deployment to pick up the connection option; this task does not restart the shared stack.

## Files and limits

API files: `app/db.py`, `app/domain.py`, `app/main.py`, `app/world.py`, `app/catalog.py`, `migrations/026_disasters.sql`, `tests/test_fix006.py`, `fix006-timings.json`, and this report.

Web files: `src/App.tsx`, `src/styles.css`, `src/api/shopState.test.ts`, `src/components/{DemoTools,HouseEditor,IdleActivityPicker,Modals,PhotoItems,ProfileOutfit,SettingsPanel,Wardrobe}.tsx`, `src/components/colosseum.css`, `playwright.fix006.config.ts`, `tests/fix006.spec.ts`, and the three evidence PNGs.

Remaining integration limitation: the full API suite has the five reproduced baseline failures above. No blocker remains for the scoped fixes. Proposed contract changes: **none**. All edits stay within `apps/api/**` and `apps/web/**`; no push, merge, root edits, secret copies, or real-person media were made.
