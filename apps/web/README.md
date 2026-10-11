# Village web · WEB-003

React 18, Vite, TypeScript and React Three Fiber. All changes and test artifacts are confined to
`apps/web`; generated models under `public/models` remain ASSET-001-owned.

## Try it

From `apps/web`, run `bun install`, then choose a mode in PowerShell:

Installation requires Node.js 20.18+ and npm as well as Bun. The web `postinstall`
runs `npm ci --install-links` against the committed lockfile in
`src/components/pot`. This automatically installs the React 19 wallet island and
copies the local `packages/pot-client` package into its dependency tree; the scene
continues to use React 18. Keep the repository layout intact, and rerun `bun install`
after changing the pot client so its installed copy is refreshed. Do not disable
install scripts. No separate wallet install or Solana credentials are needed.

Fresh-checkout verification: `bun install && bun run build`, then
`bunx playwright test --config tests/web012.config.ts --workers=1` (flag off,
mock wallet flag on, and actual wallet hooks with no wallet or RPC).

```powershell
# Offline: five fixture avatars, no backend or generated assets required.
$env:VITE_MOCK = '1'
bun run dev
```

```powershell
# Real seeded village, API at localhost:8010.
$env:VITE_MOCK = '0'
$env:VITE_DEMO_AUTH = '1'
$env:VILLAGE_ENV_FILE = '/c/Users/mourn/Downloads/hacklanta/.env'
bun run dev
```

Open http://localhost:5173. Use **Check in**, **My profile → Customize my avatar**, and
**AI at work**. Iraj owns the seeded village: select participants in AI at work to complete an
event, or use an evidence review's **Override review** button to approve it with a reason.
Goal owners and village owners can use **Mark done / Mark missed** in the profile.

For Auth0, set `VITE_DEMO_AUTH=0` and `VITE_MOCK=0` with the three public Auth0 settings below.
The welcome screen shows **Sign in**. Configure the SPA's callback, logout, and allowed web origin
as `http://localhost:5173` in Auth0. A verified identity without a village sees name/invite onboarding;
join with `HACKLANTA`, then optionally upload an avatar photo before entering the village.
An existing member can always reach the same avatar form from My profile.

## Public runtime configuration

Vite's `envDir` is the repository root. When `VILLAGE_ENV_FILE` points to the shared `.env`, Vite
also reads that directory's public `VITE_*` values at startup, with process variables taking
precedence. Git Bash `/c/...` and Windows paths are supported. No secret values are copied into
files or exposed to the browser. Never put private keys in `VITE_*`: those values are public.

| Variable | Behavior |
| --- | --- |
| `VITE_MOCK=1` | Force offline fixtures; always starts as fixture Iraj |
| `VITE_MOCK=0` or unset | Probe `/api/health`; offline fallback only before a demo session starts |
| `VITE_DEMO_AUTH=1` | Keep Play as even if Auth0 is configured |
| `VITE_AUTH0_DOMAIN` | Auth0 tenant domain, no scheme |
| `VITE_AUTH0_CLIENT_ID` | Public SPA client ID |
| `VITE_AUTH0_AUDIENCE` | API audience, normally `https://api.village.local` |
| `VITE_DEMO_USER` | Live demo UUID; defaults to `13370000-0000-4000-8000-000000000001` |
| `VITE_VILLAGE_ID` | Optional village override for an existing member; otherwise first `/me` village |

The live seeded village is `13370000-0000-4000-8000-000000000000`; offline fixture IDs remain
unchanged from WEB-001. Vite proxies `/api` to **8010**. Auth0 sessions never silently become demo
sessions: the SDK renews audience-scoped access tokens and each request sends only Bearer auth.
Demo requests send only X-Demo-User. Image, head-package and voice asset requests use the same
transport and revocable object URLs. A later live error never replaces existing state with fixtures.

## Implemented behavior

- Existing village, profiles, shop, Mayor, check-ins, goals, XP, keyboard controls and responsive
  procedural world still work offline. Evidence uploads now attach `evidence_asset_id` to the
  check-in; upload IDs and submission keys survive retries. Completed goals cannot accept progress.
- Auth0 provider, sign-in/sign-out, identity mapping from `/me.user.id`, invite onboarding and
  recoverable token/API errors. No bearer token is stored by application code.
- Explicit photo/voice/AI-labeling consent is required before upload. Photo validation accepts
  JPG/PNG/WebP up to 10 MB. Job and manifest polling shows queued/running construction, ready crops,
  and actionable failure text. Pending jobs survive closing/reopening the profile or leaving the
  onboarding step in the same tab. They do not survive a page reload; server manifests remain authoritative.
- The open profile mounts one lazy-loaded Gaussian head from `packages/lam-renderer` for ZIP
  packages. Thumbnails and avatar customization retain photos. The 224px fixed-size host avoids
  upstream resize feedback; profile switching serializes disposal and mounting. Hidden tabs unmount
  the head. A loading shimmer becomes a photo fallback on failure or after 30 seconds.
  Legacy authenticated video/frame packages remain supported by `LamHead.tsx`.
- **Hear them** requests one voice line after a click, plays authenticated audio, and immediately
  drives jaw/funnel weights from a WebAudio analyser. It polls the returned `expr_url`, or the CV-002
  conventional path, for up to 10 seconds and adopts an expression track when available. Closing
  the profile stops playback, polling and the analyser. The AI-generated voice label remains visible.
- The header's **Village** selector lists all `/me` memberships and includes **Join with invite code**.
  Joining refreshes memberships and opens the joined village. Switching closes the previous profile.
  Shop 409 responses refresh inventory, balance and profile state while preserving the error message.
  Failed initial shop, profile and AI journal loads have an inline retry.
- AI at work polls `/agent-log` every 10 seconds while open and shows actor, action, reason and
  model. Evidence badges poll reviews in open profiles and expose reasons on hover or keyboard focus.
  Owner override sends `{reason}` to the deployed `/review/override` endpoint, then refetches the review.
  Owner event completion sends only selected member IDs. Goal status sends `done` or `missed`.
- No provider generation is triggered by startup/polling. Mayor and voice requests require a button
  click; mock actions are explicitly scripted. Automated tests use synthetic images and provider stubs.
- Optional GLBs: `house_lv1..3`, `shop`, `mayor_stage`, `tree_a`, `tree_b`, `lantern`, `bench`, `fence`,
  `crater`, `path_tile`, equipped `hat_*`, `pet_dog`, and `villager_base`. Requests are cached per page;
  404s, malformed files, or network failure retain procedural geometry. Reload after adding assets.
  Models are normalized to base center and scene scale. SkeletonUtils clones each instance, materials
  are cloned before tinting named hair/shirt/pants/shoes/skin parts, and body idle/walk clips play when
  present. Hats and pets follow villagers; an event penalty containing `crater` renders a crater.
  No model files were generated or edited by WEB-002.

## Validation

Run from `apps/web`:

```powershell
bun run typecheck
bun run build
bun run test
bun run test:e2e
bun run test:e2e:real
```

Validated on 2026-10-10: typecheck/build exit **0**; **13 unit tests** exit **0**;
**13 browser tests** exit **0**; **1 real API browser test** exit **0**, actually executed (not skipped).
Final focused checks also passed (exit 0):
`bunx playwright test --project=connection --grep "avatar job" --output=test-results/final-media`
and `bunx playwright test --project=mock --grep "missing or malformed" --output=test-results/final-offline`.
The real test intentionally creates one plain status check-in, observes the feed update, reloads to
verify persistence, and opens the live AI panel. It skips if API :8010 is unreachable/unhealthy and
fails on reachable authentication/integration errors. It does not upload evidence or call paid models.
The build reports the existing Three.js vendor chunk warning (~991 kB / 275 kB gzip).

Mock/connection/Auth0 suites own ports 5174/5175/5177; real suite owns 5176. They do not interrupt
port 5173. Browser coverage includes PKCE/audience sign-in, Bearer-only private asset headers,
invitation onboarding, explicit consent, pending/failed/completed avatar jobs, authenticated LAM
frames, review overrides, goal status, owner controls, event rewards and the original WEB-001 flows.
Units include permissions, evidence ownership, reward idempotency, real GLB parsing and clone tint isolation.
No real interactive Auth0 account login, GPU generation, or real-person media was used in tests.

Visually reviewed screenshots (committed under `test-results`):

- `village-ai-panel.png` — AI actors, provenance and participant controls.
- `village-onboarding.png` — name and invite onboarding.
- `village-avatar.png` — photo input, explicit consent and construction entry point.
- `village-overview.png`, `village-profile.png`, and corresponding `-1920.png` screenshots.

## Integration gaps and proposed contract changes

The live server gained v2 routes during this task. Rechecking its current OpenAPI confirmed agent-log,
evidence attachment, goal status, event completion and review override routes. Earlier v1-only findings
are superseded. No API files, contracts, root files or environment files were edited.

1. **Display name persistence is blocked:** `/me` currently exposes GET only and joining accepts
   only `invite_code`. Proposed `PATCH /me {display_name}` → public user. The adapter/mock implement
   this proposed route; live 404/405/501 reports that the account name will be used and still allows
   joining. The frontend does not pretend the chosen name was persisted.
2. **General ownership metadata is missing:** `/me.villages` and `/villages/{id}` expose no role or
   owner ID. Proposed `owner_user_id` or caller-specific `my_role` on the village. The UI supports
   both. Until supplied, only the exact known seeded village/Iraj pairing from `apps/api/scripts/seed.py`
   gets the demo owner fallback. Arbitrary villages never infer ownership from house slot/order.
   All mutations remain server-authorized. Newly created villages need that metadata for owner controls.
3. **Document the deployed override:** `POST /villages/{vid}/check-ins/{cid}/review/override {reason}`
   approves evidence; a `verdict` field is rejected by the current OpenAPI schema. Add this route and
   its response to the shared contract, plus final review/override provenance fields.
4. **Voice expression metadata:** document optional VoiceLine `expr_url` and enqueue expression
   generation after voice-line creation. Until then the frontend uses the CV-002 asset convention
   and amplitude fallback. The Gaussian renderer is now integrated.
5. **Penalty lifecycle:** the current village response exposes `active_events` only. Craters render
   when those events carry a crater penalty. Persist applied penalties separately if they must remain
   after an event leaves this list.

Implementation references: [Auth0 React](https://auth0.com/docs/quickstart/spa/react),
[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html),
[SkeletonUtils cloning](https://threejs.org/docs/pages/module-SkeletonUtils.html).

## WEB-003 validation and handoff

See [WEB-003-REPORT.md](WEB-003-REPORT.md) for the final commands, files, limitations and evidence.
The real browser suite uses headed Chromium because LAM requires a visible tab. It now checks Dev's
actual authenticated head canvas and writes `test-results/dev-profile-lam.png`. That screenshot stays
local and ignored to comply with the repository rule against committing real-person portraits.
No paid provider generation runs in the automated tests; the voice integration test uses a PCM tone.

## WEB-004: weekly audits and competitions

Use **Week** in the HUD to see the assigned auditor, all goals, goal-linked progress and
photo reviews, the UTC wrap-up countdown, human grades, and emergency voting. The auditor
sits out. Click **Load AI pre-grade** to request a cached/new suggestion, inspect the scores,
rationale and model, then **Accept suggestion into grade**, optionally edit, and **Submit
human grade**. AI advice never submits a grade. Refreshing an AI suggestion is a separate,
explicit action. Once every eligible goal is graded, **Finalize week** awards the crown
and completion stars and celebrates in the village. Demo finalization can happen early.

Use **Compete** to create immutable terms, choose an auditor or friendly mode, and optionally
record an SOL entry intent. Participants must open the competition and **Agree to terms &
join** themselves. Audited entries require a photo; the AI review and human decision remain
separate. The auditor confirms/rejects with points and a reason, then settles. Friendly mode
uses self-reported scoreboard points, awards no XP, and lets the creator settle. No wallet,
transaction, payment, provider generation loop, or outgoing message is involved.

Offline demo: `VITE_MOCK=1 bun run dev` (PowerShell: `$env:VITE_MOCK='1'; bun run dev`). Iraj
is the deterministic mock weekly auditor. Grade Lance, Stefanny, Maya and Dev to finalize.
For an audited competition, create it as Iraj with Lance as auditor, join/submit as Iraj,
close the dialog, switch **Play as** to Lance, then open the competition and decide/settle.
The live server assigns its own random auditor; select the indicated person in demo auth.

See [WEB-004-REPORT.md](WEB-004-REPORT.md) for validation, screenshots, assumptions and
contract proposals. All existing commands above remain valid; they now include the new
unit/mock lifecycle tests and a real weekly read test that skips only when the API is down.
# WEB-005 settings and demo tour

Open **My profile → Settings** to edit your display name, E.164 phone and Mayor preferences.
Record up to three 60-second voice memos or upload audio files (10 MiB each). Creating a clone
requires explicit acceptance of `village-voice-v1`; deleting a clone clears its consent metadata.
The offline mode simulates clone state without generating audio. Live creation/deletion only runs
on its corresponding button click. A failed provider request leaves an inline, retryable error.

Check-in evidence in profiles and Week, and competition evidence, opens a private blob-backed
lightbox with the AI verdict, reason and model. Missing provenance is labeled as unavailable.
The last selected village is remembered per user. With no valid remembered choice, membership
dates are preferred when available; otherwise `/me` order is used. `VITE_VILLAGE_ID` no longer
overrides this choice. The current API orders villages by creation time, not membership time.

Open `/?tour=1` or select **▶ Tour** for the six-step demo. Tour navigation only opens read views;
voice generation, suggestions, grading and settlement still require their own explicit actions.
The live demo is **Hacklanta Crew** in the village selector. Keep `VILLAGE_ENV_FILE` pointing to
the external environment file and use `VITE_MOCK=0`, `VITE_DEMO_AUTH=1` with API :8010.

`bun run test` includes settings/consent/default-village checks. `bun run test:e2e` includes
transport, consent, native synthetic-microphone recording/cleanup, evidence and tour tests.
`bunx playwright test --config playwright.real.config.ts --grep WEB-005` captures live settings,
evidence and world screenshots without mutations or provider calls. Its screenshots are ignored
local artifacts under `test-results/web005-*.png`, because the live world includes real portraits.
