# WEB-044 verification

Branch: `web/WEB-044`. Implementation milestones: `b016e4a`, `6e55824`, `970d6a2`.

## Behavior

- Cafe, study and reading seats use shared furniture coordinates and surface heights. Tests compare cafe/study anchors directly with shipped GLB nodes.
- Private preset skeletons gain articulated knees and leg geometry with a knee ring. Sitting puts thighs forward and shins down; leaving restores the mixer pose. Procedural fallback legs also have knees. Bodies use uniform scaling and place the pelvis on the seat surface instead of flattening vertically.
- Sorted, capacity-limited assignments handle sparse and reordered membership without modulo collisions. A manually occupied chair stays reserved through schedule changes. Full venues send excess scheduled guests home and suppress unavailable drop targets.
- Reading previously targeted an entrance without a bench in the active grid. Three reading benches now share rendered anchors with routing. The common pose also handles the Ferris-wheel cabin surface. This branch has no other seated interior idle actors.
- Double-click or double-tap a building, house, cafe patio or plaza/label for a 450 ms camera flight. Reduced motion cuts directly. Esc, background click and Back to town restore the saved position, target and zoom. Reset and cinematic handoff remain usable.
- HTML labels stop propagation so Canvas background clicks cannot immediately dismiss the requested close-up. Native double-click detail is honored even when input dispatch is slow.
- Pointer single-click location actions wait 350 ms to distinguish double-clicks; keyboard activation stays immediate. Profile clicks remain immediate.
- Close-up uses DPR 2 and bypasses the automatic DPR reduction. This source already renders full avatar geometry, generated heads and original textures at every distance; those remain mounted. The people overlay samples actual positions/activities, supports profiles and replaces overlapping avatar balloons.

## Changed files

App integration: `src/App.tsx` clears previous selection/modal when opening a location.
Scene integration: `VillageScene.tsx`, `GridTown.tsx`, `MayorPlaza.tsx`, `TownCamera.tsx`, `OptionalModel.tsx`.
Pose and location helpers: `seatedPose.ts`, `seatedPose.test.ts`, `locationCloseup.ts`, `LocationPresence.tsx`.
Seat/routing data: `layout/cafeSeats.ts`, `layout/studySeats.ts`, `layout/benchSeats.ts`, `layout/town.ts`, `layout/navigation.ts`.
Overlay: `components/LocationCloseup.tsx`, `components/locationCloseup.css`.
QA: `tests/web044*` and this report. Temporary original-source baseline copies are not committed.

## Reproduce

From `apps/web`, use mock mode (`VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev`). Double-click a location, select a person in the overlay, and use Esc or Back to town. Drag your avatar onto cafe/study/fountain drop targets to check seating.

The deterministic test scene is `/tests/web044.html`: six synthetic cafe guests, a fixed schedule, no live API. It advances the real frame subscribers to settle walking without rendering thousands of GPU frames.

Optional before-image setup, from the worktree root:

```powershell
python apps/web/tests/web044-baseline.py
```

This extracts four original scene modules from `53ffcb44b70d846a395b4cb3b0b1f26009464f4c` into temporary test files. Then, from `apps/web`:

```bash
../../ops/remote_run.sh bun run build
../../ops/remote_run.sh bun run test
../../ops/remote_run.sh bun test src/scene/seatedPose.test.ts src/scene/layout/cafeSeats.test.ts
../../ops/remote_run.sh bunx playwright test --config tests/web044.config.ts
```

## Results

- `../../ops/remote_run.sh bun run build`: exit 0 (TypeScript build + Vite production bundle; existing large-chunk warning).
- `../../ops/remote_run.sh bun run test`: exit 0, 179 passed, 0 failed.
- `../../ops/remote_run.sh bun test src/scene/seatedPose.test.ts src/scene/layout/cafeSeats.test.ts src/scene/layout/studySeats.test.ts src/scene/playerControl.test.ts src/scene/layout/town.test.ts`: exit 0, 33 passed, 0 failed.
- `../../ops/remote_run.sh bunx playwright test --config tests/web044.config.ts`: exit 0, 4 passed (2.3 minutes execution; 800 seconds including shared-runner queue and sync). Desktop, native touch at 390 px, profiles, camera restoration, label single/double clicks, click-out, baseline capture and all-models-missing fallback passed.
- Visually inspected all five screenshots; the mobile people list scrolls within the card and leaves the cafe visible above it.

Earlier checks found missing routes to the new reading benches and HTML-label clicks propagating into Canvas background dismissal; both were fixed. Browser tests poll camera restoration and queue native touch events to avoid software-renderer scheduling turning a double tap into taps seconds apart.

Screenshots: `apps/web/artifacts/web044/cafe-before.png`, `cafe-after.png`, `cafe-fallback.png`, `closeup-1280.png`, `closeup-390.png`. The before capture uses the original task commit; the fallback capture returns 404 for every model. All imagery uses fixture assets.

No blockers or proposed contract changes.

No contract changes, secrets, paid generation, live-village mutations, pushes or merges are required.
