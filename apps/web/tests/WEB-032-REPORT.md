# WEB-032 final report

Branch: `web/WEB-032`. Implementation milestone: `f018168` (`feat(web032): public neighbor trophies and grouped activity`). The subsequent report/screenshots commit contains this report and the validation artifacts.

## Result and choices

- Neighbor Rewards has a named trophies heading, Earned and Still to earn sections, equipped badges and acquisition-date chips. Only API-exposed equipped rewards count as public ownership. A privacy note explains that undisclosed items may already be privately owned. Own profiles retain “Earn your next signature.” Unknown dates and progress are explicitly unavailable; no ownership or history is invented. Streak progress is the subject's streak.
- Catalog spelling is “Mayor’s Medal”; generated catalog is refreshed. Validation rejects common mojibake and replacement characters.
- Shared dashboard/profile feed groups consecutive same-person/type events on the same UTC day, before filtering and pagination. Purchases have a summary, static thumbnails or semantic icon fallbacks, and expandable individual events. The minimized widget shows at most four grouped lines. Avatars, type icons and relative times remain compact.
- Reactions appear only on goals, evidence check-ins, wins, badges and level-ups. Existing counts are pills; Add reaction opens the palette. Expanded groups retain each original event's reaction target. Other uses of the shared reaction control also receive the compact picker.
- API and browser boundary filtering hide QA-prefixed status/check-in text. Feed responses add `payload.has_evidence` for legacy check-in events, allowing eligibility without exposing private evidence IDs.
- Exactly eight demo QA check-ins were deleted, then zero remained. See `../../api/scripts/WEB-032-CLEANUP.md` from `apps/web` (repository path: `apps/api/scripts/WEB-032-CLEANUP.md`).

## Files changed

Web: `package.json`, `playwright.config.ts`, `playwright.web032.config.ts`; `src/api/{client,mock}.ts`; `src/components/{ActivityFeed.tsx,activityData.ts,activityFeed.test.ts,Dashboard.tsx,ProfilePanel.tsx,ProfileSections.tsx,ReactionBar.tsx}`; `src/styles.css`; `tests/web032.spec.ts`; this report and four `tests/screenshots/WEB-032-*.png` artifacts.

API: `app/{domain,main}.py`, `scripts/cleanup_qa_checkins.py`, `scripts/WEB-032-CLEANUP.md`, `tests/test_web032.py`.

Catalog: `catalog.json`, `dist/catalog.ts`, `validate.ts`, `validate.test.ts`.

## Validation

Commands ran from their respective package directories. All final commands below exited 0:

| Directory | Command | Result |
| --- | --- | --- |
| apps/web | `bun run typecheck` | Passed |
| apps/web | `bun run build` | Passed; existing large-bundle warning |
| apps/web | `bun run test` | 129 passed, 0 failed |
| packages/catalog | `bun run validate` | 300 entries validated, generated catalog refreshed |
| packages/catalog | `bun test` | 46 passed, 0 failed |
| apps/api | `<api-python> -m pytest tests/test_web032.py tests/test_fix003_feed.py tests/test_feat001.py -q` | 12 passed |
| apps/api | `<api-python> -m ruff check scripts/cleanup_qa_checkins.py tests/test_web032.py` | Passed |
| apps/web | `bunx playwright test --config playwright.web032.config.ts` | 1 passed; neighbor/own rewards, privacy, dates, progress, grouped purchases, picker/count pills, profile and four-line widget |
| repository | `git diff --check` | Passed |

Initial validation exposed missing dependencies and a Windows case-insensitive module-name collision; both were fixed. An initial standard-config browser invocation exited 1 because port 5174 was already occupied. The committed isolated config runs this worktree on port 5232 without disturbing another worker's server. A test-file line-length lint error was corrected.

Screenshots were visually inspected: `tests/screenshots/WEB-032-neighbor-rewards.png`, `WEB-032-neighbor-progress.png`, `WEB-032-profile-activity.png`, and `WEB-032-dashboard.png`. Only synthetic fixture avatars are present.

## Try it

From `apps/web`, run `bunx playwright test --config playwright.web032.config.ts` to reproduce the screenshots and deterministic scenarios. For manual offline use, set `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, then run `bun run dev --port 5232`. Choose a demo seat, open Stefanny's profile, inspect Rewards and Activity, then pop out Around the Village. API cleanup commands and safeguards are documented separately.

No blockers. No contract files were edited. Optional integrator documentation: record `feed.payload.has_evidence?: boolean` as a public evidence-presence flag. Full private reward inventory and unavailable dates/progress remain intentionally undisclosed.
