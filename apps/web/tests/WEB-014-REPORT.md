# WEB-014 implementation report

Branch: `web/WEB-014`. Implementation milestone: `3e2eb40`. Follow-up validation commit recorded in git history. No push or merge.

## Shipped

- Inbox drawer with unread count, per-neighbor conversations, compose and recipient-only read updates. Polls unread every 10 seconds and open conversations every 5 seconds; reads the newest 200 messages in each box. HTML-looking message content is rendered as text.
- Message, Poke and Cheer profile actions; pokes/cheers refresh the shared feed. Sends are guarded against double submission and never automatically retried.
- Authenticated fetch/SSE presence with chunk-safe UTF-8/CRLF parsing, 5-second reconnect, cleanup on village/identity changes, and 10-second heartbeats. Activity changes trigger an immediate heartbeat without reconnecting the stream. Hidden tabs stop renewing presence. People-strip and profile dots reflect snapshots.
- Mayor XP slider, wish, debit receipt and session-local purchase status. Insufficient-balance and uncertain network errors remain visible. Closing during a purchase is disabled.
- Manifest-driven preload of all 18 SFX, gesture gate, persisted mute/volume/reduced-sound controls, reduced-motion support, and night/festival ambience. Effects cover check-in, XP, level-up, purchase/equip, crown, Mayor/prayer, evidence verdict, pet purchase/equip, unlock, crater transitions, events, pokes and messages. Prior independent oscillator effects now use the shared engine.
- Typed DELETE confirmation, API failure handling, local private-cache clearing, stopped polling/sounds, and signed-out confirmation. Authenticated sessions invoke the existing Auth0 sign-out callback. Deletion is disabled while voice recording or another settings mutation is running.
- Offline mock support for social routes, rate limiting, input validation, XP spending, expiring presence and account deletion. No real providers, messages, account deletions, wallet operations or live API mutations were used in verification.

## Files

All committed paths are under the task allowance:

- `src/App.tsx`, `src/styles.css`.
- `src/api/{client.ts,mock.ts,social.ts,social.test.ts}`.
- `src/components/{Messages,Presence,BribePanel,DeleteAccount}.tsx`.
- Existing component integrations: `AgentPanel`, `Celebration`, `MayorModal`, `ProfilePanel`, `SettingsPanel`, `Wardrobe`, `shared`.
- `src/sound/{engine.ts,engine.test.ts,SoundControls.tsx}`.
- `tests/web014.config.ts`, `tests/web014.spec.ts`, this report, and three WEB-014 screenshots.
- Existing tests: `connection.spec.ts`, `heads.spec.ts`, `settings.spec.ts` now forward JSON POST bodies to their mock API. The bearer test captures its explicit auth probes rather than requests initiated before swapping its token provider. `polish.spec.ts` checks the manifest prayer clip instead of the replaced oscillator implementation.

No scene, contract, root, environment, other-app, or package-manifest changes are committed. Existing test-generated baseline screenshots are restored after verification.

## Verification

Commands below run from `apps/web` unless stated otherwise.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Installed web dependencies without lock changes |
| `npm ci --ignore-scripts --install-links` from `src/components/pot` | 0 | Installed existing wallet-panel dependencies as documented |
| `bun run build` | 0 | TypeScript and production build; existing large-chunk warning |
| `bun run test` | 0 | Existing 32 unit tests passed |
| `bun test src/api src/sound src/components/GaussianHead.test.tsx src/scene/cosmeticAssets.test.ts src/scene/generatedHead.test.ts src/scene/OptionalModel.test.ts src/scene/worldTypes.test.ts` | 0 | 49 tests, 1,776 assertions passed |
| `bunx playwright test --config tests/web014.config.ts` | 0 | Six social tests passed across mocked HTTP and forced offline |
| `bunx playwright test --config tests/web014.config.ts --grep "deletion|forced offline"` | 0 | Three tests passed after final deletion-control change |
| `bunx playwright test --project connection` | 0 | Final 14 connection tests passed after forwarding heartbeat bodies |
| `git diff --check` (repository root) | 0 | Clean |
| `bunx playwright test --project mock --project connection --project auth` | 1 | Latest whole run: 29 passed, six legacy mock adapters rejected heartbeat bodies they had dropped; the 20 mock and one auth tests all passed |

All 35 existing regression cases passed across the last whole run (20 mock + one auth) and the final focused connection run (14). No unresolved test failures remain; the entire 35-case command was not rerun after those mock-adapter fixes.

Earlier diagnostic failures were corrected: missing dependencies; running commands from the wrong directory; a new test URL glob intercepting frontend source; feed assertions made while profiles hid the feed; the profile presence image changing the heading's accessible name; the oscillator assertion; and a bearer test capturing pre-swap requests. Initial whole run was 32 passed / three failed. These failures are disclosed rather than represented as passing runs. No scene tests were edited.

## Screenshots and visual QA

Inspected the generated PNGs after the tests:

- `tests/artifacts/web014-inbox-desktop.png` (1280 x 900).
- `tests/artifacts/web014-inbox-mobile.png` (390 x 844; full-width drawer, no horizontal overflow).
- `tests/artifacts/web014-bribe.png` (receipt and pending status visible).

## Teammate trial

1. Install the existing dependencies with the two install commands above if needed.
2. In PowerShell from `apps/web`, run `$env:VITE_MOCK='1'; $env:VITE_DEMO_AUTH='1'; bun run dev --port 5188`, then open `http://localhost:5188`.
3. Visit a neighbor, send a message/poke/cheer, close their profile to see the feed, and switch Play as to the recipient to see unread mail. Mock state is per tab and resets on reload.
4. Open Mayor, scroll to Bribe the Mayor, offer 50 XP and inspect the receipt/balance. Open My profile > Settings for sound controls and typed account deletion. Use only disposable demo identities for deletion.
5. Live development uses the existing Vite `/api` proxy to port 8010 and runtime `VILLAGE_ENV_FILE`. No secrets need copying; mock verification requires none.
6. Run the explicit social unit and browser commands above. The root web package's hardcoded test script is outside the allowance, so it does not automatically include the new unit files or WEB-014 browser configuration.

## Scene handoff and contract gaps

- WEB-013 can import `usePresence` from `../components/Presence` inside the scene. App already wraps `VillageScene` in the provider; the hook returns `{online, connected}`, with `{user_id,x,z,activity}` entries. Heartbeats currently use neutral `(0,0)` coordinates because the scene owns movement. Wire a scene position setter in a coordinated follow-up if synchronized positions are desired. Scene click hooks for pet barks can call `sound.play('pet_bark_happy')`; WEB-014 currently triggers that sound on pet purchase/equip.
- **Blocked by API-010 contract:** no GET bribe-history/status endpoint exists. The UI shows session-local receipts and the status returned at purchase, clearly labeled as such. It cannot reliably discover consumed status or recover history after reload. Proposed `GET /villages/{vid}/mayor/bribes` should return the current user's paginated bribes with pending/consumed status. Bribe influence also requires API-009's scheduler integration described in the proposal. No outcome is invented.
- The optional per-message iMessage checkbox cannot be truthful with the current contract: relay is automatically queued according to recipient consent/phone, public profiles do not expose relay eligibility, and extra POST fields are rejected. The UI explains this policy. To offer a sender toggle, add an explicit optional relay flag and a privacy-preserving eligibility field to the agreed contract.
- Account erasure scope remains the server's API-010 policy; external backups/delivered messages/Auth0 identity deletion are not claimed.
