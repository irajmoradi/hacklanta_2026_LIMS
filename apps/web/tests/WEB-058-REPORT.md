# WEB-058 — QA-014 fixes

Branch: `web/WEB-058`. Implementation commits: `7570b43`, `65eaa79`, `0adc80d`, `a6b4473`.

## Changes and choices

- QA14-03: challenge ordering prioritizes participation/entries, then titles with at least four trimmed characters, then timestamps. Stable ties preserve the API's newest-first order. Empty challenges use a quieter border and title weight. No data is deleted. Feed competition links now select by ID rather than list index.
- QA14-04/10: the phone header wraps and the dock uses two rows. Dashboard starts collapsed on phones, including when an old expanded preference exists; reopening works for that session. Desktop keeps its saved preference. Collapsed content is inert and hidden.
- QA14-05/10: building signs are placed before villager/house labels. Labels avoid each other and fixed controls, and hide when no clear placement exists. Translated overlays leave no invisible wrapper hit target. The main village and Lab share this behavior. Walking/camera hints move clear of the dashboard and neighbor strip when the desktop profile is open.
- QA14-06: Gazette copy normalizes joined sentences and malformed apostrophe capitalization on publishing, historical API projection, and frontend issue adaptation. Weather prose is no longer title-cased. Links, contacts, decimals, abbreviations, source IDs and original stored issues are preserved. No edition was regenerated.
- QA14-07: badges show names such as “Weekly completion star · Sep 28, 2026”, with an explicit UTC date.
- QA14-08: the optional debug probe runs only with `VITE_DEMO_DEBUG=1`. Seat selection/heartbeats remain independent.
- QA14-09: mobile challenge browser and detail cards occupy separate vertical regions with independent scrolling. The invitation cannot cover filters or banners.
- QA14-11: feed event/update links open the selected item directly. Active event IDs resolve to their complete body and terms; older items preserve the feed snapshot. Plain text is rendered as text.

## Scope

Changed implementation files: `apps/api/app/newspaper.py`; `apps/web/src/App.tsx`; `api/{gazette.ts,gazetteCopy.ts,types.ts}`; `components/{ActivityUpdate.tsx,badgeLabel.ts,chromePreferences.ts,competitionOrder.ts,CompetitionsPanel.tsx,Dashboard.tsx,Dashboard.css,DemoTools.tsx,ProfilePanel.tsx,colosseum.css}`; `scene/{LabelSpacing.tsx,TownLabel.tsx}`; `styles.css`.

Tests: `apps/api/tests/test_web058_newspaper.py`; `apps/web/tests/{web058.test.ts,web058.spec.ts,web058-layout.spec.ts,web058.config.ts,qa014.spec.ts}`. Evidence lives under `apps/web/tests/screenshots/WEB-058/`.

## Verification

All heavy commands use runner 2 (`RUNNER_IP=<runner-2-ip>`) and the repository wrapper, from the relevant app directory. No live demo mutations, paid generation, real photos, root env copies or signed transactions.

The QA-014 harness was copied from `../hl-qa14` and adapted to the local mock server. It retains the context-wide network write guard and records every navigation failure. Adaptations: mock seat, an explicit in-memory Mayor recap fixture, reopening the now-collapsed mobile dashboard for feed coverage, the mock named challenge “The next chapter”, and the current Lab label “Your first day”. Type annotations were corrected so the harness participates in the web build.

Initial results: targeted Bun tests 6 passed (exit 0); first API normalizer tests 3 passed (exit 0). Initial build failed (exit 1) on TypeScript errors in the imported QA harness; corrected build passed (exit 0). Initial browser scout passed both Lab cases but failed on a screenshot timeout and an opacity-hidden collapsed dashboard button. After adding explicit screenshot timeouts and hiding collapsed content, the focused rerun passed all 4 cases (exit 0).

Completed commands (all wrapper exits 0):

- Web: `../../ops/remote_run.sh bun run test` — 264 passed, 0 failed.
- Web: `../../ops/remote_run.sh bun test tests/web058.test.ts` — 6 passed, 0 failed.
- API: `../../ops/remote_run.sh python -m uv run pytest -q tests/test_web058_newspaper.py tests/test_api009.py -k 'gazette or copy or historical or joined or links'` — 11 passed, 35 deselected.
- Web: `../../ops/remote_run.sh bunx playwright test --config tests/web058.config.ts web058.spec.ts` — 4 passed at 1440×900 / 390×844.
- Web: `../../ops/remote_run.sh bun run build` — passed; existing large-chunk advisory.

The screenshot-heavy broad scout was intentionally interrupted (remote exit 130, Windows command exit 1) to correct its stale Lab label and reduce capture overhead. A subsequent combined validation command was also interrupted (remote 130 / Windows 1): the loose Playwright filter `web058` matched the worktree path and unintentionally selected the broad sweep again. Explicit test filenames are used below. Neither interrupted scout is counted as a passing suite.

The final QA-014 replay uses `QA014_FAST=1`: every original navigation checkpoint and assertion still runs; short settling delays and screenshots of the principal findings/failures replace screenshots at every checkpoint. This does not measure production latency.

`QA014_FAST=1 ../../ops/remote_run.sh --env QA014_FAST bunx playwright test --config tests/web058.config.ts qa014.spec.ts` — exit 0, both viewport projects passed. Each recorded 81 checkpoints (162 total), with zero navigation failures, blocked network writes, page exceptions, HTTP errors, console errors or failed requests. The JSON observations in `screenshots/WEB-058/qa014/{desktop,mobile}/observations.json` preserve every checkpoint.

`../../ops/remote_run.sh bash -lc 'bunx playwright test --config tests/web058.config.ts web058.spec.ts web058-layout.spec.ts && bun run build'` — exit 0: all 8 browser/component-layout cases passed, followed by TypeScript and the production build. This includes direct hit tests, the desktop profile hint overlap assertion, and Lab signs at both population sizes and viewports.

`../../ops/remote_run.sh bash -lc 'bunx playwright test --config tests/web058.config.ts web058.spec.ts --project mobile --grep regressions && bun run build'` — exit 0: the final mobile header-width refinement passed the complete mobile navigation/arena/Gazette/feed regression, then TypeScript and the production build. No unresolved test failures remain. The build retains its existing large-chunk advisory.

Representative reviewed screenshots: `screenshots/WEB-058/mobile/{navigation,arena-detail,gazette,selected-update}.png`, `screenshots/WEB-058/desktop/profile-accomplishments.png`, and `screenshots/WEB-058/{desktop,mobile}/lab-100.png`. They use synthetic fixture avatars. The broad replay's privacy-masked screenshots and full observations are under `screenshots/WEB-058/qa014/`. Only the key captures from that replay are retained; superseded scout captures were removed. This is local mock verification, not production certification.

## Try it

Start `apps/web` with `VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev`. Choose Iraj. At 390×844, verify Settings/profile and Compete/Mayor/Shop are visible, and reopen the dashboard using its edge ribbon. Open Compete, select a challenge, and switch Current/Mine/Past without dismissing the terms. Click the Gazette sign. In `/lab`, use 10 and 100 neighbors and click the Gazette sign. Open a Mayor event row in the feed to see the selected update.

For the seeded feed-link and complete viewport checks, run `../../ops/remote_run.sh bunx playwright test --config tests/web058.config.ts web058.spec.ts` with runner 2 selected. The fixture is created only after verifying `api.mode === 'mock'`.

## Contract limitation

No contracts were edited. The current public API exposes active Mayor events, but no read endpoint for an event by ID or historical outbox message content. If an older event's feed payload contains only its ID/title, the UI can show only that saved summary and says so. Proposed follow-up: a member-scoped `GET /villages/{vid}/events/{event_id}` returning historical event body/terms; authorize message details separately for their recipient. This is not needed for navigation or active event details.
