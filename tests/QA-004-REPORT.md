# QA-004 final report

Release recommendation: **HOLD** for three reproducible integration defects.
The new live wave-7 checks pass, and both QA-003 group-photo defects are resolved.
See [RELEASE-CHECK.md](RELEASE-CHECK.md) for every command, exit code and retained gap.

Branch `qa/QA-004`; baseline `cc09d3739b9d9ec0d2592a97a78afbf667b6698b`;
live-harness milestone `5ddde02`. Subsequent commits contain fixture corrections and
this report. No app, contract, root configuration or secret file is changed.

## Findings and reproductions

### QA4-B01 — mobile scene labels intercept My profile

At 390x844, projected villager labels overlap the self card and intercept pointer
input. The native recording test cannot get as far as settings; it repeatedly
reports `villager-Dev ... intercepts pointer events`. Reproduced in both the full
suite and focused retry. The screenshot visibly places Dev over My profile.

From `tests/.runtime/checkout/tests` after the preparation in RELEASE-CHECK:

```powershell
node ../apps/web/node_modules/@playwright/test/cli.js test --config playwright.mock.config.ts --project=connection --grep 'native recording' --workers=1
```

Manual equivalent: open the contract-mocked app at 390x844 with five villagers,
then click My profile without moving the camera. Expected: own profile opens.
Observed: another villager label owns that screen position. App owner should keep
projected labels behind HUD controls or avoid projecting them into HUD hit areas.
This reproduction is local synthetic data, not a test against Hacklanta Crew.

### QA4-B02 — configured wallet panel cannot import dependencies

Fresh locked web install succeeds, but `apps/web/package.json` does not declare
`@solana/kit`, `@solana/kit-plugin-wallet` or `@village/pot-client`; the production
Vite aliases do not supply them. With VITE_SOLANA_PROGRAM_ID set and a mock pot
address, Join pot with wallet displays `Wallet panel unavailable: Failed to fetch
dynamically imported module`. Vite reports the unresolved `@solana/kit` import.
Even the upstream flag-on config, which mocks wallet hooks, leaves this import
unresolved. Both wallet cases fail; no simulation or signature action is reached.

From `tests/.runtime/checkout/apps/web`:

```powershell
node node_modules/@playwright/test/cli.js test --config tests/web012.config.ts --project=flag-on --workers=1
```

Manual equivalent: create an offline mocked non-friendly competition with 0.01 SOL
entry intent and a synthetic pot address, then click Join pot with wallet. Expected:
mock wallet simulation controls. Observed: module load error. Restore dependency
wiring while preserving the intended React 19 wallet island boundary; rerun the
actual-wallet-hooks/no-wallet case too after the owner fixes packaging. Do not
infer that copying packages into the browser app would safely resolve React versions.

### QA4-B03 — generated pot-client still uses obsolete program address

The Rust program declares `4m7xFhBQcWfa7u3kP8i78QaTYjkQXSxt5iUfj2689Ehu`.
`packages/pot-client/idl/village_pot.json` and generated `programs/villagePot.ts`
still declare `Fg6PaFpoGXkYsidMpWxTWqkZ7FEfcYkgMQhgNXcLxGNB`.
With the source-matching binary, five LiteSVM integration cases fail immediately
with Anchor error 4100 `DeclaredProgramIdMismatch`. Fourteen client/wallet/React
cases pass, including the explicit configured-program override case.

Reproduce with the WSL command in RELEASE-CHECK. Regenerate/alignment is for the
program/client owner; no IDL or application code was changed in this task. Tests
use ephemeral emulator signers and mocked wallet actions, never an owner wallet,
RPC broadcast, deployment or on-chain transaction.

## Completed coverage and limits

The seven named live API checks cover message privacy/read idempotence/feed effects,
SSE, concurrent bribe balance protection, token reward projection and fake terminal
photo job materialization, Gazette/archive/memory shapes, event packs/voice registry,
and QA-only deletion. Two live browser cases render Gazette/archive at desktop and
mobile sizes, compare memory to its actual API response, click scene villagers,
and send messages/pokes/cheers between dedicated QA users.

The live photo harness issues a synthetic event reward through the XP ledger,
checks the resulting token through HTTP, then atomically links that token to a fake
done/failed job. It does **not** call successful live upload, which would enqueue a
real worker job. Actual token spending and upload races, private assets, equipment,
failed worker responses and retries are covered by `test_api011.py` in a private
`village_test` schema. Terminal live fixture URLs reference no real files.

Bribe consumption runs through production scheduler code with mocked Mayor output
in `test_api010_bribes_scheduler.py`: concurrent ticks create one event, consume
once, add one Gazette story and award once. No live scheduler tick or paid Mayor
call was forced. All fresh live villages use the scheduler-excluded QA-002 prefix.

Main passing results: API 234/1 skip, cross-cutting API 6, web units 32 + 15,
live baseline HTTP 6/4 skips, live baseline browser 4/2 skips, wave-7 live API seven
checks + browser 2, social UI 6, iMessage 9 + simulation, health units 4. Corrected
scene suite passes 3. The full mock run initially passed 34 and failed 5; see the
checklist's focused reruns. Equipment passes on retry without app changes; the
initial `_roots.get(canvas).store` failure is consistent with a cold Vite module
lookup flake, not certified as an app fix. Scene tests needed current registry
level 5 and JSON request bodies. No failures were hidden with skip/xfail.

The new memory browser test initially asserted seeded facts after completing an
event rebuilt the memory document. It now compares UI text with the real HTTP
response, and passes. Photo uploader and completed crop controls both pass now.

## Local visual evidence

Paths below are relative to this worktree and ignored, not committed. Screenshots
contain only fresh QA identities or synthetic offline fixtures. Gazette mobile,
rectangular live town, mobile obstruction, and night fallback scene were visually
inspected. Night/day screenshots use software rendering, not a hardware FPS gate.

- Live Gazette/mobile/memory directory:
  `tests/.runtime/checkout/tests/test-results/wave4/live-live-Gazette-latest-a-3d010-ile-layout-and-Mayor-memory-live/`
  (`gazette-desktop.png`, `gazette-mobile.png`, `memory.png`).
- Live town/messages directory:
  `tests/.runtime/checkout/tests/test-results/wave4/live-live-rectangular-town-5bd23-s-messages-pokes-and-cheers-live/`
  (`town.png`, `messages.png`).
- Mobile obstruction:
  `tests/.runtime/checkout/tests/test-results/mock/settings-native-recording--5f1c5--microphone-on-mobile-close-connection/test-failed-1.png`.
- Wallet error accessibility snapshot:
  `tests/.runtime/checkout/apps/web/tests/artifacts/web012-runs/web012-both-Solana-flag-st-18496-imulation-signature-actions-flag-on/error-context.md`.
- Day/night fallback screenshots: `tests/.runtime/scene-final/` (per-test directories).

## Safety, cleanup and handoff

Provider budget used: zero live Mayor, ElevenLabs or vision requests. Zero real GPU
jobs submitted, iMessages sent, chain transactions sent, shared service restarts,
public tunnel visits, or tests using seeded live users. Upstream isolated tests use
their own private seed fixtures; offline browser mocks reuse familiar fixture names.

Every live runner executed its finally cleanup on successes and failures. A final
read-only psycopg audit using Settings.from_env() ran these counts, all zero:

```sql
SELECT count(*) FROM users WHERE auth_issuer='qa002';
SELECT count(*) FROM villages WHERE name LIKE 'QA-002 %';
SELECT count(*) FROM avatar_jobs WHERE idem_key LIKE 'qa4:%';
SELECT count(*) FROM photo_item_tokens WHERE source LIKE 'reward:qa4-reward:%';
```

Final health: API/web/DB/GPU up, users=5, pending outbox=0; GPU jobs done=42,
failed=1, queued/running=0. Teammate activity continued during QA, so these global
job totals are informational and not attributed to this test run. Root external
.env was loaded at runtime; no secrets were copied into the test checkout.

Files changed: `tests/prepare_checkout.py`, `tests/wave4_live.py`,
`tests/playwright.wave4.config.ts`, `tests/wave4/live.spec.ts`,
`tests/wave3/scene.spec.ts`, `tests/run_pot.sh`, `tests/README.md`,
`tests/RELEASE-CHECK.md`, and this report.

Teammate quick start: run the preparation/install commands in RELEASE-CHECK, then
`& $qaPython tests/wave4_live.py --browser` from the test checkout. Shared services
must already run on 8010/4173 against the external env's DB. No test identities are
retained afterward. For bug reproductions, use the commands above and the WSL
command in the checklist.

Blockers: the three findings above; missing demo capture; optional live-provider,
worker-down and real portrait tests intentionally not run. No HTTP/DB contract
change is proposed. The existing Solana deployment/client address must be made
consistent by its owner. Scene screenshot output was made independent of cwd after
a root invocation briefly wrote two generated PNGs; those were moved under tests
and the empty generated directory removed. Final changes remain inside tests/**.
