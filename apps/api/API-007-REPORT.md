# API-007 final report

Branch: `api/API-007` (assigned current branch).
Implementation and contract proposal: `5048049`.
This report and README updates are a subsequent documentation commit. No push or merge.

## Delivered

- Collective lifetime positive XP, including event awards exactly once; six level
  thresholds and permanent garden/lights/shelter/ferris-wheel/bridge unlocks.
- Transactional once-only `building_unlocked` activities and Mayor agent-log announcements.
  Building prerequisites supplement existing item prerequisites; `pet_dog_b` needs shelter.
- Village `world` projection, UTC day/night, validated scheduler weather decisions with
  a persisted three-hour limit and logged reasons. Failed penalties create unique repair
  events; pending repairs force fog and completed repairs remove visible craters.
- Owner/consent-gated multipart group-photo upload, deduplicated segment jobs, scoped
  member polling and asset access, sanitized worker results, concurrent self-claims with
  database uniqueness, head job creation and existing bridge head-to-body chaining.
- Additive idempotent migration 006, no BOM. Level-4 offline demo story, old-story upgrade,
  strict replay after upgrade, village-scoped reset and linked demo crater repair.
- Web/worker contract proposal and 18 new tests (including parametrized threshold cases).

## Files changed

Under `apps/api/`:

- `app/world.py`, `app/group_photo.py` (new).
- `app/domain.py`, `app/main.py`, `app/models.py`, `app/scheduler.py`.
- `migrations/006_world_group_photo.sql` (new).
- `scripts/demo_story.py`, `scripts/seed.py`, `scripts/smoke_api007_http.py` (new smoke).
- `tests/test_api007.py` (new), `tests/test_api.py`, `tests/test_demo_story.py`.
- `README.md`, `demo/README.md`, `API-007-REPORT.md`.

Also `packages/contracts/proposals/API-007.md`, explicitly allowed by the task.
No root files, shared schema/api.md, environment files, dependency locks, other apps,
worker code, real-person images or secrets were committed.

## Verification

Commands ran from repository root. Database commands used runtime-only
`$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'`.

| Command | Exit | Result |
| --- | --- | --- |
| `python -m uv run --directory apps/api pytest -q` | 0 | **133 passed in 86.50s**, including 115 existing tests |
| `python -m uv run --directory apps/api ruff check app scripts tests` | 0 | All checks passed |
| `python -m uv run --directory apps/api ruff format --check app scripts tests` | 0 | 42 files formatted |
| `git diff --check` | 0 | Clean |
| `git diff --cached --check` | 0 | Clean before implementation commit |
| `python -m uv run --directory apps/api python scripts/smoke_api007_http.py` | 0 | HTTP health/OpenAPI, DB up, 47 paths, temporary port **63544** |

The suite uses its existing isolated random schema in `village_test` and synthetic PNGs
under `apps/api/.runtime`. Migration reapplication is covered by existing tests. Providers
are mocked; no paid LLM, voice, GPU, messaging or transaction calls were made. The new
tests cover every threshold boundary, unlock/announcement idempotency under concurrent
reads, nonmember access, building purchase rejection/success, event XP and purchase
accounting, concurrent weather requests, enum validation, mocked scheduler weather,
overdue-event failure/repair, owner-only repair, upload consent/roles/deduplication,
offline worker state, private asset access, concurrent crop contention, claim replay,
one-crop-per-member rejection, head input, invalid/old worker output, and demo L4/repair.
Existing demo tests still verify full-row replay identity, scoped reset and avatar
preservation. The real HTTP smoke is read-only health/OpenAPI; functional route tests
use ASGI HTTP clients against the isolated database.

Initial full suite found two stale fixture assertions (shop count and demo announcement
count); both were updated. Initial Ruff line-length findings were fixed. Final checks
are clean. The shared API on **8010**, shared development data, worker process and asset
storage were untouched. No live development migration or demo reset was run.

Screenshot: not applicable, API-only task.

## Teammate trial

1. Point `VILLAGE_ENV_FILE` to the existing external environment and select a development
   database. Apply schema/additions with
   `python -m uv run --directory apps/api python scripts/migrate.py`.
2. Run `python -m uv run --directory apps/api python scripts/demo_story.py --reset`
   to rebuild only the fixed demo village; omit `--reset` to upgrade an existing story
   while retaining progress. The fresh story has 2800 collective XP, level 4, shelter
   and festival lights, with ferris wheel next at 5000 XP.
3. Set `DEMO_AUTH=1`, `MAYOR_SCHEDULER=0`,
   `UVICORN_LOOP=app.runtime:selector_loop`. Start an available temporary port, e.g.
   `python -m uv run --directory apps/api uvicorn app.main:app --host 127.0.0.1 --port 8017`.
   Use the existing demo-server factory instead if demo evidence images are needed.
4. Open `/docs`; header `X-Demo-User: 13370000-0000-4000-8000-000000000001`.
   Read `/api/villages/13370000-0000-4000-8000-000000000000`, buy `pet_dog_b`, then
   complete its linked repair event and verify fog/crater removal. Use the proposal
   for exact multipart upload, polling and claim shapes.
5. Run `python -m uv run --directory apps/api pytest -q tests/test_api007.py` for the
   group-photo flow with mocked worker crops. Deploy the bridge change described below
   before trying real group photos; no real group processing is claimed by this report.

## Blockers, contract changes and choices

**Real group-photo integration is blocked on a GPU bridge change outside allowed paths.**
The current `do_segment` ignores group flags, updates the owner's avatar, starts a head
job automatically and drops the crop list. The proposal specifies the required branch:
job-isolated crop output, no owner manifest/face mutation, no automatic head/body work,
and `result.crops[{crop_id,face_asset_key}]` after files are written. Deploy that bridge
change before enabling real group uploads. Worker segmentation output isolation may
also need adaptation. Polling old-bridge results returns 409 instead of claiming success.

No other implementation blocker. Migration/deployment and web rendering remain integration
steps. Proposed shared-contract additions, all routes, data shapes and bridge input/output
are in `packages/contracts/proposals/API-007.md`; shared contracts were not edited.

Choices: XP is village-scoped positive ledger history for current members; event bonuses
are not counted twice. Buildings remain unlocked if membership changes. Progression is
materialized on world reads and relevant mutations/ticks. The existing backyard dog is
unchanged; the new shelter dog demonstrates the building gate. Scheduler weather cooldown
does not prevent penalty/repair transitions. Repair challenges have no deadline or XP;
the owner attests completion through the existing route. Failed events retain their history.
One crop per member is scoped per group-photo job; later photos can re-onboard. Claims
serialize and refuse overlapping active personal pipelines. The existing bridge chains
head to body, including head-failure fallback. Group uploads attest consent for everyone
pictured; claims are explicit self-onboarding actions, without identity inference.

Filesystem and database commits cannot be atomic: crashes may leave orphan upload files
or a newly written canonical face without a committed claim. Local exception handling
cleans/restores files where possible. Existing single-photo uploads have the same storage
boundary; durable object-store staging/reconciliation remains future hardening.
