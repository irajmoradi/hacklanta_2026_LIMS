FIX-023 — instant local controls with authoritative shared state

Branch: `fix/FIX-023`. Implementation commits: `7841fd9` (server), `122a5c8`
(client prediction/interpolation), `078184e` (topology and input-order regressions).
Baseline: `d38d44c`. All edits stay within the task's allowed paths.

Local WASD and stop positions are predicted on the input frame. Emotes, seats,
and attraction slots are tentative immediately; accepted server allocations and
rejections reconcile over 200 ms. Movement echoes within 1.5 m do not reposition
the local avatar. Corrections preserve new movement during the ease. New actions
supersede unsent stop packets. Nonmovement sends share the existing movement
budget while prediction happens immediately.

Remote avatars use a 75 ms receive-time buffer and at most 100 ms of extrapolation.
Sequence gaps apply useful newer states and request a background snapshot without
disabling controls. Server fan-out drains committed queues immediately, without
the old 50 ms sleep or room-lock acquisition. Snapshot merging preserves removals
and newer states. Catalog validation is cached per room rather than repeated every
idle tick. Persistence, authoritative slot allocation, 1 Hz idle ticks, membership
checks, 10 intents/second per user and 40 messages/second per socket remain in place.
There is no fan-out timer limiting flush frequency to 10 Hz; the unchanged ingress
limit applies separately to each user. Same-user sockets coexist.

Measured on the remote runner with scratch databases and synthetic demo users:

| Measurement | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Server receive to WebSocket fan-out | 59.00 / 207.59 ms | 8.38 / 10.45 ms |
| Browser send to other context receive | 63 / 198 ms | 11 / 31 ms |
| Browser send through remote interpolation sampler on animation frame | Not measured | 93 / 108 ms |

Server timings wrap the actual WebSocket receive/send methods, including membership,
database work and lock contention, over 30 movement intents (both fan-out recipients).
Browser timings use two separate Chromium contexts and 30 intents on the same host.
The interpolation measurement uses the production sampler in a small animation-frame
probe, not a GPU frame-time benchmark. Separate full-scene tests verify actual
keyboard input/rendering, shared seats, ride parenting, idle activity and reconnects.
The baseline failed the new latency budgets as expected. Two initial browser probes
also failed because they counted only deltas; the corrected probe counts movement
carried in topology snapshots too. No live village or paid generation was used.

Commands run from the indicated app directory (Git Bash on Windows):

| Directory | Command | Result |
| --- | --- | --- |
| `apps/api` | `../../ops/remote_run.sh python -m uv run pytest -q -s tests/test_overworld.py tests/test_realtime.py tests/test_overworld_latency.py` | Exit 0; 18 passed |
| `apps/web` | `../../ops/remote_run.sh bun test src/api/overworld.test.ts src/api/prediction.test.ts src/api/movement.test.ts src/scene/playerControl.test.ts` | Exit 0; 19 passed |
| `apps/web` | `../../ops/remote_run.sh bun run build` | Exit 0; production build passed |
| `apps/web` | `../../ops/remote_run.sh bunx tsc -b --pretty false` | Exit 0; final TypeScript check passed |
| `apps/web` | `../../ops/remote_run.sh --with-api bunx playwright test --config tests/fix023.config.ts` | Exit 0; 3 passed |
| `apps/web` | `../../ops/remote_run.sh --with-api bunx playwright test --config tests/fix023.config.ts prediction.spec.ts` | Exit 0; final pending-stop regression passed |

The build reports its existing large-chunk warning; API tests report a Starlette
TestClient deprecation warning. Neither causes a failure. Baseline server timing
and browser timing commands exited 1 on their respective 20 ms / 150 ms assertions.

Files changed:

- `apps/api/app/realtime.py`, `apps/api/app/overworld.py`, `apps/api/tests/test_overworld_latency.py`.
- `apps/web/src/api/overworld.ts`, `townLive.ts`, `overworld.test.ts`, `prediction.test.ts`.
- `apps/web/src/scene/VillageScene.tsx`, `usePlayerController.ts`, `predictIntent.ts`.
- `apps/web/tests/fix023.config.ts`, `latency.config.ts`, `latency.html`, `latency.spec.ts`, `prediction.spec.ts`, this report.
- `apps/web/tests/artifacts/fix023/.gitignore`, `apps/web/tests/artifacts/latency/.gitignore`.

Screenshots were downloaded and visually inspected:
`apps/web/tests/artifacts/fix023/overworld-two-seats-share--d11e0--ride-idle-and-gap-recovery/cafe-a.png`
and `apps/web/tests/artifacts/fix023/prediction-WASD-and-emote--a93f9-ame-with-server-echoes-held/predicted-avatar.png`.
The two-window video is alongside the café screenshot as `two-windows.mp4`.
Artifacts are ignored, not committed.

To try it, run the full `fix023.config.ts` command above; the wrapper creates and
cleans up its own API and database. On a separate scratch deployment, open two tabs,
walk with WASD, release movement and immediately press 1/2/3, then drag onto the café
or Ferris wheel. The local action should appear immediately and both tabs should
converge on the authoritative seat/cabin. Competing for the same seat rolls the
losing prediction back. Repeat with the same demo user in both tabs to check
coexistence. Do not use live-demo debug controls.

Blockers: none. Proposed contract changes: none. Reasonable choices: 75 ms buffer,
100 ms extrapolation cap, 1.5 m movement threshold, 200 ms smoothstep correction;
retain SEC-001 ingress limits and commit-before-broadcast durability.
