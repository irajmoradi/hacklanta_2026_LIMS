# WEB-055 ? Judge Demo Lab

Branch: `web/WEB-055`.
Implementation commits: `e8f1be9` (shared registry), `992d69e` (sandbox and scenes).
The following validation commit contains this report, browser tests and reviewed screenshots.

## Delivered

- `/lab` and `/lab/` open a lazy-loaded shell without mounting authentication, the main app, reconnection UI or live-room effects. The existing debug menu contains the only normal-app link.
- Five registry entries with judge-friendly captions. `onboarding` and `pipeline` deliberately retain Coming soon modules for WEB-056; that worker replaces only its load functions in `scenes.ts`.
- Independent `LabSandbox` instances, cloned snapshots and a read-only mock request interface. Simulation methods change memory only; no HTTP fallback, storage persistence, generated faces, API writes or live sockets.
- Real VillageScene/GridTown with 10/25/50/100 synthetic neighbors, varied preset clothing colors and existing activity/navigation AI. Large towns retain the existing crowd budget, use merged distant cottages, show nameplates on interaction, and frame the expanded town. FPS comes from rendered frames.
- Scorch, outbreak, blackout and blight update the real disaster fields, close the relevant buildings and activate existing visual effects. Four simulated batches meet the 12-check-in/5-person repair goal; Repair uses the existing reveal and celebration. Clear resets the world.
- Futures reads all six levels and XP thresholds directly from the shared catalog. Each forward step announces newly unlocked buildings through the existing Celebration. Autoplay advances every 4.5 seconds, pauses, stops at maximum, and restarts from level 1 when replayed.
- Desktop rail and horizontal mobile scene navigation. Lab-only root scrolling overrides the main app's intentionally fixed viewport, keeping mobile controls and footer reachable.

## Changed files

`apps/web/src/main.tsx`; `apps/web/src/components/DemoTools.tsx`;
`apps/web/src/scene/VillageScene.tsx`; `apps/web/src/scene/TownCamera.tsx`; `apps/web/src/scene/DisasterEffects.tsx`;
`apps/web/src/lab/{scenes.ts,ComingSoon.tsx,Lab.tsx,WorldDemo.tsx,BigTown.tsx,Disasters.tsx,Futures.tsx,sandbox.ts,sandbox.test.ts,lab.css,REPORT.md}`;
`apps/web/tests/{lab.config.ts,lab.spec.ts}`; screenshot ignore rule and `tests/screenshots/WEB-055/` QA images.

## Validation

All commands run from `apps/web` through Git Bash and the configured remote runner, with no secret environment variables forwarded and no live API target.

| Command | Result |
| --- | --- |
| `bash ../../ops/remote_run.sh bun run test` | Exit 0; 264 tests across 67 files passed. |
| `bash ../../ops/remote_run.sh bun test src/lab/sandbox.test.ts` | Exit 0; 2 tests, 454 assertions passed. |
| `bash ../../ops/remote_run.sh bun test src/scene/disasterVisuals.test.ts src/lab/sandbox.test.ts` | Exit 0; 6 tests, 9,054 assertions passed after the final VFX cleanup. |
| `bash ../../ops/remote_run.sh bun run build` | Exit 0; TypeScript and Vite production build passed. Lab shell, CSS and scenes appear as lazy chunks. Existing large-chunk advisory remains. |
| `bash ../../ops/remote_run.sh bunx playwright test --config tests/lab.config.ts` | Exit 0; desktop 1440?1000, mobile 390?844 and unavailable-model fixtures passed (3 tests). |

The browser suite checks all four disaster/repair cycles, bounded contribution progress, every catalog level, unlock notification, autoplay/pause, both placeholders, reload reset, mobile control bounds and scroll access, and fallback geometry. It records zero API requests, write requests or non-HMR WebSockets in the full desktop rehearsal. No live server is used.

Reviewed screenshots are committed in `apps/web/tests/screenshots/WEB-055/`: `town-100.png`, four `disaster-*.png`, `futures-level-1.png`, `futures-level-6.png`, `Meet-your-village.png`, `Avatar-studio.png`, `mobile-disaster.png`, and `fallback-no-models.png`. Raw Playwright traces/results remain ignored in `tests/screenshots/lab-results/`.

Earlier iteration failures were corrected: test-only TypeScript fetch typing; an occupied runner port (Lab now owns 5255); a premature DOM-label assertion in a large scene. Visual inspection additionally caught mobile clipping that a document-width assertion alone had missed; the final test also checks the controls' right edge and scrolls the footer into view.

## Try it

Start the web app normally (`bun run dev` from `apps/web`) and open `/lab`, or choose **Demo Lab** in the debug menu. It is safe even when the normal app is configured for a live API: the Lab never initializes that session. Choose 100 neighbors, pan/zoom or select a resident, then visit Disasters. Pick a kind, click **Simulate check-ins +3** four times, and **Repair**. In Futures, use the stepper, slider or Autoplay. Reload resets the active scene; switching scenes also starts a fresh local rehearsal. **Back to the village** returns to `/`.

## Assumptions and limits

- Scene switching resets each scene as well as browser reload, keeping judge rehearsals repeatable.
- Repair requires the simulated contribution targets. No real users, XP or repair events are touched.
- WEB-056 owns onboarding/pipeline content; their placeholders are intentional integration points, not missing WEB-055 scenes.
- The runner uses Chromium SwiftShader (software rendering). The reviewed 100-person screenshot measured 4 FPS there, versus similarly low small-town rendering. This is not a laptop GPU benchmark: approximately 60 FPS on the demo laptop remains unverified. Existing crowd LOD, instanced town decoration, automatic quality reduction and the added cottage/label LOD are active.
- No contract changes proposed. No secrets read or copied, no live demo actions, no transactions, no push or merge.
