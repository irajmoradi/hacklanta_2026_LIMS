# FEAT-023 — shared authoritative overworld

Branch: `feat/FEAT-023`. Implementation milestones: `8a82d36` (API/persistence),
`8b3f9e3` (shared rendering/transport). Final validation commit is the branch tip.

The API now owns positions, activities, attraction slots, chairs, emotes, following,
and idle journeys. A village has one 1 Hz tick while sockets are connected. Changes
commit to Postgres before broadcast, survive restarts, and replay accepted request
IDs without reapplying. Every client receives the actor's state too. Coalesced
deltas cover a sequence range; gaps and reconnects replace a full snapshot.

The live scene renders committed activities and interpolates positions. WASD uses
short local prediction with authoritative correction. Dancing, emotes, loaded
model animation and Ferris cabins share server time; clock sampling accounts for
round-trip latency. Mock mode keeps the existing local controls and schedules.
Crowd detail, closeups and cinematics retain their existing rendering paths.

Choices made without clarification:

- Drops control only the authenticated user's avatar, matching the existing UI.
- Capacities: stage 24, Ferris wheel 10, cafe 6, study 12, benches 3, fitness 8;
  other ordinary attractions 12, Mayor gathering 100. Full scheduled destinations
  send overflow villagers home; reservations include journeys to the destination.
- Accepted request IDs have a 24-hour retention window. Rejected intents show a
  short status message and restore the authoritative snapshot.
- The Emotes menu also exposes Follow a villager and Stop activity. Shift+C
  continues to toggle camera following, independently of avatar following.
- Use a single API process. Multi-worker horizontal scaling requires a shared
  reducer coordinator; this task explicitly requested process-owned memory.
- Server layout metadata is a reviewed snapshot of the merged web catalog. A
  parity test compares catalog metadata and 100 homes across three seeds; update
  the snapshot when changing the civic catalog.

Changed files:

- API: `app/main.py`, `app/realtime.py`, `app/overworld.py`,
  `app/overworld_layout.json`, `migrations/056_overworld.sql`,
  `scripts/overworld_benchmark.py`, `tests/test_overworld.py`, `tests/test_realtime.py`.
- Web transport: `src/api/townLive.ts`, `src/api/overworld.ts`,
  `src/api/overworld.test.ts`, `src/components/Presence.tsx`.
- Scene: `VillageScene.tsx`, `usePlayerController.ts`, `RideWheel.tsx`,
  `OptionalModel.tsx`, `EmoteWheel.tsx`, `GridTown.tsx`, `overworldLayout.test.ts`.
- Browser checks: `tests/overworld.config.ts`, `tests/overworld.spec.ts`,
  `tests/overworld-tools.ts`, updated `tests/movement.spec.ts`, this report and proof artifacts.
- Contract: `packages/contracts/api.md` replaces the FEAT-021 relay documentation.

Validation (all heavy commands run through the configured remote runner):

| Directory | Command | Result |
|---|---|---|
| `apps/api` | `bash ../../ops/remote_run.sh python -m uv run pytest -q tests/test_overworld.py tests/test_realtime.py` | Exit 0; 16 passed (final cancellation/rollback regression included) |
| `apps/web` | `bash ../../ops/remote_run.sh bun test src/api/overworld.test.ts src/scene/overworldLayout.test.ts src/scene/OptionalModel.test.ts` | Exit 0; 5 passed, 997 assertions |
| `apps/web` | `bash ../../ops/remote_run.sh bun run test` | Exit 0; 198 passed |
| `apps/web` | `bash ../../ops/remote_run.sh bun run build` | Exit 0; existing bundle-size warning |
| `apps/api` | `bash ../../ops/remote_run.sh python -m uv run pytest -q` | Exit 0; 577 passed, 4 skipped; 595.01s |
| `apps/api` | `bash ../../ops/remote_run.sh python -m uv run python scripts/overworld_benchmark.py` | Exit 0; 100 villagers, 600 ticks: mean 1.61ms, max 2.92ms; mean delta 13,929 bytes, max 25,472 bytes |
| `apps/web` | `bash ../../ops/remote_run.sh --with-api bunx playwright test --config tests/overworld.config.ts` | Exit 0; 1 passed in 40.5s (43.3s suite); stage/cafe screenshots visually inspected |

The full API run preceded the final cancellation hardening; the focused 16-test
run was repeated afterward and passed. Cancellation restores in-memory state just
as a failed transaction does, before anything can be broadcast.

The additional loaded-model regression also passed:
`bash ../../ops/remote_run.sh --with-api bunx playwright test --config tests/movement.config.ts`
from `apps/web`: exit 0, 1 passed (about 1.1 minutes). It exercises WASD movement,
stop, emotes, and reconnect through the same authoritative transport.

Benchmark timing measures pure reducer CPU; it excludes database, network and
rendering costs. Persistence and transport are covered separately by the API and
browser suites.

Earlier iterations: an incorrect Vitest import and an overly narrow test assertion
type caused build exit 1; both were fixed. Two browser attempts exited 1 because
the test clicked an avatar label while it was moving or being reframed. The proof
now parks the actor through an authoritative intent before the real drag gesture.
A combined validation shell was interrupted (remote exit 130) while waiting for
the shared browser lock; separate runner commands avoid that unnecessary lock.

How to try: apply migration 056 using the normal API migration command, start one
API worker and the updated web app together, and open the same scratch village in
two browser profiles on different seats. Drag your avatar onto the stage or cafe;
the other window sees the same slot/chair. Use 1/2/3 for emotes, Emotes → Follow a
villager for following, and Stop activity or WASD to leave. Disconnect/reconnect
one window to verify snapshot recovery. The browser proof deliberately returns 404 for GLBs to exercise procedural fixture
models without generated assets or a GPU worker. The Playwright command above provisions
and cleans its own database; its fixture enables festival weather and unlocks
attractions only in that disposable database.

No secrets were copied, no paid generation was invoked, and no live demo state
was changed. No outstanding proposed contract edits: the permitted contract file
is updated. Migration 056 may be renumbered by the integrator if another branch
claims that number. No remaining implementation blockers. The first screenshot review caught the old
house-shaped stage fallback hiding dancers; `GridTown` now supplies an open stage
platform when assets are missing. The recaptured proof shows the same dancer and
front cafe chair in both windows.

Proof artifacts (relative to this report):

- [Two-window recording](FEAT-023-proof/two-windows.mp4)
- [Festival A](FEAT-023-proof/festival-a.png), [Festival B](FEAT-023-proof/festival-b.png)
- [Cafe A](FEAT-023-proof/cafe-a.png), [Cafe B](FEAT-023-proof/cafe-b.png)

The proof checks matching server slots and `since`, exact shared chair identity,
seat conflicts, identical ride-cabin parents, forced sequence-gap recovery, and
matching idle state after reconnect. Recordings/screenshots contain only seeded
fixture avatars. Raw traces and earlier failed-run output are not committed.

Temporary runner output remains untracked under `tests/artifacts/overworld/`;
only the reviewed files in `FEAT-023-proof/` are included in the commit.
