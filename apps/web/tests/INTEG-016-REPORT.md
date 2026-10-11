# INTEG-016 verification

Branch: `integ/INTEG-016`.

Milestones: `2e8b889` is the requested no-fast-forward merge of `web/WEB-044` (parents `d369625` and `1c03883`); `1d29dc6` adds close framing and mock integration coverage.

## Result

The merge preserves tree/detail batching, CrowdDetail, dense labels, walking focus and avatar-overlap measurements, Community Hall actions, and Library/onReading actions. It brings across location click/context/presence, the plaza hit plane, camera return behavior, and capacity-limited cafe/study/bench seating with articulated knees and hip-height placement.

Close-ups now frame seven rendered world units in the usable screen area. At 1280x844 zoom rises from 60.29 to 100.57; at 390x844 it rises from 30 to 52.29. The target shifts left of the desktop people card or above the mobile card. Present villagers receive explicit full-detail priority in crowded towns; distant villagers retain the crowd budget. DPR 2 is retained throughout close-up. GLB and generated-head loaders already use original texture images without downsampling, and their existing GLB/card/preset fallback order is preserved.

## Validation

All execution is remote through `ops/remote_run.sh`, from `apps/web`. All browser coverage uses `VITE_MOCK=1`, `VITE_DEMO_AUTH=1`, `/dev/null` as the environment file, and an unreachable loopback API target. No live village or paid model calls are used.

- `../../ops/remote_run.sh bun test src`: exit 0; 227 passed, 0 failed across all 59 source test files (including tests omitted by the older package test script).
- `../../ops/remote_run.sh bun run build`: exit 0; TypeScript and Vite production bundle succeeded. Existing >500 kB chunk warning remains.
- `../../ops/remote_run.sh bash -lc 'bun run typecheck && bunx playwright test --config tests/integ016.config.ts'`: `tsc --noEmit` exit 0; six browser cases passed (all five non-baseline WEB-044 cases and the FEAT-019 mock case), two intentional skips. The wrapper reached its 30-minute queue-plus-execution limit before any WEB-045 case completed: exit 124, 1803.55 seconds including artifact retrieval. No assertion failures occurred in the completed cases.
- `../../ops/remote_run.sh bunx playwright test --config tests/web045.config.ts`: exit 1; desktop day/night passed, mobile day/night failed at the synthetic neighbor overlap assertion. The test changed the rectangle of an NPC label without accounting for TownLabel culling that off-screen label. Its probe now clones a neighbor into the visible overlay host and reads live avatar bounds; a full-height measurement forces genuine suppression instead of allowing vertical displacement. Production walking/overlap code is unchanged.
- `../../ops/remote_run.sh bash -lc 'bun run typecheck && bunx playwright test --config tests/web045.config.ts'`: exit 0; typecheck passed and all four walking cases passed (desktop/mobile, day/night). Browser execution 1.8 minutes; total remote wall time 390.31 seconds including queue/sync.
- The initial standalone `../../ops/remote_run.sh bun run typecheck` was canceled while queued on the shared browser lock (remote exit 143, wrapper exit 1), before compilation. The final run checks the current snapshot instead.

The original FEAT-019 server test requires database seeding, authorization checks and live synchronization. INTEG-016 explicitly requires mock-only execution, so it is skipped by `tests/integ016.config.ts`; a new test in the same spec exercises the real Hall UI in offline mode, decoration on both floors, mobile layout and return to the village. Server synchronization is not validated by this task. WEB-044's optional historical pre-seating baseline capture is also skipped unless its source generator has been run; its existing capture is preserved.

The final test-only change is covered by the last typecheck. Production code is unchanged since the successful unit suite and production build. `git diff --check` also passed (exit 0).

## Screenshots

Before: `artifacts/integ016/closeup-before-1280.png` and `closeup-before-390.png`, copied unchanged from the merged WEB-044 branch's close-up captures. These document the original zoom, not the older pre-seating baseline.

After: `artifacts/integ016/closeup-after-1280.png` and `closeup-after-390.png`. Both visually inspected: the cafe and seated guests are substantially larger, clear of the desktop card and above the mobile card. Native touch, six seated visitors, profile selection, DPR 2, zoom >95 on desktop, and camera restoration all passed.

`artifacts/integ016/hall-desktop.png` and `hall-mobile.png` were also visually inspected; both-floor decoration and responsive room controls remain usable. Updated `artifacts/web044/cafe-after.png` and `cafe-fallback.png` capture the merged scene and no-model fallback.

The four `artifacts/web045/walking-{day,night}-{1280,390}.png` screenshots were visually inspected: the focus ring/glow and label clearance remain visible, including the mobile model-fallback path.

## Try it

From `apps/web`, run `VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev`. Double-click/double-tap a cafe, building, house or plaza. The location fills the available screen area and the people card shows nearby villagers. Select a visitor, press Escape or Back to town, and confirm restoration. Single-click Library to open the reading list; single-click Enter Community Hall to enter the Hall. Walk with WASD to check focus/label behavior, and drag your avatar onto available cafe/study/reading seats.

For deterministic six-guest seating and close-up reproduction, open `/tests/web044.html`; append `?crowded` for a 32-person town. The test fixture uses only shipped assets and synthetic fixture identities.

## Scope and limitations

All changes are under `apps/web`. No API or contract edits; no proposed contract changes. The mock-only limitation above is deliberate. No remaining blockers. All ten applicable browser cases passed across the completed runs; the two exclusions are documented above.

## Files changed

- `apps/web/artifacts/integ016/closeup-before-1280.png`
- `apps/web/artifacts/integ016/closeup-before-390.png`
- `apps/web/artifacts/web044/cafe-after.png`
- `apps/web/artifacts/web044/cafe-before.png`
- `apps/web/artifacts/web044/cafe-fallback.png`
- `apps/web/artifacts/web044/closeup-1280.png`
- `apps/web/artifacts/web044/closeup-390.png`
- `apps/web/src/App.tsx`
- `apps/web/src/components/LocationCloseup.tsx`
- `apps/web/src/components/locationCloseup.css`
- `apps/web/src/scene/GridTown.tsx`
- `apps/web/src/scene/LocationPresence.tsx`
- `apps/web/src/scene/MayorPlaza.tsx`
- `apps/web/src/scene/OptionalModel.tsx`
- `apps/web/src/scene/TownCamera.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/layout/benchSeats.ts`
- `apps/web/src/scene/layout/cafeSeats.ts`
- `apps/web/src/scene/layout/navigation.ts`
- `apps/web/src/scene/layout/studySeats.ts`
- `apps/web/src/scene/layout/town.ts`
- `apps/web/src/scene/locationCloseup.ts`
- `apps/web/src/scene/locationFraming.test.ts`
- `apps/web/src/scene/locationFraming.ts`
- `apps/web/src/scene/seatedPose.test.ts`
- `apps/web/src/scene/seatedPose.ts`
- `apps/web/tests/WEB-044-REPORT.md`
- `apps/web/tests/feat019.spec.ts`
- `apps/web/tests/integ016.config.ts`
- `apps/web/tests/web044-baseline.py`
- `apps/web/tests/web044.config.ts`
- `apps/web/tests/web044.html`
- `apps/web/tests/web044.spec.ts`
- `apps/web/tests/web044.tsx`
- `apps/web/tests/web044Scene.ts`
- `apps/web/tests/INTEG-016-REPORT.md` (this report)
- `apps/web/artifacts/integ016/.gitignore`
- `apps/web/artifacts/integ016/closeup-after-1280.png`
- `apps/web/artifacts/integ016/closeup-after-390.png`
- `apps/web/artifacts/integ016/hall-desktop.png`
- `apps/web/artifacts/integ016/hall-mobile.png`
- `apps/web/tests/web045.spec.ts`
- `apps/web/artifacts/web045/.gitignore`
- `apps/web/artifacts/web045/walking-day-1280.png`
- `apps/web/artifacts/web045/walking-night-1280.png`
- `apps/web/artifacts/web045/walking-day-390.png`
- `apps/web/artifacts/web045/walking-night-390.png`
