# WEB-052 ? Dashboard declutter

Branch: `web/WEB-052`. Implementation milestone: `a78d35f`; final verification commit follows this report.

## Changes and choices

- Friends now shares a right-aligned, 8 px spaced stack with Community Hall. Hall retains its 172 px bottom anchor. B and native keyboard button activation remain available.
- Accomplishments and Reading list remain on the dashboard. Removed Mayor/Gazette IDs are discarded by the existing saved-preference reader.
- Village opens the existing growth panel with a Gazette section, headline, and explicit reader button. The existing Gazette reader retains archives and profile links.
- Mayor ? What's new? shows the former dashboard event/feed history, including the latest event's title. History is independent of Gazette loading or failure; the existing visibility filters still exclude QA/debug/internal noise.
- The 390 px dashboard reserves room for the social stack. No API or contract changes.

## Files

`apps/web/src/App.tsx`, `apps/web/src/styles.css`; components `Dashboard.tsx`, `CinematicScene.tsx`, `MayorScene.tsx`, `MayorUpdates.tsx`, `VillagePanel.tsx`.

Tests: `MayorScene.test.tsx`, `fix020.spec.ts`, `integ013.spec.ts`, `web012.spec.ts`, `web031.spec.ts`, `web035.spec.ts`, `web037.spec.ts`, new `web052.config.ts` / `web052.spec.ts`, and this report.

## Verification

Commands run from `apps/web` through Git Bash and the remote wrapper:

- `bash ../../ops/remote_run.sh bun run typecheck` ? exit 0.
- `bash ../../ops/remote_run.sh bun run test` ? exit 0; 255 tests passed.
- `bash ../../ops/remote_run.sh bash -lc 'bun run typecheck && bun run test'` ? exit 0; final typecheck and 256 unit tests passed, including new Mayor history filtering coverage.
- `bash ../../ops/remote_run.sh bunx playwright test --config tests/web052.config.ts` ? final exit 0; 2 tests passed at 1440 and 390 px. Checks cover legacy preferences, stack alignment/non-overlap, Enter/B access, Gazette archive, Mayor history and keyboard return, and horizontal overflow. Generated screenshots were visually inspected.
- `git diff --check` ? exit 0.

Initial focused browser runs exited 1 because the test pressed B while focus was on a button; global shortcuts deliberately ignore focused controls. The test now blurs the button before testing B. Screenshot review also caught the mobile dashboard covering the stack; reserved vertical space fixes it. One repeated initial run used the prior test snapshot after a local edit command used the wrong working directory.

All browser runs use mock mode and a disabled API URL. No secrets or paid generation were needed, no live demo actions occurred, and no Solana transactions were sent. Historical specs had affected selectors/counts updated; only the focused WEB-052 browser spec was run.

## Try it

Start the web app in mock mode, choose a demo seat, and dismiss the first-visit guide. Friends is above Community Hall at bottom right; B opens it when focus is outside a control. Open Village in the dock and choose Read the Village Gazette. Open Mayor and choose What's new? (or press 1). Repeat at 390 px.

Screenshots are generated, uncommitted artifacts in `apps/web/artifacts/web052/`: `dashboard-1440.png`, `dashboard-390.png`, `gazette-1440.png`, `gazette-390.png`, `mayor-1440.png`, `mayor-390.png`.

Blockers: none. Proposed contract changes: none.
