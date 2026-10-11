# FIX-010 - A real wave and more emotes

Branch: `fix/FIX-010`. Implementation milestone: `1d3fc24`; final QA commit is the commit containing this report.

Implemented Space / 1 = wave, 2 = cheer with both arms raised and a hop, 3 = dance spin, and an accessible touch emote button below the camera controls. Each lasts 1.4 seconds. Movement cancels emotes; typing, dialogs, modifier shortcuts, and dragging retain their control guards. Remote villagers retain their own idle/movement state.

The shipped GLB has Arm_L / Arm_R, rotated 180 degrees in bind space, but no elbow or hand joints. The old code overwrote that bind rotation. The implementation adds private runtime Elbow_L/R and Hand_L/R joints, transfers distal arm skin influences to the elbows, and layers relative rotations over the mixer. Wave uses a 150-degree shoulder raise, approximately 30-degree elbow bend, three eased forearm sweeps, body lean, head tilt, and smooth return. Visual QA corrected the rotation sign so the hand stays outside the face. The hand is above the Head attachment joint; this short-armed, large-headed character's hand sits beside the temple, not above the hair silhouette.

Clothing reuses the same elbow joints and authored inverse binds, including every catalog torso GLB. FIX-008 attachment fitting is retained. Generated heads follow the existing Head joint. Cached model geometry and other villagers are not mutated. Runtime geometry/skeleton allocations are disposed on teardown. Offline procedural villagers also wave, cheer and spin without generated assets or the GPU worker.

## Files changed

- `src/scene/emotes.ts`, `emotes.test.ts`: timeline, rig articulation, pose application and actual-GLB tests.
- `src/scene/OptionalModel.tsx`, `cosmeticAssets.ts`: mixer layering, sleeve skin binding, disposal.
- `src/scene/playerControl.ts`, `usePlayerController.ts`, `VillageScene.tsx`: owned-player state, keys, fallback poses and hint.
- `src/scene/EmoteWheel.tsx`, `emotes.css`: touch menu.
- `package.json`: include emote unit tests in the normal test command.
- `playwright.fix010.config.ts`, `tests/fix010.spec.ts`, `tests/fix010Scene.ts`: actual live-scene keyboard, bone-position, touch, modal/input, remote ownership and offline browser tests.
- `artifacts/fix010/wave.png`, `artifacts/fix010/emotes.webm`, `artifacts/fix010/video-check.png`, and this report.

All paths above are relative to `apps/web`; no changes outside allowed paths.

## Validation

Commands run from `apps/web` unless otherwise stated:

- `bun install --frozen-lockfile`: exit 0.
- `bun test src/scene/emotes.test.ts src/scene/playerControl.test.ts src/scene/cosmeticAssets.test.ts src/scene/generatedHead.test.ts`: exit 0, 26 tests passed.
- `bun run test --timeout 20000`: exit 0, 129 tests passed across 33 files. The original default-timeout run exited 1 with one unrelated paddock test exceeding 5 seconds; the longer-timeout full run passes.
- `bun run build`: exit 0. Vite reports its existing large-chunk advisory.
- `bunx playwright test --config playwright.fix010.config.ts`: exit 0, 2 tests passed. Space is pressed in the real app and the actual Hand_R world Y is asserted above Head at mid-wave. The emote clock is briefly frozen for deterministic pose assertions, then restored for the recording.
- `git diff --check` at repository root: exit 0.
- Playwright-bundled `ffmpeg-win64.exe -y -ss 12 -i apps/web/artifacts/fix010/emotes.webm -frames:v 1 apps/web/artifacts/fix010/video-check.png` at repository root: exit 0; decoded and inspected a frame from the finalized 21.08-second recording. The bundled FFmpeg lacks the null muxer, so an earlier `-f null -` verification exited 1; image extraction succeeded.

Initial TypeScript test errors and the touch menu overlapping the neighbor strip were corrected and rerun successfully. Geometry-only unit loading skips textures. A first full test process was stopped while diagnosing browser-image loading in Bun. An initial test command from the repository root matched no files (exit 1); the corrected commands above ran from `apps/web`.

Generated-head testing uses synthetic geometry through the production head attachment path; no real photos, voices or paid generation were used. No secrets were needed. Visual evidence stages the live avatar by hiding surrounding town meshes in the test helper, preventing buildings from occluding the wave. Production scene visibility is unchanged. The screenshot was inspected after capture.

## Try it

From `apps/web`, run in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev
```

Choose a demo seat, close dialogs, move with WASD, then press Space or 1, 2, and 3. Tap the smile button near the top-right camera controls for touch emotes. Run the dedicated Playwright command above to recreate the screenshot and short WebM without API credentials.

Blockers: none. Proposed contract changes: none. Assumptions: emotes are local player controls, not new multiplayer network events; torso accessories with no sleeves remain attached to the spine. No binary asset regeneration was needed.
