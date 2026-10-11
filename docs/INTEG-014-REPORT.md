# INTEG-014 integration report

Branch: `integ/INTEG-014`, based on `703ff65` (already includes INTEG-013).

- `91cb4c9`: merge FEAT-018 stretch goals.
- `93e3002`: merge FEAT-016 cinematic check-in and Mayor.
- `19b81e4`: merge FEAT-015 house interiors.
- `28db3a9`: integration fixes and regression coverage.

All three feature branch tips are ancestors of this branch (`git merge-base --is-ancestor`, exit 0 each). Nothing was pushed or merged to main.

## Result

Stretch goals, cinematic conversations, and house interiors now coexist with the current dashboard, toast queue, HeadStudio, profile settings gear, exterior house editor, weekly auditor exclusion, compact goal cards, and scene effects. Web test scripts include the union of the existing, stretch, and interior tests. The HTTP contract retains all feature sections.

The cinematic Goal progress choice enables the active stretch tier, passes both goal ID and stretch tier to check-in submission, and keeps the existing reward/confirmation toast queue. Completed goals offer Go beyond from the conversation. Goal and Mayor wording retains the COPY-001 voice; the fixed Mayor audio greeting matches its displayed greeting. No background generation loop was added.

House interiors pause the outdoor renderer and block its controls. A room remains mounted when the profile changes between desktop and mobile, retaining furniture and decorating state. The mobile profile yields the modal layer to the room and reopens on exit. Interior keyboard events cannot dismiss the underlying profile. Both Go inside and Edit my house remain available on the House tab.

Migration names are unique:

| Original branch name | Integrated name |
| --- | --- |
| `048_goal_stretch.sql` | `049_goal_stretch.sql` |
| `047_house_interiors.sql` | `050_house_interiors.sql` |
| `048_house_presence.sql` | `051_house_presence.sql` |

All three can be replayed without losing existing stretch/furniture data. The house migrations retain their table/index, hypertable, and compression-policy idempotency guards. `tiger_migrate.py`, reports, and API documentation reference the new names. Main's existing idempotent `047_competition_scoring.sql` was retained unchanged, including its guarded constraint. The task record preserves the original branch names because it describes the historical collisions.

The full API suite exposed the repair-count failures previously reported by INTEG-013. Disaster boundaries used the API host clock, while check-in timestamps used Postgres. Using Postgres time for disaster start and repair windows prevents clock skew from including old posts or excluding new ones. New tests simulate API clocks an hour ahead and behind; existing repair tests and the final full suite pass.

## Validation

Web commands ran from `apps/web`; API commands ran from `apps/api` using `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`. API settings load `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env` at runtime. No secret values were copied into files.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Dependencies installed, including pot postinstall; no lockfile changes. |
| `bun run typecheck` | 0 | TypeScript passes. |
| `bun run test` | 0 | 179 passed across 45 files. |
| `bun test src --timeout 30000` | 0 | 205 passed across 51 files. |
| `bun run build` | 0 | Production build succeeds; existing large-chunk warning. |
| `python -m pytest -q --basetemp=.runtime/integ014-final --tb=short` | 0 | 463 passed, 3 skipped; one Starlette/httpx deprecation warning. |
| `python -m pytest -q tests/test_integ014.py tests/test_feat012.py tests/test_api009.py::test_penalties_recover tests/test_demo_story.py::test_demo_server_keeps_existing_assets_and_authorizes --basetemp=.runtime/integ014-repairs --tb=short` | 0 | 29 passed, including migration replay and host-clock skew. |
| `python -m ruff check app/disasters.py scripts/feat015_preview.py tests/test_integ014.py` | 0 | Changed repair code, QA script, and new regression tests pass lint. |
| `bunx playwright test --config playwright.feat015.config.ts` | 0 | Two real browser clients, pointer dragging, editor grants, synchronized furniture, undo, and mobile overflow pass against private QA schemas. |
| `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.integ014.config.ts integ014.spec.ts web035.spec.ts` | 0 | Four focused browser checks pass. |
| `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.integ014.config.ts` | 0 | Final combined run: all 19 tests pass, including cinematic/Mayor, stretches, interior/exterior coexistence, COPY-001, auditor exclusion, HUD/toasts, and three viewport contrast audits. |

The final production build was rerun after preserving the room across profile viewport changes and exited 0.

The Tiger test measured 20 editor-action-to-observer-paint updates: p50 **131 ms**, p95 **143 ms**, all 20 at or below 250 ms. Measurements are in `apps/web/artifacts/feat015/latency-local.json`. This is local browser/API transport to Tiger, not a fresh public-tunnel benchmark.

Earlier attempts are not claimed as passing: the first broad API run exited 1 with 136 passed, 3 skipped, and 324 setup errors because the old stretch table already existed. Repeatable DDL fixed that. The next broad run exited 1 with 449 passed, 3 skipped, and 11 failures (repair clock boundaries plus a demo-asset failure while a concurrent pytest invocation reused the configured basetemp). A concurrent focused run exited 1 with 17 passed and one temp-directory setup error; final runs use separate explicit basetemps. The repair-focused reproduction exited 1 with 16 passed and 5 repair failures before the clock fix.

The first combined browser run exited 1 with 14 passed and 3 failures: missing cheer wiring, obsolete Gazette wording, and contrast measurement during widget entrance animation. The next exited 1 with 16 passed and 2 failures: the mobile interior/profile layering bug and a transient Windows screenshot write error. Fixes preserve animation and contrast assertions, waiting for the widget entrance to finish before auditing. Early typechecking also caught merge-resolution syntax errors, fixed before successful checks. Initial root-directory Bun invocations exited 1 because the scripts/package live in `apps/web`; the commands above were rerun there. Initial Ruff checks exited 1; formatting/import corrections produced the final exit 0.

## Isolation and cleanup

API pytest uses `village_test` and private per-run schemas, with provider calls mocked. Mock browser tests use fixture avatars, including an explicit missing-model flow. House collaboration ran through `scripts/feat015_preview.py` on API port **8015**, with private schema `feat015_qa_02747512ccc4` in both local `village_test` and Tiger. Only synthetic fixtures and furniture were modified. Those exact schemas were removed after the run, and both QA servers were stopped. Other QA schemas were left alone. No live demo actions on :8010, paid generation, messages, or transactions were performed.

The preview script now records folded baseline migrations before applying additions and prints its private schema name for cleanup. This keeps the synthetic QA path compatible with the current folded schema.

## Try it

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 15314
```

1. Choose a demo seat. Open My goal, mark the base goal done, enter a stretch target, and select Go beyond.
2. Open Check in, choose Goal progress, and submit an update. Reopen My goal and finish the stretch.
3. Open Mayor and try the six conversation choices; use Back or Escape to return.
4. Open My profile, then House. Edit my house opens the exterior editor; Go inside opens the furniture editor. Decorate, move furniture, resize to mobile, and return to town. The room retains its changes.
5. Run the combined regression suite: `$env:VILLAGE_BROWSER_GPU='hardware'; bunx playwright test --config playwright.integ014.config.ts`.

For isolated connected house QA, run `python scripts/feat015_preview.py` with the external env file, then start Vite with `VITE_MOCK=0`, `VITE_DEMO_AUTH=1`, and `VILLAGE_API_URL=http://127.0.0.1:8015` on port 5185. Run `bunx playwright test --config playwright.feat015.config.ts`. The script creates a private schema; use its printed name to verify cleanup if the process is forcibly terminated. Do not point this test at :8010.

## Visual evidence and changed files

Reviewed screenshots:

- `apps/web/tests/screenshots/FEAT-018/stretch-complete.png`: completed tier and retained reward toast.
- `apps/web/tests/screenshots/FEAT-016/checkin-cheer.png`: villager cheer, camera, and toast confirmation.
- `apps/web/tests/screenshots/FEAT-016/mayor-mobile.png`: mobile conversation.
- `apps/web/tests/artifacts/integ014/interior-desktop.png` and `interior-mobile.png`: integrated offline room.
- `apps/web/tests/artifacts/integ014/checkin-after-interior.png`: return from room to cinematic check-in.
- `apps/web/artifacts/feat015/decorating-owner.png`, `decorating-neighbor.png`, and `decorating-mobile.png`: connected synthetic collaboration.
- `apps/web/tests/artifacts/web034/dialog-390.png`: mobile toast/conversation separation; the suite also captures desktop panels, alerts, and widgets.

Full changed-file inventory: [INTEG-014-FILES.txt](INTEG-014-FILES.txt), relative to task-start commit `703ff65`. Changes are confined to `apps/**`, `packages/**`, and `docs/**`. The principal areas are the API stretch/house/voice adapters and migrations; web cinematic/interior/goal components, scene wiring, mock client and tests; furniture catalog/thumbnails; additive HTTP contract sections; and QA evidence.

Blockers: none. No proposed contract changes remain outside the merged, documented feature sections. No deployment or main-branch merge was performed.
