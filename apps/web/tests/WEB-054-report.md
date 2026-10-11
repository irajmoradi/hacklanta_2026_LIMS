WEB-054 completed on branch web/WEB-054.

Implementation commit: 51c789c (feat(web): make village activity readable and navigable).
The subsequent QA commit contains this report, the browser suite, and its reviewed screenshots.

Changed source files:
- apps/web/src/components/activityData.ts: title/subtitle mapping and structured navigation targets, with safe fallbacks for missing IDs and unknown event types.
- apps/web/src/components/ActivityFeed.tsx: accessible navigation buttons, chevrons, per-event links inside groups, retained evidence/reactions, shared navigation for profile feeds, competition titles and check-in evidence hydration.
- apps/web/src/components/ActivityFeed.css: wrapping titles, ellipsized subtitles with full tooltips, hover/focus affordances and destination highlighting.
- apps/web/src/components/Dashboard.tsx: closes the expanded feed when navigating; keeps dashboard Accomplishments available.
- apps/web/src/App.tsx: opens the relevant destination, resolves competition/entry and archived reading IDs, selects profile Activity/check-in and goal records, and plays existing authenticated recordings without generation.
- apps/web/src/components/activityFeed.test.ts: all known event families, title/detail separation, grouping, deep-link IDs and fallback tests.

QA files: tests/web054.config.ts, tests/web054.spec.ts, tests/artifacts/web054/.gitignore, this report, and six PNGs below. All changes stay within WEB-054 allowed_paths.

Verification (run from apps/web through the remote wrapper):
- ../../ops/remote_run.sh bun run test -- exit 0; 261 passed, 0 failed across 67 files.
- ../../ops/remote_run.sh bun run build -- final exit 0; TypeScript and Vite production build pass. Vite reports its existing large-chunk warning.
- ../../ops/remote_run.sh bunx playwright test --config tests/web054.config.ts -- final exit 0; 3 tests passed. Covers 1440x900 and 390x900 viewports, keyboard Enter activation, untruncated titles, ellipsis/tooltips, evidence photos, exact Colosseum entry selection, archived reading item, existing audio playback, grouped purchases, goal navigation and profile fallback.
- git diff --check -- exit 0.

Earlier verification exposed TypeScript narrowing/required-prop errors, an empty competition fixture, an overbroad leaderboard selector, and an unnecessary disabled Load more click in the test. These were fixed before the successful runs.

Mock-only browser configuration sets VILLAGE_ENV_FILE to /dev/null (NUL on Windows) and an unreachable API URL. Test fixtures replace the browser's in-memory mock methods; no live village, paid generation, Solana transactions, or real photos/voices are involved. Model asset requests are blocked to exercise the offline fixture path. Runtime traces are ignored, not committed.

Reviewed screenshot paths:
- apps/web/tests/artifacts/web054/feed-1440.png
- apps/web/tests/artifacts/web054/feed-390.png
- apps/web/tests/artifacts/web054/checkin-1440.png
- apps/web/tests/artifacts/web054/checkin-390.png
- apps/web/tests/artifacts/web054/entry-1440.png
- apps/web/tests/artifacts/web054/entry-390.png

Try it: run the Playwright command above for the repeatable synthetic scenarios. For manual use, start apps/web with VITE_MOCK=1 and bun run dev, open Around the village, and activate a row with a click or Enter. Pop out the feed and expand grouped events to open their individual destinations. Accomplishments remains available from the dashboard/profile.

Choices and limits: existing ProfilePanel, CompetitionsPanel and ReadingList files are outside allowed_paths and have no target-ID props. App uses a scoped, cancellable navigation adapter over their existing navigation controls, resolving IDs through read-only API calls. It does not click mutation controls. This adapter will need updating if those panels' DOM structures change; explicit target-ID props would be the preferable follow-up when their files are in scope. Missing/deleted details and unavailable recordings provide a profile fallback. Historical goal records are resolved from the profile's available goal history. Competition labels use the existing list API rather than requiring feed-contract changes.

Blockers: none. Proposed HTTP/DB contract changes: none.
