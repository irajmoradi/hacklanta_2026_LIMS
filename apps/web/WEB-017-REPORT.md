# WEB-017 — idle activities, shelter pets, and map controls

Branch: `web/WEB-017`.

Milestones:

- `3078045` — API persistence, migration, contract, and pytest.
- `77332c5` — activity UI, schedules, poses, badges, shelter, camera, and unit tests.
- Browser evidence and final verification are recorded in the subsequent QA commit.

## Behavior and choices

The user's idle preference is global, defaults to `home`, and can be changed directly on their own profile card or in Settings. Both real and mock APIs support partial updates. The API rejects unknown/null activities and `walk_pet` without an equipped pet. `/me` also exposes `has_equipped_pet`; the village/profile projection includes `idle_activity`.

Chosen activities occupy 510 seconds of a ten-minute cycle. The remaining 90 seconds target home, staggered by stable house slot. Explicit `home` stays home instead of taking WEB-016's automatic store visits. Festival night and active Mayor events retain priority. Destinations are routed through the existing sidewalk graph and crossings; pet walking uses a rectangular loop beside the main road. Missing/locked destinations fall back home; gardening can use an existing planted park lot. A pet preference remains stored after unequipping, but the displayed village uses home when it has no equipped pet.

Reading sits, gardening crouches and leans, dancing bobs/sways, and food leans/bobs and uses a hand-to-mouth pose on the procedural avatar. Each label shows its actual arrival/activity state, including Walking while en route and Gathering with Mayor for events. Badges remain inside the existing profile button; spacing clears neighboring house plates without changing the HUD's hit-test priority.

The unlocked shelter has four wandering dogs using the existing two dog GLBs, with procedural fallbacks and a fenced yard. No generated assets or GPU worker are required.

Left drag and one-finger drag pan on the ground; the wheel zooms toward the cursor; right drag and two-finger motion rotate; pinch zooms. Existing town/zoom limits remain. Drag gestures suppress scene clicks. Reset view clears camera momentum and preserves mounted villagers, positions, and cached heads. The existing head-cache regression now asserts that reset does not refetch assets. Profile focus survives canvas resizing, and target bounds are applied after drag momentum.

## Files changed

- `apps/api/app/{models,main,domain}.py`
- `apps/api/migrations/014_idle_activity.sql`
- `apps/api/tests/test_web017.py`
- `apps/api/scripts/web017_preview.py`
- `packages/contracts/api.md`
- `apps/web/src/api/{types,mock,idleActivity,settings.test}.ts`
- `apps/web/src/components/{IdleActivityPicker,ProfilePanel,SettingsPanel}.tsx`
- `apps/web/src/scene/{GridTown,LabelSpacing,ShelterPets,TownCamera,VillageScene}.tsx`
- `apps/web/src/scene/layout/{town,town.test}.ts`, `src/scene/worldTypes.ts`, `src/styles.css`
- `apps/web/playwright.config.ts`, `playwright.web017.config.ts`, `playwright.web017-real.config.ts`
- `apps/web/tests/{web017,web017-real,heads,settings}.spec.ts`
- This report and the WEB-017 screenshots listed below.

## Verification

Commands run from their respective app directory. Python used the existing Python 3.12 environment at `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`; `VILLAGE_ENV_FILE` pointed to the supplied root environment file at runtime. No credentials were copied into the worktree.

| Command | Exit | Result |
| --- | --- | --- |
| `python -m pytest -q tests/test_web017.py` | 0 | 10 passed |
| `python -m pytest -q` | 0 | 286 passed, 2 skipped |
| `bun test src` | 0 | 65 passed, 5,022 assertions |
| `python -m ruff check app/main.py app/models.py app/domain.py tests/test_web017.py scripts/web017_preview.py` | 0 | Changed Python files passed |
| `bun run typecheck` | 0 | TypeScript passed |
| `bun run build` | 0 | Production build passed; existing large-chunk warnings |
| `bunx playwright test web017.spec.ts web016.spec.ts --config=playwright.web017.config.ts --timeout=120000` | 0 | 7 passed: settings, label spacing/hit testing, mouse/touch, bounds, profile focus after resize, desktop/mobile outfit regressions |
| `bunx playwright test --config=playwright.web017-real.config.ts` | 0 | Real FastAPI/PostgreSQL persistence, reload, settled Reading badge, and screenshots |
| `bunx playwright test --config=playwright.web017.config.ts` | 1 | 50 passed; 4 failures subsequently resolved below |
| `bunx playwright test --config=playwright.web017.config.ts --last-failed --timeout=120000` | 0 | All 4 passed: settings PATCH and head-cache assertions updated; prayer/playback timing cases passed on rerun |

Across the full suite and follow-up runs, all 58 distinct browser regression scenarios passed, plus the separate real-mode scenario. The table preserves the original nonzero run rather than presenting it as a clean first pass.

An intermediate unit run timed out in the existing generated-head test while browser jobs were active; rerunning the complete unit suite passed. Early unit/browser runs caught and fixed an off-graph pet waypoint and residual reset momentum. Test harness corrections covered native disabled options, dialog exit animation, and fixed-step wheel zoom. Dedicated ports avoid another active worktree's Vite servers.

## Screenshots

All WEB-017 real-mode images use a disposable PostgreSQL schema with seeded initials/preset avatars, not real people's photos or voices:

- `apps/web/test-results/web017/settings-real.png`
- `apps/web/test-results/web017/town-real.png`
- `apps/web/test-results/web017/shelter-real.png`
- `apps/web/test-results/web017/settings-mock.png`
- `apps/web/test-results/web017/map-mock.png`

The real-mode test uses the local FastAPI preview on port 8027 and Vite on 5296. Providers and the Mayor scheduler are disabled. The GPU worker is not required. Screenshots were visually inspected, including the four dogs within the yard and readable activity labels.

## Try it

1. Apply the migration through the existing `apps/api/scripts/migrate.py` runner, with `VILLAGE_ENV_FILE` set to your normal environment file. Restart the API.
2. Start the web app normally. Open **My profile**, choose an **Idle activity**, or use **Settings → Idle activity → Save settings**. Only your own profile offers the picker.
3. Equip a pet in the wardrobe to enable Walking Pet. Close the profile to let the avatar walk. Active Mayor events/festival night intentionally override idle destinations until they end.
4. Drag, wheel, right-drag, or use touch gestures over the map. The small reset icon has the **Reset view** tooltip.
5. After API pytest has prepared `village_test`, for repeatable real-mode QA without modifying the shared village, run `python scripts/web017_preview.py` from `apps/api`, then `bunx playwright test --config=playwright.web017-real.config.ts` from `apps/web`. The preview uses only `village_test`, creates its own schema, seeds fixtures, and drops that schema on graceful shutdown.

## Blockers and contracts

No product blocker. Migration 014 must be applied before running the changed API. The authorized API contract update is included; no additional contract changes are proposed. Browser checks use software WebGL and do not certify hardware frame rate.
