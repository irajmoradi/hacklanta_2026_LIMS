# WEB-053 - Mayor over the live plaza

Branch: `web/WEB-053`. Implementation commit: `b3a52d1`. The following QA commit contains this report, browser coverage, and screenshots.

## Result and choices

- Kept WEB-042 portraits, six icon choices, dashboard, keyboard navigation, and readable type. The conversation uses an 80% cream surface with 20px backdrop blur; desktop portraits float over the town. At 390px the bottom sheet leaves the upper 30% of the viewport for the plaza.
- The app already supplied `cinematic="mayor"`; its opaque dialog concealed the camera. Preserved that integration and the existing saved-camera return path. Adjusted Mayor-only framing/zoom and moved the camera closer to avoid foreground buildings obscuring the plaza.
- Statue movement runs before camera tracking, sharing a 1.8-second cycle and about 4.4cm of world-space vertical travel. Reduced motion removes the bounce and fly-in, including when the preference changes while open.
- Removed retained opacity animation state so nested backdrop blur can sample the village. Darkened text on glass and hid the floating Community Hall shortcut during Mayor visits.
- All work and tests used mock data. No live village actions, paid generation, credentials, contracts, or other apps were changed.

## Changed files

- `apps/web/src/components/mayorScene.css`
- `apps/web/src/scene/MayorPlaza.tsx`
- `apps/web/src/scene/TownCamera.tsx`
- `apps/web/tests/web053.config.ts`, `web053.spec.ts`, `web053Scene.ts`
- This report and `apps/web/artifacts/web053/` screenshots/results.

## Verification

Commands run from `apps/web` through the remote runner:

- `bash ../../ops/remote_run.sh bun run typecheck` - exit 0.
- `bash ../../ops/remote_run.sh bun run test` - exit 0; 257 tests across 67 files.
- `bash ../../ops/remote_run.sh bunx playwright test --config tests/web053.config.ts` - exit 0; all 4 tests passed. Final result recorded in `../artifacts/web053/results.json` relative to this report's directory.

Browser coverage checks live-camera zoom and on-screen Mayor framing, matching camera/statue bob, exact camera position/target/zoom restoration, dynamic reduced motion, dashboard overflow and WCAG A/AA axe checks at 1440/1280/390, every choice and Back, missing-model fallbacks, and check-in regression. Browser QA uses the existing low-quality rendering option for the runner's software GPU. Early iterations caught sampling/timing/float-precision issues in the test and framing/blur issues during visual review; one interrupted run also required stopping its orphaned QA Vite server before the final successful run; the final harness samples rendered frames and captures the pre-visit camera at the actual opening click.

## Screenshots and trying it

Screenshots: `apps/web/artifacts/web053/mayor-{1440,1280,390}.png`, `dashboard-{1440,1280,390}.png`, `reduced-{1440,1280,390}.png`, and `fixture-no-models.png`.

Start the web app in mock mode (`VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev`), choose a demo seat, and open Mayor. Visit the village dashboard with option 2, use Back/Esc to return to choices, then Esc/Close to return to the previous town view. Resize to 390px and toggle the OS/browser reduced-motion setting. The automated command above provides the same checks with mock environment configured for you.

Blockers: none. Proposed contract changes: none.
