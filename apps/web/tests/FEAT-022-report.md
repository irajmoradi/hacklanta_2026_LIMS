# FEAT-022: interior avatars and stairs

Branch: `feat/FEAT-022`. Implementation milestone: `5a746b2`; control fixes and regression coverage: `713d1e6`.

Own and neighboring avatars now use the existing villager model, generated-head
adapter, outfits and a procedural fallback. Focus the room and use WASD/arrows,
or click the floor. A quarter-unit A* grid respects furniture bounds, rotation,
floor and stashing; rugs and wall/ceiling decorations remain traversable.
Click Upstairs/Downstairs to walk to the stairs, walk onto them, or press E nearby.
The middle storey has separate up/down stairs; the top never wraps to the ground.
Floor changes fade briefly, reset the avatar to the door, and update floor tabs.

Movement pauses for the entire Decorate mode and history preview, including all
furniture drags. Floor tabs remain available as a direct navigation shortcut.
Private-house edit permissions and Community Hall permissions are unchanged.

The existing authenticated house socket broadcasts bounded room-local positions,
heading in radians, moving and floor, capped server-side at 10 Hz per connection.
Clients send at most every 120 ms while changing, plus a one-second idle refresh
for late joiners. Movement uses NOTIFY only, with no new schema, furniture
revision/history, generated assets, paid provider calls or persistent position rows.
Presence heartbeats preserve positions; departure removes avatars.

## Changed files

- `apps/api/app/houses.py`: position validation and authenticated ephemeral broadcasts.
- `apps/web/src/scene/interiorWalk.ts`: obstacle grid, A* and adjacent-floor stairs.
- `apps/web/src/scene/InteriorAvatars.tsx`: model/fallback rendering, interpolation and stair meshes.
- `apps/web/src/components/interiorWalk/useInteriorWalk.ts`: scoped controls, walking, transitions and transport.
- `apps/web/src/components/HouseInterior.tsx`, `HouseInterior.css`: room wiring and fade.
- `apps/api/tests/test_interior_position.py`, `seed_interior_walk.py`: socket tests and guarded disposable fixture.
- `apps/web/tests/interiorWalk.test.ts`, `feat022.spec.ts`, `feat022.config.ts`: unit and two-context browser coverage.
- `packages/contracts/api.md`: movement message contract. FEAT-021 had no town movement shape here when implemented.

## Verification

All heavy checks run through `ops/remote_run.sh`, from the appropriate app directory.
No live village or live Tiger database is used. API tests use an isolated schema
in `village_test`; browser tests use the wrapper's disposable `run_*` database.

- Web: `../../ops/remote_run.sh bun test tests/interiorWalk.test.ts src/scene/interior.test.ts`: exit 0, 11 passed.
- API: `../../ops/remote_run.sh python -m uv run pytest -q tests/test_interior_position.py tests/test_feat015.py tests/test_feat019.py`: exit 0, 23 passed, 1 skipped (live Tiger inspection; Tiger is unconfigured).
- Web build: `../../ops/remote_run.sh bun run build`: exit 0, including final source changes. Existing large-bundle warnings remain.
- Browser: `../../ops/remote_run.sh --with-api bunx playwright test --config tests/feat022.config.ts`: final run exit 0, 2 passed in 49.9 seconds, including floor clicking, two independent contexts, live position/floor sync, late join/departure, paused decoration controls, visitor permissions, missing-model fallback, E activation, and three-storey stair directions. Initial run exited 1 while the second context was still connecting at the five-second assertion deadline; the software-rendering startup wait is now 15 seconds. Shared-runner lock waits account for most elapsed time.

## Try it

Run the browser command above to create and clean up a scratch village automatically.
For manual use in your own test village, enter a home or Community Hall, focus the
room, walk with WASD/arrows or click the floor, then use its stairs. Open the same
room as another member to see position and floor changes. Visitors can walk but
cannot decorate private houses. Finish decorating to resume walking.

## Reviewed artifacts and limitations

- `apps/web/tests/artifacts/feat022/upstairs.png`: two villagers upstairs, owner perspective.
- `apps/web/tests/artifacts/feat022/peer-upstairs.png`: independent visitor perspective of the same positions.
- `apps/web/tests/artifacts/feat022/home-floor3.png`: third storey and correct floor indicator.
- `apps/web/tests/artifacts/feat022/visitor-mobile.png`: 390px visitor view with missing model assets.
- `apps/web/tests/artifacts/feat022/session-a.webm`: successful 30.32-second recording (duration verified with ffprobe).

All four final screenshots were visually reviewed. Implementation has no remaining
blockers. Live Tiger inspection is intentionally skipped, and positions/pathing are
ephemeral client movement with server coordinate/floor validation, not authoritative
physics. Avatar collisions with each other are not enabled; they can share a doorway.
Automatic approval rejected the local artifact-cleanup command as blocked by policy;
original recordings and test diagnostics are retained untracked, with only the
successful named artifacts committed.
No additional contract changes are proposed beyond the included movement section.
