# FEAT-021 delivery

Branch: `feat/FEAT-021`. Milestones: `15d617e` (contract), `fe24b38`
(implementation), `268bfc0` (tests). Final proof/report commit follows these.

Village members now see each other's manually controlled ground movement and
emotes. The relay uses the existing demo/Auth0 first-message authentication,
checks membership, clamps the town envelope and movement speed, accepts at most
10 movement updates/second, rejects malformed/flooding clients, and coalesces slow
receivers by seat. No position tick writes, XP changes, or paid generation calls.

Clients send changed state only, including the final stop. Remote avatars use a
100ms interpolation buffer, at most 200ms extrapolation, and five-second expiry.
They smoothly acquire the received position and resume ambient routing from their
current position on stop/disconnect. Existing avatar models, labels, emotes and
CrowdDetail remain in use. Run cadence is faster. Movement socket failures feed
the existing Reconnecting pill independently of HTTP success.

## Files changed

- `packages/contracts/api.md`: small shared wire contract, published first for FEAT-022.
- `apps/api/app/realtime.py`, `apps/api/app/main.py`: process-local authenticated relay and registration.
- `apps/api/tests/test_realtime.py`: validation, speed/rate bounds, demo/Auth0 authentication, membership, fan-out, snapshots, cleanup and flood tests.
- `apps/web/src/api/movement.ts`, `movement.test.ts`: bounded sampling/interpolation and tests.
- `apps/web/src/api/townLive.ts`: changed-state publishing, reconnect/backoff and cleanup.
- `apps/web/src/api/retry.ts`, `retry.test.ts`: independent connection failure sources.
- `apps/web/src/components/Presence.tsx`: socket lifecycle scoped to village and seat.
- `apps/web/src/scene/VillageScene.tsx`, `playerControl.ts`, `usePlayerController.ts`: remote rendering and running state.
- `apps/web/tests/movement.config.ts`, `movement.spec.ts`: disposable two-context browser proof and recording.
- This report and `apps/web/tests/artifacts/movement/.gitignore`: delivery notes and exclusion of generated recordings.

## Verification

All heavy checks ran through the configured remote runner. No live API (:8010)
was used. No secret file was copied or needed for these tests.

From `apps/api`:

```sh
bash ../../ops/remote_run.sh python -m uv run pytest -q tests/test_realtime.py
```

Exit **0**: **10 passed**. Includes an in-memory synthetic RSA-signed Auth0 token,
disabled demo auth, outsider rejection, bounded slow receivers, and actual sockets.

From `apps/web`:

```sh
bash ../../ops/remote_run.sh bun test src/api/movement.test.ts src/api/retry.test.ts src/scene/playerControl.test.ts
bash ../../ops/remote_run.sh bun run build
bash ../../ops/remote_run.sh --with-api bunx playwright test --config tests/movement.config.ts
```

All exit **0**: **21 unit tests passed**, production build passed, **1 Playwright
test passed** (two isolated browser contexts, different seats, walking position
change, stop, emote, offline/reconnect and renewed movement). Both screenshots
were visually inspected. The wrapper stopped the scratch API and removed its DB.
`git diff --check` also exited **0**.

Earlier checks exposed a TypeScript null guard and a test assertion that needed to
consume a queued peer-leave event; both were corrected before the passing runs.
Several queued runs were deliberately stopped (runner status 143) to separate
unit/build checks from the shared browser lock and correct browser context setup.
They were not passing test executions. Existing build chunk-size and Starlette
test-client deprecation warnings remain non-fatal.

## Visual proof

Under `apps/web/tests/artifacts/movement/movement-two-seats-see-mov-3e8a1-nd-reconnect-on-scratch-API/`:

- `seat-a-walking.png`: controlling Iraj.
- `seat-b-walking.png`: Lance's browser observing Iraj walking.
- `two-windows.mp4`: short side-by-side recording.
- `seat-1/*.webm` and `seat-2/*.webm`: original recordings.

Generated artifacts are available locally and excluded from commits.

## Teammate reproduction and deployment

Run the Playwright command above to recreate the scratch proof and recordings.
For manual testing against a scratch API, open two independent browser sessions,
choose different **Play as** seats, then use WASD, Shift to run, and 1/2/3 to emote.
Watch that seat in the other session. Idle sockets send no application heartbeat;
membership is rechecked every 30 seconds without holding a connection between reads.

No ops edit is needed for the production path: `ops/deploy/prod.Caddyfile` already
routes all `/api/*` to `127.0.0.1:8012`, and `apps/web/apiProxy.ts` enables WebSocket
upgrades for development. No live server was edited or deployment attempted.
The historical house-only demo tunnel described in REMOTE_RUNNER.md is separate
from this production configuration and would need its matcher expanded if reused.

Assumptions/limits: one API process, ephemeral positions, ground walking only
(carrying, Ferris wheel and attraction/interior motion retain existing behavior).
Existing crowd LOD is preserved and buffers are bounded; this is not a 100-browser
load benchmark. New interpolation tests are invoked explicitly because the web
package's enumerated test script is outside this task's allowed paths.

Blockers: **none**. Proposed contract changes: **none outstanding**; the authorized
movement contract is included in `api.md` for FEAT-022.
