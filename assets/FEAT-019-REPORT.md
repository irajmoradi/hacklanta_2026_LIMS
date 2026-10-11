# FEAT-019 — homes, Community Hall, floors and interior polish

Branch: `feat/FEAT-019`.

Implementation milestones:
- `84c01ed`: owner-only API, Hall permissions, persistent floors/creators, migration and contract.
- `975b237`: Hall model, shared editor, floor controls and visual refinement.
- `8c50fc0`: three-floor, photo-object and public-latency coverage.
- `aa65ff7`: refined guides, peer labels, furniture details and probe setup.
- `097e32d`: isolated hosted-Tiger probe, Hall thumbnail and deterministic asset validation.
- `035f999`: inspected screenshots and both recordings from the final browser pass.

## Behavior and choices

- Personal homes are owner-only, including the WebSocket reducer. Old grants cannot authorize
  edits; the retired invite endpoint returns 410. Visitors receive live changes.
- The existing plaza `town_hall` address becomes the Community Hall, preserving the town layout
  and registry ID. Its new model is `community_hall.glb`: 696 triangles, embedded ASSET-008 wood,
  shingle, stone and fabric textures, large glass windows, stage, gallery and planters.
  Rebuild with `python assets/build_community_hall.py`.
- Hall rooms use the village UUID as the room key. Membership is checked on every edit.
  Everyone can move items; only the original creator or village owner can stash them.
  Buying furniture grants the actor an entitlement usable in their home and the Hall.
- Independent instance IDs permit duplication. Ready photo objects use their existing custom
  inventory UUID, authenticated GLB/thumbnail assets and server-resolved creator attribution.
  Only their owner can place, restore or duplicate them. No CV/provider generation is triggered.
- Floors are zero-based in storage: home levels 1 / 2–3 / 4–5 have 1 / 2 / 3 floors; the Hall
  has two. Existing furniture stays on floor 0. One ordered room stream carries floor metadata,
  so tab changes cannot miss edits. Views and collision checks are scoped to the selected floor.
  Other floors are cut away; the camera glides vertically (instant with reduced motion).
- Limits: 30 accepted edits/second per actor/room, 20 placements/minute, 256 instances per room.
  Limits are checked under the room lock. New Hall instances produce one activity-feed line;
  moves, rotations and restores do not produce addition spam.
- The UI uses the app's typography, muted materials, soft light, wall art and trim; narrow
  categorized inventory, authenticated photo thumbnails, contextual rotate/duplicate/stash,
  subtle placement guides, keyboard-accessible floor tabs and clickable stairs.

## Try it

Apply API migrations and `apps/api/scripts/tiger_migrate.py` to the intended deployment's main
and Tiger databases before deploying the API. This worker does not migrate or modify the live demo.
Open **Community Hall** in the village HUD or click its plaza building. Select **Decorate**;
try furniture, the **Photo objects** category, and the floor tabs/stairs. A second member sees
changes live. Visit another member's home to confirm the editor is absent.

Offline mode uses fixture furniture and local storage/BroadcastChannel; generated assets and
the GPU worker are optional. The Hall model also has the normal town geometry fallback.

## Validation and evidence

Commands below run from the owning app directory through `../../ops/remote_run.sh`
using Git Bash on Windows. Heavy checks use the shared remote runner.

- API: `../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat015.py tests/test_feat019.py tests/test_integ014.py`
  — exit 0 on the final rerun, 17 passed / 1 skipped in 16.49 seconds. The skipped check requires a configured Tiger URL;
  the hosted Tiger probe below tests the real service with its own isolated schema.
- Web unit tests: `../../ops/remote_run.sh bun run test` — exit 0, 180 passed, 0 failed.
- Production build: `../../ops/remote_run.sh bun run build` — exit 0 on the final source
  revision, built in 20.25 seconds after TypeScript checking. Vite reports the
  existing large-chunk advisory.
- Browser: `../../ops/remote_run.sh --with-api bunx playwright test --config playwright.feat019.config.ts`
  — exit 0 twice, 1 full two-user scenario passed per run. The final styled capture
  passed in 1.5 minutes of execution (1668.63 seconds including queue/sync).
- Asset validation: `python assets/validate_feat019.py` — exit 0; catalog parity,
  material names, embedded textures and 696-triangle Hall verified.
- Hosted Tiger/public latency: from the worktree root,
  `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe apps/api/scripts/run_feat019_tiger_probe.py`
  — exit 0. The launcher reads `VILLAGE_ENV_FILE` at runtime and invokes
  `../../ops/remote_run.sh --env FEAT019_TIGER_DSN --with-api python -m uv run python scripts/feat019_public_probe.py`
  from `apps/api`. **p95 75.29 ms; p50 71.98 ms**, 30 measured updates after 5 warmups,
  with no measured samples discarded. Two clients on the runner traverse a public Cloudflare
  URL, the scratch API, hosted Tiger and NOTIFY to the other member. Each update's floor
  metadata is asserted. This is a measured test path, not a global latency guarantee.
  The uniquely named Tiger schema was removed successfully; the wrapper cleaned up the
  scratch API/database. Results: `apps/api/artifacts/feat019/public-latency-tiger.json`.
- `ruff check apps/api/app/houses.py apps/api/scripts/feat019_public_probe.py apps/api/scripts/run_feat019_tiger_probe.py apps/api/scripts/seed_feat019_qa.py apps/api/tests/test_feat019.py`
  and `git diff --check`: exit 0. Ruff ran from the existing sibling API environment.

Initial verification exposed obsolete invite assertions, which were updated to the retired
endpoint's 410 response. An earlier browser attempt exhausted the runner's 30-minute queue
budget (124); the completed rerun above passed. An initial public probe failed during
quick-tunnel DNS setup before recording samples; setup retries do not discard timed samples.
Follow-up fallback-latency, build and API jobs also exhausted the shared queue budget (124).
The waiting hosted-Tiger invocation in the browser queue was stopped (143) and moved to
the API queue. No hosted schema had been created by that cancelled attempt.

The browser and latency tools refuse the live demo; they require runner scratch databases.
The synthetic photo-object fixture contains authored geometry and a material swatch, not a photo.

### Visual review

Inspected final desktop and 390×844 mobile captures. The cream/sage palette, typography,
timber materials and compact controls match the existing town UI and material library.
Review prompted quieter snapping guides, muted peer name labels instead of placeholder
portraits, and feet under upholstered furniture. The final screenshots show those changes,
working floor tabs/stairs, custom-object thumbnails and contextual controls. The browser
also verifies no horizontal overflow and no page errors. A premature town-loading frame
is excluded from the evidence; the Hall asset has its own inspected render.

Evidence under `apps/web/tests/artifacts/feat019/`:

- `home-desktop.png`, `home-floor3.png`
- `hall-floor2-desktop.png`, `hall-photo-object.png`, `hall-mobile.png`
- `community-hall-asset.png`
- `session-a.webm`, `session-b.webm` — both pages from the final passing scenario.

## Changed files

- API: `app/houses.py`, `app/domain.py`, `migrations/052_house_floors.sql`,
  `scripts/tiger_migrate.py`, `tests/test_feat015.py`, `tests/test_feat019.py`, and the
  three FEAT-019 QA/latency scripts.
- Web: `src/App.tsx`, `src/components/HouseInterior.tsx`, `src/components/HouseInterior.css`,
  `src/scene/Furniture.tsx`, `src/scene/GridTown.tsx`, `src/scene/interior.ts`,
  its unit test, catalog fallback, QA preview, Playwright config and browser scenario.
- Assets/catalog: `community_hall.glb`, `town_hall.png`, catalog source/generated registry,
  `assets/build_community_hall.py`, `assets/validate_feat019.py`, this report and QA evidence.
- Contract: `packages/contracts/api.md`.

## Contract / deployment notes

No remaining task blockers. Apply the additive main/Tiger migration before deployment.

`packages/contracts/api.md` is updated. The integrator can fold
`apps/api/migrations/052_house_floors.sql` into the owned baseline `schema.sql` later; that file
was intentionally not edited. The Tiger migration entry point includes the new migration.
The browser can continue receiving all-floor deltas while rendering one floor; no per-floor
socket reconnection is needed. Hall feed writes use the existing main database after the room
transaction commits, matching the current two-database architecture.
