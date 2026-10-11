# WEB-040 - committed check-in dialogue

Branch: `web/WEB-040`. Implementation milestone: `217a631`; frame/style refinement: `825037c`.

The cinematic now treats Daily note, Goal progress and Add proof as committed
branches. The outgoing choices become noninteractive immediately and leave in
80 ms. The selected branch becomes a heading; `choose again` is the only route
back to the initial choices. Goal setup / Go beyond still opens the existing
goal flow. Unavailable progress and empty-note submission explain why.

Check-in has a teal letterbox, the player's existing portrait (including its
asset-free fallback), a typed dialogue prompt, reward tokens, a polaroid-style
attachment with preview, and a saved stamp. The Mayor retains its existing
choices, content and Back action. Reduced motion removes the new animations.

Files:
- `src/components/CinematicScene.tsx`: committed scene navigation, portrait,
  outgoing choice animation, success stamp and focus wrapping.
- `src/components/CheckInDialogue.tsx`: dedicated branch form; original payload,
  evidence upload, retry key, stretch tier and reward behavior retained. Camera
  capture explicitly escapes the embedded-dialog context so its portal stays
  a keyboard-accessible modal.
- `src/components/cinematicScene.css`: check-in-only styles and responsive layout.
- `tests/feat016.spec.ts`: assertions updated for committed branch navigation.
- `tests/web040.config.ts`: isolated mock-only server, with environment loading
  disabled and no live API dependency.
- `tests/web040Scene.ts`: lower canvas raster resolution for the software GPU;
  the real scene continues rendering and HTML remains full resolution.
- `tests/web040.spec.ts`: desktop/mobile branch commitment, focus/Tab/Escape,
  camera modal, photo validation, reduced motion, axe accessibility, saved stamp,
  and idempotent retry with one evidence upload.

Choices made: the cinematic gets a dedicated form because `Modals.tsx` is outside
allowed paths. The standalone modal is unchanged. Choosing again starts a fresh
branch, matching the prior scene's remount behavior. No new image generation or
paid jobs are required; no secrets or live-village mutations were used.

Validation (from `apps/web`, through Git Bash on Windows):
- `../../ops/remote_run.sh bun run typecheck`: exit 0. The focused browser
  server also reran typecheck successfully on the final focus-wrap revision.
- `../../ops/remote_run.sh bun run test`: exit 0; 179 passed, 0 failed across
  45 files. Repeated after the focus fix with the same passing result.
- `../../ops/remote_run.sh bunx playwright test --config tests/web040.config.ts`:
  focused run exited 1: retry/upload reuse and stretch/Go beyond/Mayor navigation
  passed; both viewport tests exposed Tab escaping to browser chrome. Both axe
  scans passed. Added explicit check-in-only Tab/Shift+Tab wrapping.
- `../../ops/remote_run.sh bunx playwright test --config tests/web040.config.ts --grep committed`:
  exit 0; desktop 1280 px and mobile 390 px passed after the fix (2.7 minutes
  execution, 1799.63 seconds including the runner queue). Covers committed
  branches, focus wrapping/restoration, nested camera Escape, photo validation,
  upload/save, reward stamp, reduced motion, overflow and zero axe violations.
- `git diff --check`: exit 0.

All four focused scenarios passed across the two completed browser runs; the
last rerun targeted the two scenarios affected by the focus change. Original
focused results are retained at `artifacts/web040/initial-focused.json`.

Earlier attempts: the initial typecheck caught a mismatched JSX closing tag
(remote exit 2, Windows wrapper exit 1), corrected before the passing checks.
Two broad browser attempts hit the wrapper's 30-minute limit (remote exit 124,
Windows wrapper exit 1), largely in the shared queue. The second passed the
legacy offline-assets/inactive-goal and mobile keyboard tests; legacy daily
cheer, six-choice Mayor and full FEAT-018 tests timed out. The latter two reached
their final Rumours and completed-stretch activity states, but are not claimed
as passes. A subsequent attempt exited 1 because the timed-out run left this
worktree's Vite server on port 5340. Its exact PID and working directory were
verified before stopping it; no other worktree processes were touched.

The focused browser config blocks external Google font requests and lowers only
the test canvas raster resolution to reduce CI rendering cost. The actual town
continues rendering and HTML stays at full resolution. Production rendering,
fonts, rewards, API contracts and toasts are unchanged.

Screenshot review: inspected the final desktop note, mobile proof form and
mobile saved stamp. The letterbox and portrait are visible, controls and text
are legible, and both viewport tests confirm no horizontal overflow. Early
captures revealed the shared header covering the letterbox and a form caught
mid-animation; scoped header styles and settled-state capture fixed those.
Screenshots (relative to `apps/web`):
- `artifacts/web040/choices-1280.png`, `choices-390.png`
- `artifacts/web040/note-1280.png`, `note-390.png`
- `artifacts/web040/proof-1280.png`, `proof-390.png`
- `artifacts/web040/shared-1280.png`, `shared-390.png`

Generated screenshots and test results remain local artifacts, not source
commits. Earlier FEAT-016/FEAT-018 screenshot changes were restored.

Try it: launch the web app in mock mode (`VITE_MOCK=1 VITE_DEMO_AUTH=1`), choose a
demo seat, then Check in. Choose Daily note or Goal progress: the other choices
leave and only choose again returns to them. Write a note, optionally attach a
photo, and Share check-in. Complete a weekly goal and Go beyond to exercise the
existing stretch journey. Repeat at 390 px and with reduced motion enabled.

Blockers: none remaining. Shared runner contention and the earlier legacy-suite
timeouts are documented above. Proposed contract changes: none.
