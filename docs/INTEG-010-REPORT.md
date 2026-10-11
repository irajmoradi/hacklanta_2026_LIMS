# INTEG-010 integration report

Branch: `integ/INTEG-010`. Merge milestones: `02b9116` (INTEG-009) and
`c7df7df` (WEB-019); `b98ddc4` fixes pointer cleanup and final regression expectations. `ec16766` hides the new hint in clean fullscreen and adds its assertion. The final evidence/report commit follows.

## Result and integration choices

Both requested branches were merged with `--no-ff` into the task branch.
No merge or push to main was performed. All tracked changes are under
`apps/`, `packages/`, or `docs/`.

- Kept the WEB-031 dashboard, currency balances, F fullscreen, clean-view exit
  callbacks and zoom-collapse alongside current-seat WASD/arrows, Shift running,
  Space waving, C follow, mouse/touch pickup and two-loop Ferris-wheel rides.
- Preserved WEB-024 gaming/window emission, workout poses, fitness geometry and
  the goal-progress hint/aria-describedby while showing the new Reward amounts.
- Player pointer-up now propagates to scene gesture cleanup; selecting your own
  avatar no longer swallows the next building click, including in fullscreen.
- Static house batching retains material roles and separate per-house emission.
  An integration unit test verifies gaming on a batched house neither changes
  its neighbor nor the cached source and restores its original emission.
- Connected the fitness exercise paths to the actual curved-road entrance.
  Movement bounds derive from rendered street samples (including cul-de-sacs and
  expanded neighborhoods); home collision footprints rotate with the houses.
  Ground-drop routing uses the same curved graph as automatic schedules.
- Added farm-store (gather at its entrance) and fitness-corner (workout station)
  drops. Kept study seat selection, ownership, closed-building restrictions,
  idle resumption, input/modal guards and offline procedural geometry.
- Kept the walking hint above the action dock, repaired its text separators,
  and hid it in clean fullscreen with the other controls.
- Placed the local colosseum entrance on the curved eastern road. It remains a
  local gathering activity; the existing separate arena flow remains available.
- Migrated the added fitness catalog entry from price_xp to price_coins and
  regenerated catalog types. API expectations now include this level-one unlock
  and its additional seeded demo event.
- Updated the existing camera/profile tests for the Outfit customization tab,
  culled offscreen labels and larger map. The tests inspect actual camera zoom
  and target bounds instead of measuring invisible HTML labels.

## Verification

API commands load the external `C:/Users/mourn/Downloads/hacklanta/.env` via
`VILLAGE_ENV_FILE` at runtime. Tests and the preview use isolated schemas in
`village_test`; providers are stubbed/disabled, with no paid generation or
transaction signing.

| Directory | Command | Exit / result |
|---|---|---|
| apps/api | `python -m uv run pytest -q` | 0; 418 passed, 3 skipped (304.85 s) |
| apps/api | `python -m uv run ruff check tests/test_api007.py tests/test_catalog_registry.py tests/test_demo_story.py` | 0 |
| apps/web | `bun run typecheck` | 0 |
| apps/web | `bun run test` | 0; 122 passed, 160,092 assertions |
| apps/web | `bun run build` | 0; existing large-chunk advisory |
| packages/catalog | `bun run validate` | 0; 293 entries |
| packages/catalog | `bun test` | 0; 36 passed |
| apps/web | `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.integ007-map.config.ts` | 0; real API map scenario passed |
| apps/web | `VILLAGE_PERF_DIR=artifacts/integ010 node tests/perf/town.mjs after hardware` | 0; 128.66 FPS, RTX 5090 verified |
| apps/web | `VILLAGE_PERF_DIR=artifacts/integ010 node tests/perf/town.mjs after swiftshader` | 0; 6.13 FPS, shadows reduced, no browser errors; software renderer has no 55 FPS gate |
| root | `git diff --check` | 0 |

The three API skips require explicit opt-in: two paid Gazette proofs and the
separate real HTTP browser suite. The fresh integrated command `VILLAGE_BROWSER_GPU=hardware bunx playwright test
--config playwright.integ010.config.ts` exited 1: 30 passed and one failed at
`page.goto` with transient localhost `ERR_CONNECTION_FAILED`. The focused
`VILLAGE_BROWSER_GPU=hardware bunx playwright test --config
playwright.integ010.config.ts web031.spec.ts` then exited 0, all 8 passed
(30.1 s), including that case and the final walking-hint visibility assertion.
Thus every one of the 31 integrated scenarios passed across the full run and
focused rerun; the full run's nonzero exit is retained here rather than hidden.

## Performance and visual evidence

`apps/web/artifacts/integ010/after-hardware.json` and the accompanying screenshot
and gzip Chrome trace record the actual headed NVIDIA RTX 5090 at 1440x1000:
128.66 FPS, p95 13.9 ms, 707 main-pass calls, 125,718 triangles, DPR 1, shadows on,
zero browser exceptions. The 55 FPS / RTX 5090 gate exited 0. This final sample ran
without other browser tests, after the pointer and hint fixes. The screenshot
was visually inspected; the walking hint clears the action dock.

Civic-drop evidence: `apps/web/artifacts/integ010/drop-study_nook.png`,
`drop-farm_store.png`, and `drop-fitness_corner.png`.

## How to try

From `apps/web`, install with `bun install --frozen-lockfile`, set `VITE_MOCK=1`,
`VITE_DEMO_AUTH=1`, `VITE_DEMO_USER=00000000-0000-4000-8000-000000000001`,
`VITE_VILLAGE_ID=13370000-0000-4000-8000-000000000000`, then `bun run dev`.
Choose Iraj in Play as. Walk with WASD/arrows, run with Shift, wave with Space,
and toggle follow with C. Hold the avatar/nameplate and drop onto the wheel,
study nook, farm store or fitness corner. F enters clean fullscreen; a key exits
it per WEB-031. Zoom collapses the dashboard. Settings can select Gaming or
Working out. Missing assets retain procedural avatars and buildings.

For automated checks, use `VILLAGE_BROWSER_GPU=hardware bunx playwright test
--config playwright.integ010.config.ts` from `apps/web` (PowerShell: set the env
variable separately). For the scratch live API and performance gate follow
`apps/web/tests/perf/README.md`, setting `VILLAGE_PERF_DIR=artifacts/integ010`.

## Failures investigated

- Initial web checks failed because this new worktree had no installed JS
  dependencies. Installing from the existing lockfile fixed the environment.
- The first merge exposed the fitness catalog's legacy price field and its
  disconnected path graph. Both were fixed before the first merge commit.
- Initial API run: 415 passed, 3 failed, 3 skipped, exit 1. All three failures
  were stale fitness unlock/demo count expectations, updated for this merge.
- Initial WEB-019 config: seven passed, two old WEB-017 tests failed, exit 1.
  The activity picker had moved to Outfit; culled labels cannot measure zoom.
- An intermediate integrated browser run was invalidated by catalog generation
  triggering Vite hot reload and resetting the test-only API override; the
  trace explicitly records the reload. A standalone workout reproduction
  reached the fitness corner normally. The run also caught stale scene pointer
  bookkeeping after an own-avatar click; pointer-up propagation fixes it. The
  larger map needs more pan distance in the existing boundary regression. A
  clean rerun supplied 30 passing scenarios and one transient localhost
  `ERR_CONNECTION_FAILED` before page load (exit 1). The subsequent eight-test
  dashboard/fullscreen rerun verifies that scenario and the clean-view hint.

## Changed files

The complete integration inventory is `docs/INTEG-010-FILES.txt`; it includes
changes inherited from both requested merges. Integration-specific resolution
and follow-up files are:

- `apps/web/package.json` (union of test lists).
- `apps/web/src/App.tsx`, `components/Modals.tsx`, `scene/GridTown.tsx`,
  `scene/VillageScene.tsx`, `scene/TownCamera.tsx`, `scene/OptionalModel.tsx`,
  `scene/layout/navigation.ts`, `scene/playerControl.ts`,
  `scene/usePlayerController.ts`, and `styles.css`.
- `apps/web/src/scene/playerControl.test.ts`, `scene/staticModel.test.ts`,
  `apps/web/tests/web017.spec.ts`, `web019.spec.ts`, `web019Scene.ts`,
  `web031.spec.ts`, and `apps/web/playwright.integ010.config.ts`.
- `packages/catalog/catalog.json` and regenerated `dist/catalog.ts`.
- `apps/api/tests/test_api007.py`, `test_catalog_registry.py`,
  `test_demo_story.py`.
- `apps/web/artifacts/integ010/`, this report, task completion note and inventory.

Current regression screenshots are copied into
`apps/web/artifacts/integ010/regressions/` with their original relative paths.
Historical evidence directories were restored. The Ferris walkthrough WebM
was recorded by this worktree's WEB-019 browser run on the integrated map.

## Scope and contracts

Blockers: none. No additional contract changes are proposed. The requested INTEG-009 merge
brings its existing coins/SOL contract updates. Existing Vite large-chunk
advisories remain nonblocking. The scratch API was stopped via `/qa/stop`
(which drops its private schema), and the Vite process started for performance
was stopped. Historical evidence was preserved; no services are left running
by this task.
