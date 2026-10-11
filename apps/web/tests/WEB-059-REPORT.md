# WEB-059 delivery report

Branch: `web/WEB-059`. Implementation milestone: `6afebfc`. Verification milestone is the commit containing this report (see `git log -2 --oneline`).

## Changes

- QA15-01: static attraction labels now use a transformable display box, so the existing collision pass can actually move Study Spot and Fitness Corner. Public labels and the Gazette hit target are checked at 100 neighbors on desktop and 390 px mobile.
- QA15-02: the dashboard header has a Gazette button. Opening it collapses the dashboard and clears its popout; after closing the paper, the plaza Gazette sign is tappable again.
- QA15-03: selected activity uses the roster name; notification-only fallback parsing also recognizes the Mayor-text action instead of repeating the sentence as a name.
- QA15-04: Gazette display repairs sentence casing and known roster names. Future published editions receive roster-aware normalization. Reads still normalize historical sentence casing without updating stored issues or calling a model. Lowercase roster names use initial capitals; intentionally mixed casing is preserved. Links, contacts, decimals, metadata and source IDs remain intact.
- QA15-05: the head-stage grid allows its child to shrink, and fallback notices wrap within the panel. Rotation instructions appear only when a real rendered head is ready.
- Fixed existing DOM typing errors in the QA-014/015 audit harnesses that prevented the requested TypeScript build. The production audit's URL and safety guards remain unchanged; this task uses a separate local mock configuration.

## Files changed

Application:
`apps/api/app/newspaper.py`;
`apps/web/src/App.tsx`, `styles.css`, `api/gazetteCopy.ts`,
`components/ActivityUpdate.tsx`, `components/Dashboard.tsx`, `components/Dashboard.css`,
`components/Gazette.tsx`, `components/activityData.ts`,
`lab/pipeline/CachedHead.tsx`, `lab/pipeline/PipelineDemo.tsx`, `lab/pipeline/demo.css`.

Tests and evidence configuration:
`apps/api/tests/test_web058_newspaper.py`;
`apps/web/src/api/gazette.test.ts`, `apps/web/src/components/activityFeed.test.ts`;
`apps/web/tests/web058.test.ts`, `qa015-mock.config.ts`, `qa015-mock.spec.ts`,
`qa014.spec.ts`, `qa015.spec.ts`, `screenshots/.gitignore`, `artifacts/.gitignore`, and this report.

## Verification

All heavy commands use `RUNNER_IP=<runner-2-ip>` and the remote wrapper. No secrets, paid generation, live API mutations, or transactions were needed.

From `apps/web`:

- `../../ops/remote_run.sh bun run test`: exit 0, 266 passed.
- `../../ops/remote_run.sh bun test tests/web058.test.ts`: exit 0, 7 passed, including the selected-notification title regression.
- `../../ops/remote_run.sh bun run build`: initial exit 1 on existing QA harness DOM types; corrected and rerun successfully, exit 0. Vite reports its existing large-chunk warning.
- `../../ops/remote_run.sh bunx playwright test --config tests/qa015-mock.config.ts`: initial exit 1, 5 passed and the mobile notice bounds test failed. The grid sizing repair addresses that failure. Final full rerun: exit 0, all 6 desktop/mobile checks passed (2.7 minutes).
- `../../ops/remote_run.sh bunx playwright test --config tests/qa015-mock.config.ts --grep QA15-05`: exit 0, both desktop/mobile fallback checks passed after the repair.

From `apps/api`:

- `../../ops/remote_run.sh python -m uv run pytest -q tests/test_web058_newspaper.py`: exit 0, 5 passed.

From the worktree root: `git diff --check`: exit 0.

## Evidence and teammate steps

Local, gitignored screenshots: `apps/web/tests/screenshots/WEB-059/{desktop,mobile}/{town-100,gazette,head-fallback}.png`. Mobile town, Gazette and fallback screenshots were visually inspected. The software-renderer FPS shown in Lab is not a hardware performance measurement.

Run the mock Playwright command above to reproduce. For manual review, start web with `VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev`, choose a demo seat, and use a 390 x 844 viewport:

1. Expand the dashboard, choose Gazette, close the paper, then tap the plaza sign.
2. Open `/lab`, choose Big town and 100 neighbors; Study Spot and Fitness Corner should be distinct.
3. Choose Avatar studio and Next four times; read the entire illustrated-head notice.
4. Unit tests cover the saved Mayor-text title and legacy Gazette prose without requiring seeded production data or regeneration.

No blockers or proposed contract changes. No deployment, push, or merge performed.
