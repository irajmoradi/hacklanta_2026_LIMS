# FEAT-012 — Cozy disasters pack

Completed on `feat/FEAT-012`. API/catalog/contract milestone: `6bb5eca`.
The web milestone contains this report; its hash is recorded in the final handoff.

Failed challenges and random events now queue one recoverable disaster at a time.
The Mayor publishes recovery instructions to the feed and Gazette. Shared check-ins
repair the village; pets remain owned throughout. The HUD shows both check-in and
distinct-neighbor progress, and completion plays the existing celebration.

Implementation choices:

- Weights: scorch 3, outbreak 2, blackout 3, blight 2. The previous kind is excluded.
- Scorch targets the pet shelter, with a grey closure, smoking crater, blocked
  building click and server-side pet-purchase restriction.
- Outbreak empties the shelter yard and displays a vet van. At 48 hours equipped
  pets become `away`, hidden without deleting inventory or equipment flags.
- Revival potion costs 30 XP, immediately restores the buyer's away pets and is
  free on retries/already-home requests. Shared repair restores everyone for free.
- Repairs need twice as many check-ins as participants, from up to three distinct
  members. The initial deadline is 48 hours; a fresh rolling 48-hour window can
  still repair after the deadline, preventing permanent loss.
- Blackout overrides weather/time with rain/night and blocks festival night.
- Blight blocks gardening choices and movement, browns plots, and suspends the
  new daily +5 XP gardening status-check-in bonus for unlocked gardens.
- Reconciliation happens transactionally on world/shop reads and check-in writes.
  Effects recover after restart; no continuously running timer or GPU is required.
- Smoke, bugs and rain use one instanced draw call each; the van/crater are simple
  geometry. No generated assets, real photos, provider calls or messaging were used.

Validation (final successful commands; all exit 0):

| Directory | Command | Result |
| --- | --- | --- |
| `apps/api` | `python -m uv run pytest tests/test_feat012.py tests/test_api007.py tests/test_api010.py tests/test_web025.py -q` | 44 passed |
| `apps/api` | `python -m uv run pytest tests/test_feat012.py::test_failure_queue_and_debug_gate -q` | 1 passed after retry-compatibility adjustment |
| `apps/api` | `python -m uv run ruff check app/disasters.py app/world.py app/domain.py app/main.py app/demo.py app/newspaper.py app/events_table.py tests/test_feat012.py tests/test_api007.py` | Passed |
| `apps/api` | `python -m uv run ruff format --check app/disasters.py app/world.py app/domain.py app/main.py app/demo.py app/newspaper.py app/events_table.py tests/test_feat012.py tests/test_api007.py` | 9 files formatted |
| `apps/web` | `bun run test` | 98 passed |
| `apps/web` | `bun run build` | TypeScript and Vite passed; bundle-size advisory only |
| `apps/web` | `bunx playwright test --config playwright.feat012.config.ts` | Passed; all four disasters, debug repairs and celebrations; no page errors |
| `packages/catalog` | `bun run validate` | 259 entries validated; generated TypeScript updated |
| `packages/catalog` | `bun test` | 29 passed |

API tests load `VILLAGE_ENV_FILE` at runtime and use the existing isolated
`village_test` schema harness. Coverage includes weighted exclusion, failure queue,
effect application/clearing, distinct participants, check-in replay, late repair,
away/revival concurrency, insufficient funds, free repair, garden bonus, and debug
gating. No shared application village was reset or migrated.

Real Chromium screenshots (1440×1000), visually inspected:

- [Meteor scorch](artifacts/feat012/scorch.png)
- [Shelter outbreak](artifacts/feat012/outbreak.png)
- [Storm blackout](artifacts/feat012/blackout.png)
- [Garden blight](artifacts/feat012/blight.png)

The browser uses the fixture API adapter with all `/models/**` requests blocked,
deliberately verifying the procedural fallback scene. Database behavior is verified
separately by pytest; these are not screenshots of a running production API.

To try it, retain the shared environment-file reference and run the existing API
setup from `apps/api`: `python -m uv run python scripts/migrate.py`, then
`python -m uv run python scripts/sync_catalog.py`, then
`python -m uv run uvicorn app.main:app --port 8010`.
Run `bun run dev` from `apps/web`. With the existing demo-auth/debug flags enabled,
choose a seeded seat, open the bug menu, select **Trigger disaster ▸**, and choose
a kind. **Repair now** rehearses recovery. For normal recovery, submit six check-ins
across three seats; the HUD updates and the village celebrates. Repeating the same
kind immediately returns a conflict; choose another kind. For a self-contained
offline walkthrough, run the Playwright command above.

Blockers: none. The task explicitly allowed `packages/contracts/api.md`; the
additive state fields and existing/new debug endpoint behavior are documented there.
No further contract changes are proposed. Migration `026_disasters.sql` follows the
highest existing migration, 025. No changes were made outside allowed paths.

Files changed:

- `apps/api/app/demo.py`
- `apps/api/app/disasters.py`
- `apps/api/app/domain.py`
- `apps/api/app/events_table.py`
- `apps/api/app/main.py`
- `apps/api/app/newspaper.py`
- `apps/api/app/world.py`
- `apps/api/migrations/026_disasters.sql`
- `apps/api/tests/test_api007.py`
- `apps/api/tests/test_feat012.py`
- `apps/web/FEAT-012-REPORT.md`
- `apps/web/artifacts/feat012/blackout.png`
- `apps/web/artifacts/feat012/blight.png`
- `apps/web/artifacts/feat012/outbreak.png`
- `apps/web/artifacts/feat012/scorch.png`
- `apps/web/package.json`
- `apps/web/playwright.feat012.config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api/disasters.test.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/components/DemoTools.tsx`
- `apps/web/src/components/DisasterBanner.tsx`
- `apps/web/src/components/EventTerms.tsx`
- `apps/web/src/components/IdleActivityPicker.tsx`
- `apps/web/src/components/MayorModal.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/scene/DisasterEffects.tsx`
- `apps/web/src/scene/GridTown.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/layout/town.ts`
- `apps/web/src/scene/worldTypes.ts`
- `apps/web/src/styles.css`
- `apps/web/tests/feat012.spec.ts`
- `packages/catalog/catalog.json`
- `packages/catalog/dist/catalog.ts`
- `packages/contracts/api.md`
