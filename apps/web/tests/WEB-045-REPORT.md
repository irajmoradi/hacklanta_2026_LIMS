# WEB-045 report

Branch: `web/WEB-045`. Implementation milestone: `953ff63`; geometry/test milestone: `12b5fd3`. No push or merge.

Controlled avatars use a name-only pill above the projected bounds of their visible geometry (including replacement heads and accessories). The pill fades during movement and regains opacity on stop; exiting control restores the full tag. Label spacing cannot lower the owner tag over the body. Neighbor labels intersecting the protected body rectangle disappear and stop intercepting pointer input until clear.

The body receives an accent emissive glow and a light ground ring with a dark backing. Both become subtle when stopped; leaving control restores material emission and hides the ring. This intentionally uses existing body materials plus two small ring draws, with no postprocessing. Measurement and material discovery run at 10 Hz; no React state updates per animation frame. A hardware FPS benchmark was not performed.

Files: `src/scene/VillageScene.tsx`, `LabelSpacing.tsx`, `WalkingFocus.tsx`, `avatarFocusGeometry.ts`, `walkingFocus.test.ts`; `src/styles.css`; `tests/web045.config.ts`, `web045.spec.ts`, `web045Scene.ts`, and this report.

Verification uses the remote wrapper from `apps/web`, with mock data and no secrets or live API:

- `bash ../../ops/remote_run.sh bun run test`: exit 0, 179 tests passed.
- `bash ../../ops/remote_run.sh bun test src/scene/walkingFocus.test.ts`: exit 0, 2 tests passed. Initial attempt failed resolving similarly named component/helper files on Linux; helper renamed before successful rerun.
- `bash ../../ops/remote_run.sh bun run build`: exit 0, TypeScript build checking and Vite production build passed. Existing large-chunk warning.
- Standalone typecheck and one queued browser attempt were canceled while waiting for the shared browser lock (remote exit 143); these were not test failures. Build supplied TypeScript validation.

- `bash ../../ops/remote_run.sh bunx playwright test --config tests/web045.config.ts`: exit 0, 4/4 passed (day/night at 1280 and 390 px). Inspected all four initial screenshots: pill clears the body and the ground ring remains visible in both lighting conditions. Runner queue dominated the 1049.93-second wall time; tests took 2.1 minutes.
- `bash ../../ops/remote_run.sh bash -lc 'bun run typecheck && bunx playwright test --config tests/web045.config.ts'`: exit 0. Explicit typecheck passed; all 4 close-up cases passed in 2.2 minutes, including moving-at-capture, pointer suppression and original emission restoration. Total runner wall time was 1751.34 seconds, mostly shared-lock waiting. The final local test file SHA-256 matches the executed remote file.

Visually reviewed all four close-up screenshots: name-only pills sit clearly above the head; the body glow and dark-backed accent rings remain readable on roads in day/night scenes. Both 390 px screenshots use procedural avatars and buildings with every model request blocked. Existing 3D building occlusion remains intact; the highlight does not draw through buildings.

Screenshot paths: `apps/web/artifacts/web045/walking-day-1280.png`, `walking-night-1280.png`, `walking-day-390.png`, `walking-night-390.png`. Initial normal-zoom captures are preserved beside them with a `wide-` prefix.

Try it: run the web app with `VITE_MOCK=1 VITE_DEMO_AUTH=1`, select a fixture seat, zoom toward your avatar, and hold WASD/arrow keys. Check the compact faded tag, glowing body and two-tone ground ring. Release the key to restore tag opacity and soften the highlight; after the existing control timeout, the full activity tag returns. Shift+C toggles camera following without disabling the control treatment. Browser coverage includes day/night, 1280/390 px, shipped GLB and all-models-missing fallback.

Choices: compact tag stays while control remains active; only its fade restores immediately on stop. Measured projected geometry rather than a fixed world-space label height also handles camera tilt and varying head/accessory sizes. Glow rather than an extra hull pass keeps body draw calls unchanged. Screenshot output under `apps/web/artifacts/web045/` is explicitly requested by the task and remains an untracked generated artifact.

Contract changes: none. Blockers: none. All verification used mock mode. Generated screenshots remain untracked in the explicitly requested artifact directory; source, tests and this report are committed.
