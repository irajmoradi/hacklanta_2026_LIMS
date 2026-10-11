# WEB-025 final report

Branch: `web/WEB-025`. API/catalog milestone: `61d9fd7`; cleanup hardening/API documentation: `0030762`.
The final web/report commit is the branch HEAD (see `git log -3 --oneline`).

Implemented a repeatable 25 XP photo consumable, consent-gated creation in Shop and Owned items,
resumable polling, result Equip/Place, automatic durable refunds, town photo wearables/patterns
and decorations, plus gated fresh demo guests with onboarding and safe cleanup.

## Changed files

- API: `app/photo_items.py`, `app/domain.py`, `app/demo.py`, `app/account.py`;
  migration `migrations/022_photo_refunds_guests.sql`; `tests/test_web025.py`, `tests/test_api011.py`.
- Catalog: `packages/catalog/catalog.json`, generated `packages/catalog/dist/catalog.ts`.
- Contract: `packages/contracts/api.md` documents token behavior, refunds, progress and guest routes.
- Web: `src/components/PhotoItems.tsx`, `DemoTools.tsx`, `Modals.tsx`, `ProfileOutfit.tsx`,
  `ShowcasePreview.tsx`; `src/App.tsx`; `src/api/client.ts`, `mock.ts`, `seat.ts`;
  `src/scene/Cosmetics.tsx`, `VillageScene.tsx`; `src/styles.css`.
- Browser verification: `playwright.config.ts`, `tests/web025.spec.ts`,
  `tests/screenshots/WEB-025-*.png` (nine screenshots).
- Instructions: `WEB-025-DEMO-TESTING.md` and this report, both under `apps/web`.

## Verification actually run

All commands below exited **0** on their final run. API tests read `VILLAGE_ENV_FILE`
at runtime and used private schemas in `village_test`; provider calls were mocked.
Python executable used: `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`.

| Working directory | Command | Result |
|---|---|---|
| `apps/api` | `python -m pytest tests/test_web025.py tests/test_api011.py tests/test_feat004.py tests/test_api010.py -q` | 28 passed, 1 explicitly paid test skipped |
| repository | `python -m ruff check apps/api/app/account.py apps/api/app/domain.py apps/api/app/photo_items.py apps/api/app/demo.py apps/api/tests/test_web025.py apps/api/tests/test_api011.py` | Passed |
| `apps/web` | `bun run typecheck` | Passed |
| `apps/web` | `bun run test` | 57 passed, 852 assertions |
| `apps/web` | `bun run build` | Passed; existing large-chunk warning |
| `apps/web` | `bun run test:e2e --project=mock web025.spec.ts --trace=off` | 4 passed |
| `packages/catalog` | `bun run validate` | 169 entries validated and generated |
| `packages/catalog` | `bun run test` | 23 passed |
| repository | `git diff --check` | Passed |

Initial runs found obsolete 404/no-refund expectations, a missing accessible selector label,
and a missing `input` in the new regression fixture; these were fixed. One pytest invocation
from the repository root failed because its relative temporary directory requires `apps/api`;
the final invocation above used the correct directory. A screenshot was recaptured after
waiting for the dialog exit animation. No paid GPU generation was performed.

## Try it

See `WEB-025-DEMO-TESTING.md`. On the intended deployment, apply API migrations and sync the
catalog, then rebuild/restart the web app. Open **Shop → Make it real**, buy a token, select a
photo/type, consent and Create. Use **Equip wearable** or **Place at my house** on completion.
Open **Debug menu → Start as a new person**, join with **HACKLANTA**, try the consented avatar
step, then Enter village. **Remove guest users** returns to Iraj and preserves seeded accounts.

Screenshots are actual Chromium captures of the explicitly labelled offline simulation:
`tests/screenshots/WEB-025-onboarding.png`, `WEB-025-avatar.png`, `WEB-025-refund.png`,
and `WEB-025-{wearable,object}-{progress,result,town}.png`.

## Limits and integration handoff

- `docs/DEMO_TESTING.md` is outside the task's allowed paths. Copy the prepared replacement
  sections from `apps/web/WEB-025-DEMO-TESTING.md`; the original file was left untouched.
- The current bridge records the entire photo pipeline as `segment`. The UI shows the pipeline
  path and actual coarse status; precise stylize/3D transitions require the worker owner to
  publish progress. No invented completion percentages or stages are shown.
- The shared live preview/DB was not restarted or modified. Deployment needs the migration and
  catalog sync. GPU-offline jobs remain queued; fixtures and normal village use still work.
- Guest cleanup refuses actively running avatar jobs with 409; retry once processing finishes.
- Contract additions were made in the explicitly allowed `packages/contracts/api.md`.
  No schema.sql change is proposed; the additive API migration owns storage changes.
