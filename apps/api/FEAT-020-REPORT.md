# FEAT-020 ? Library weekly reading list

Branch: `feat/FEAT-020`. Implementation milestone: `6e61731`; API/contract regression milestone: `50fa2f5`.

## Behavior and choices

- Shared Library shelf, separate from weekly goals, available from the dashboard and an unlocked Library building.
- Monday 00:00 UTC weeks; ten items per village/week. Older shelves and their reactions are read-only.
- Each member's first five completions earn 5 XP and 5 coins each. Further reads remain visible without rewards.
- Permanent completion, optional 280-character takeaway, portraits, activity reactions, feed and accomplishments.
- Weekly-review reading counts/awards are informational and do not participate in crown scoring, including for auditors.
- Explicit Suggest button caches one or two Mayor suggestions per village/week, including a provider-offline fallback.
  Suggestions fill the form and require Add reading. No provider calls in tests, no background generation.
- Anonymous attribution preserves shared items and other readers when a contributor deletes their account.
- Library refreshes every 15 seconds while open; no generated avatar/GPU dependency. The background
  3D scene pauses while reading, as it does for the shop.

## Files

API: `app/reading.py`, `app/main.py`, `app/domain.py`, `app/reactions.py`, `app/weekly.py`,
`migrations/054_reading.sql`, `tests/test_feat020.py`.
Web: `src/api/reading.ts`, `reading.test.ts`, `mock.ts`, `reactionMock.ts`, `types.ts`;
`src/components/ReadingList.tsx`, `ReadingList.css`, `Dashboard.tsx`, `WeekPanel.tsx`,
`Accomplishments.tsx`, `activityData.ts`; `src/App.tsx`, `src/scene/GridTown.tsx`,
`VillageScene.tsx`; `package.json`, `tests/feat020.config.ts`, `tests/feat020.spec.ts`.
Contract: `packages/contracts/api.md` (authorized task scope). This report.

## Try it

Apply API migrations using the existing migration runner against your development database, then start API/web normally.
For an offline demo, start web with `VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev` and choose a demo seat.
Open dashboard **Reading list** (or click an unlocked Library), add a title and optional details,
mark it read with a takeaway, and react to a reader. Browse Previous week for the archive.
Open Weekly review for the reading bonus line; open Accomplishments for finished books.

## Validation

All heavy commands use `ops/remote_run.sh`; API runs on runner scratch data, Playwright uses forced mock mode.
No live demo mutations, secrets copied, paid generations, or Solana transactions.
- From `apps/api`: `../../ops/remote_run.sh python -m uv run pytest -q tests/test_feat020.py tests/test_feat018.py tests/test_web032.py` ? exit 0, 8 passed.
- From `apps/web`: `../../ops/remote_run.sh bun run test` ? exit 0, 181 passed, 0 failed.
- From `apps/web`: `../../ops/remote_run.sh bun run build` ? exit 0. Existing large-chunk advisory remains.
- A final build caught an unsupported top-level Playwright `reducedMotion` option in the test config (exit 1). Removed that unused option; retained the tested background-scene pause and 120-second browser timeout.
- Local lightweight lint: `ruff check apps/api/app/reading.py apps/api/app/reactions.py apps/api/app/weekly.py apps/api/tests/test_feat020.py` ? exit 0.
- `git diff --check` ? exit 0.
- Initial targeted API run exited 1 during migration setup: Timescale activity IDs cannot be referenced by an ID-only foreign key. Fixed using the existing reactions system's logical ID reference; the successful run above includes migration replay.
- First Playwright attempt on the old runner was canceled when shared runner configuration switched hosts; its leftover queue processes were cleaned up.
- First executed browser run exited 1 at the 60-second test timeout during the mobile screenshot, after add/complete/takeaway/reaction assertions and desktop capture succeeded. Increased the browser test timeout to 120 seconds and paused the background 3D scene while the Library is open.
- From `apps/web`: `../../ops/remote_run.sh bunx playwright test --config tests/feat020.config.ts` ? final exit 0, 1 passed (40.5 seconds test execution). Includes add, takeaway, permanent completion, reward display, reaction, archive read-only UI, cached suggestion selection, and a 390px horizontal-overflow assertion.
- Visually inspected `apps/web/artifacts/feat020/desktop.png` (1440x1000) and `apps/web/artifacts/feat020/mobile.png` (390x844). Book shelf, navigation, title/author/why, reader portrait, takeaway, reaction and earned reward are legible without horizontal clipping. Forms continue in the normal vertical dialog scroll.
- Screenshots remain generated local QA artifacts at the task-requested output path; code/report commits stay within the explicit allowed_paths.

## Blockers and contracts

No remaining blockers. The authorized `packages/contracts/api.md` section documents the new routes,
permanent-completion semantics, UTC archives, caps, suggestions, and weekly-review extension.
No additional contract changes are proposed. Migration 052 was the next free number after 051 on local `main`.

