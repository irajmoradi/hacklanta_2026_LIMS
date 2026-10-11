# WEB-024 delivery

Branch: `web/WEB-024`. Milestones: `847a6e1` (implementation),
`38c9dcf` (pose corrections and regression tests). Final validation/report
commit is the branch tip (`git log -1 --oneline`). Nothing pushed or merged.

## Delivered

- Added `working_out` and `gaming` preferences to API validation, a distinct additive
  migration, shared picker/badges, the offline mock, catalog and scene schedule.
- Fitness Corner is an always-open park asset: pull-up bar, bench, two kettlebells,
  and mat. Its deterministic GLB contains **288 triangles**, below the 4,000 limit.
  The same geometry factory supplies the no-model fallback. Villagers cycle through
  push-ups, squats and jumping jacks, with explicit paths into the exercise area.
- Gaming hides the avatar on arrival at its own doorstep, keeps its Gaming badge,
  and flickers the actual house glass materials. Offline houses have matching lit
  window surfaces. Leaving gaming restores the original window emission and avatar.
- Chilling at Home and Studying remain separate and retain their existing behavior.
- Disabled goal-progress check-ins explain missing, completed or inactive goals and
  offer a button opening the existing goal editor.
- The top-bar Settings button and the empty Villager-gram Settings shortcut already
  existed in this branch. Preserved them and covered both with browser tests.

## Choices

- API keys are `working_out` and `gaming`; neither replaces `home`.
- Both activities follow the existing 510-second activity / 90-second home cycle
  and existing Mayor/festival overrides. Fitness requires no XP or generated assets.
- Each exercise lasts eight seconds, staggered by house slot. Skeletal animation
  offsets preserve the GLB bind pose; fallback avatars use matching procedural poses.
- No paid providers, model generation, messages or blockchain transactions were used.
  API tests read the supplied environment file at runtime and isolate their database
  work in `village_test`; no secrets were copied into repository files.

## Validation

Commands ran from the indicated directory. Final results:

| Directory | Command | Result / exit |
| --- | --- | --- |
| repository | `bun apps/web/scripts/export-fitness.ts` | 288 triangles / 0 |
| `apps/web` | `bun run test` | 102 passed / 0 |
| `apps/web` | `bun run typecheck` | passed / 0 |
| `apps/web` | `bun run build` | passed; existing large-chunk warning / 0 |
| `packages/catalog` | `bun run validate` | 293 entries; regenerated catalog / 0 |
| `packages/catalog` | `bun test` | 36 passed / 0 |
| `apps/api` | `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe -m pytest tests/test_web017.py tests/test_web024.py -q` | 15 passed / 0 |
| repository | `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe -m ruff check apps/api/app/models.py apps/api/tests/test_web024.py apps/api/tests/test_web017.py` | passed / 0 |
| `apps/web` | `bunx playwright test --config playwright.web024.config.ts` | 4 passed (5.0 minutes) / 0 |
| repository | `git diff --check` | passed / 0 |

Initial validation failures were corrected: missing local JS dependencies, the
study-seat baseline test including the newly added fitness building, lint line
lengths, and browser automation expecting the picker in an older profile layout.
`uv` was unavailable on PATH (exit 1); API checks used the existing Python 3.12
environment shown above. Intermediate browser runs were stopped for pose and
screenshot improvements; the final result is recorded above.

## Browser evidence

Real Chromium screenshots, using fixture identities and no generated personal assets:

- `apps/web/test-results/web024/gaming-models.png`
- `apps/web/test-results/web024/gaming-fallback.png`
- `apps/web/test-results/web024/workout-models.png`
- `apps/web/test-results/web024/workout-fallback.png`
- `apps/web/test-results/web024/goal-missing.png`
- `apps/web/test-results/web024/goal-done.png`

## Try it

From `apps/web`, set `VITE_MOCK=1` and run `bun run dev`. Choose a demo seat, open
**Settings** beside Inbox, change **Idle activity**, save and close the dialog.
Gaming stays at home; Working out walks to the park fitness corner. Close any open
profile to allow movement. Mayor gatherings/festival weather can temporarily take
precedence. The browser suite pins a quiet activity phase for repeatable evidence.

For a connected API, set `VILLAGE_ENV_FILE` to the supplied environment file and run
the normal `apps/api/scripts/migrate.py` command before starting the API. This adds
`046_web024_idle_activities.sql` without editing the baseline schema. Open Check in
with no goal or a completed goal to try the new explanation and goal-editor shortcut.

## Files changed

- `apps/api/app/models.py`, `apps/api/migrations/046_web024_idle_activities.sql`,
  `apps/api/tests/test_web017.py`, `apps/api/tests/test_web024.py`.
- `apps/web/package.json`, `apps/web/playwright.web024.config.ts`,
  `apps/web/tests/web024.spec.ts`, this report and the six screenshots above.
- `apps/web/public/models/fitness_corner.glb`, `apps/web/scripts/export-fitness.ts`.
- `apps/web/src/App.tsx`, `apps/web/src/components/Modals.tsx`.
- `apps/web/src/api/{idleActivity.ts,types.ts,settings.test.ts}`.
- `apps/web/src/scene/{FitnessCorner.tsx,GridTown.tsx,OptionalModel.tsx,VillageScene.tsx,
  catalog.fallback.json,fitnessAsset.ts,gamingLight.ts,workout.ts,worldTypes.ts}`.
- `apps/web/src/scene/layout/{town.ts,navigation.ts,idleActivities.test.ts,studySeats.test.ts}`.
- `packages/catalog/catalog.json`, `packages/catalog/dist/catalog.ts`,
  `packages/contracts/api.md`.

Blockers: none. Contract changes were allowed and implemented in `api.md`;
no further contract changes proposed. The baseline schema is unchanged.
