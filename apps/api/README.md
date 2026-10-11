# Village API

FastAPI implementation of `packages/contracts/api.md`. Requires Python 3.12 and PostgreSQL
with TimescaleDB. Source, tests, dependency lock, and operational scripts live entirely in
`apps/api`; the shared schema is applied without changes, followed by additive API migrations.

## Run

From `apps/api`, with `VILLAGE_ENV_FILE` pointing at the existing root environment file:

```powershell
python -m uv sync --python 3.12
python -m uv run python scripts/migrate.py
python -m uv run python scripts/seed.py
# Windows: Psycopg async requires a Selector loop. Uvicorn reads this environment setting.
$env:UVICORN_LOOP = 'app.runtime:selector_loop'
python -m uv run uvicorn app.main:app --no-proxy-headers --port 8010
```

On Linux/macOS the same commands work without the `UVICORN_LOOP` assignment. Alternatively,
pass `--loop app.runtime:selector_loop` explicitly on Windows. `--host 127.0.0.1` is the default.
OpenAPI is at `http://127.0.0.1:8010/docs`. CORS allows `http://localhost:5173`.

Environment loading preserves already-set variables and supports both Windows paths and
Git Bash `/c/...` paths. Without `VILLAGE_ENV_FILE`, it reads repository-root `.env`.
Nothing writes or copies environment values. On Windows only, a DB host of `localhost` uses
IPv4 to avoid Docker Desktop's unresponsive IPv6 port forwarding.

Required: `DATABASE_URL`. Supported: `DEMO_AUTH`, `SERVICE_KEY`, `AUTH0_DOMAIN`,
`AUTH0_AUDIENCE`, `GOOGLE_API_KEY`, `GOOGLE_GENAI_USE_VERTEXAI`, `ELEVENLABS_API_KEY`,
`GPU_WORKER_URL`, `ASSET_DIR`, `VILLAGE_BUILD`. Demo auth defaults off unless `DEMO_AUTH=1`.
Vertex express defaults on. GPU health defaults to `http://localhost:8100/health`.
Asset storage defaults to repository-root `data/assets`; API and GPU worker must share
the same directory (set `ASSET_DIR` explicitly when running separate worktrees).

## Demo identities

Village: `13370000-0000-4000-8000-000000000000`, name **Hacklanta Crew**, seed **1337**,
invite **HACKLANTA**. Seed is additive and idempotent; it never resets existing progress.

| Name | User ID | House slot |
| --- | --- | --- |
| Iraj | `13370000-0000-4000-8000-000000000001` | 0 |
| Lance | `13370000-0000-4000-8000-000000000002` | 1 |
| Stefanny | `13370000-0000-4000-8000-000000000003` | 2 |
| Maya | `13370000-0000-4000-8000-000000000004` | 3 |
| Dev | `13370000-0000-4000-8000-000000000005` | 4 |

```powershell
curl.exe --fail http://127.0.0.1:8010/api/health
curl.exe --fail -H 'X-Demo-User: 13370000-0000-4000-8000-000000000001' http://127.0.0.1:8010/api/villages/13370000-0000-4000-8000-000000000000
```

Set a weekly goal, post a check-in with a stable `idempotency_key`, then open the feed/shop.
Every actual village mutation creates an activity event in the same transaction. Replays that
change nothing do not create additional events. Auth0 verifies RS256, issuer, audience, expiry,
and required claims through a cached JWKS client; new verified identities are provisioned by
`(iss, sub)`. Auth0 subjects need not be UUIDs.

## Transaction and integration choices

- XP and purchase operations lock the membership row, commit before sending the response,
  and use globally unique ledger source keys. Check-in retry keys are globally unique.
  Status XP is limited to one award per UTC date; goal XP to one award per UTC Monday week.
  `check_in_keys` reserves durable keys independently of the hypertable timestamp.
  Reusing another user/village's key returns 409; use client-generated UUID keys.
- Purchasing equips an item immediately because the contract has no equip route. House
  upgrades update `house_level`; repeat purchases return 409. Inventory is an array of
  `{item_id,equipped}` objects. Level uses the current ledger balance per the contract.
- `GET /me` returns self-only profile/phone/voice-consent fields and per-village roles.
  `PATCH /me` edits name, phone and message/roast preferences. Public village responses
  never expose phone numbers, voice settings, auth subjects, or delivery metadata.
- `LLM_PROVIDER=openrouter|gemini` selects the first provider (default OpenRouter).
  `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` configure OpenRouter (default
  `deepseek/deepseek-v4-flash`). OpenRouter requests JSON with reasoning disabled.
  OpenRouter allows one schema-repair retry; Gemini makes one attempt, then canned output
  is used if both providers fail. Both
  providers use the same Pydantic schemas. Model provenance records the provider that
  actually succeeded. Untrusted names, activity, evidence and inbound messages are data.
- `MAYOR_SCHEDULER=1` enables periodic decisions; default on when `DEMO_AUTH=1`, off otherwise.
  `MAYOR_TICK_SECONDS` defaults to 300; first tick occurs after this delay. Set the scheduler
  to 0 for offline/manual demos. Each enabled tick may incur provider charges. A database
  advisory lock and persisted tick log prevent duplicate concurrent worker decisions.
  The Mayor chooses nudge/event/none with a reason; `/villages/{vid}/agent-log` exposes it.
  Nudges target members idle for 24 hours, use the most active other friend over seven days,
  respect `roast_ok` and `agent_msgs_ok`, and are labeled AI. The global per-user cap is
  three messages per UTC day (including explicit nudges and event announcements).
  Scheduled events respect a six-hour village cooldown including explicitly created events.
  Explicit member prayer/recap requests remain available during that cooldown.
- `MAYOR_VOICE=1` adds voice to nudges (default off). Voice failures preserve the text.
  Custom voices require `voice_consent=true`; otherwise stock voices are used.
  Missing TTS configuration returns 503; provider failure returns 502. Ordinary reads
  do not generate assets; the outbox GET only claims already-created delivery jobs.
- A check-in can attach its owner's uploaded `evidence_asset_id` from the same village.
  A background task reviews the image, goal and text with Gemini vision after the response
  commits. CheckIn includes nullable `review`; the review route returns null while pending.
  Evidence-backed progress withholds all 25 XP until verified or overridden. Suspicious,
  rejected, unavailable/error and pending reviews award no progress XP; status XP remains
  10 once per UTC day. Progress without evidence retains the existing 25-XP behavior.
  `POST /villages/{vid}/check-ins/{cid}/review/override` accepts `{reason}` from a village
  owner and returns `{review,xp_awarded}`. It records owner provenance and releases XP once.
  Background results cannot overwrite an owner override. Reviews are not automatically
  retried: a crash before review completion leaves it pending; replay the check-in with its
  original key/evidence to enqueue again, or use an owner override.
- Goal status accepts `done|missed` from its owner or village owner. Event completion
  accepts `{user_ids:[...]}` from a village owner, validates all memberships atomically,
  and awards once per user via `event:<event id>:<user id>`. Completed events may add other
  eligible recipients; retries cannot double-award. Failed/expired events cannot complete.
  Proposed penalties are never executed automatically.
- Uploads accept verified JPEG/PNG/WebP up to 10 MiB. Only the owner can upload a photo or
  inspect its job; consent is mandatory. Job input contains `asset_key`, `photo_asset_key`
  (same key), `user_id`, `sha256`, and `consent`. Jobs begin at `segment/queued` and use a
  deterministic hash for duplicate uploads. The worker owns later stages and manifests.
  Presets remain available without a worker or generated files.
- Raw `uploads/<user>/...` are private to the owner. `evidence/<village>/<user>/...` requires
  village membership; `voice/<user>/...` and `avatars/<user>/...` require a shared village.
  Other keys require an exact authorized avatar-manifest URL. Asset paths are confined to
  `ASSET_DIR`, including symlinks. Browser image/audio elements should use an authenticated
  fetch and object URL since ordinary element URLs cannot carry `X-Demo-User`/Bearer headers.
- Internal endpoints require `X-Service-Key`. `GET /internal/outbox` atomically claims
  `mayor_outbox` pending or expired-claim rows for two minutes using SKIP LOCKED. Muted,
  departed, or changed-phone recipients are excluded. `/sent` accepts optional
  `{provider_msg_id}`; `/failed` requires `{error}` and marks terminal failure. Error strings
  are not stored because they may contain secrets. Repeated acknowledgements are harmless;
  failed acknowledgements cannot undo a sent message. Audio URLs use service-authenticated
  `/internal/assets/{key}`. The API queues messages; the iMessage agent performs delivery.
  Phone mapping must be unambiguous and chooses the user's earliest-joined village.
  Claims provide at-least-once delivery, not exactly-once transport: provider-side
  deduplication is still needed after a send succeeds but the acknowledgement is lost.

## Tests and provider smoke

```powershell
python -m uv run pytest -q
python -m uv run ruff check app scripts tests
python -m uv run ruff format --check app scripts tests
```

Tests derive a connection to **village_test** on the same server (or accept
`VILLAGE_TEST_DATABASE_URL` only if its database name is exactly `village_test`). They create
the database if needed and isolate tables in a random schema. Only that schema is truncated
and dropped. **No test deletes or truncates `village`.** The DB role needs CREATE DATABASE
if the test database does not exist. Tests mock external providers, use a Selector loop,
and keep temporary image/audio fixtures under ignored `.runtime/pytest`.

Explicit API-002 smoke (one logical OpenRouter trial, with at most one validation repair,
and one Gemini vision call; no cross-provider fallback or database writes):

```powershell
python -m uv run python scripts/smoke_v2.py --allow-paid
```

The image is a synthetic red rectangle generated in memory. Output reports only validation
success and verdict. `scripts/smoke_providers.py` remains the older explicit Gemini/TTS smoke;
it inserts demo records and writes ignored smoke audio. Neither smoke runs during tests.
`ops/run_api.sh` is the shared launcher for port 8010 and is not modified by this task.

## Proposed contract follow-ups (not edited here)

1. Document owner override `{reason}` / `{review,xp_awarded}`, pending review as null,
   the evidence XP hold/error behavior, and globally unique check-in keys.
2. Add outbox claim tokens for rejecting stale acknowledgements and provider idempotency
   keys for exactly-once delivery. Define retry policy for terminal failed deliveries.
3. Add inbound provider message IDs and optional village IDs. Repeated inbound deliveries
   currently create separate check-ins, but cannot duplicate daily status XP.
4. Consider a durable review-job queue for automatic recovery after an API process crash.
   Current replay/override recovery requires no additional contract tables.

Provider implementation references: [Google Gen AI SDK](https://github.com/googleapis/python-genai),
[ElevenLabs create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
[Psycopg async operations](https://www.psycopg.org/psycopg3/docs/advanced/async.html).

## API-003: weekly auditor and competitions

Apply the additive migration with `python -m uv run python scripts/migrate.py` before starting
this version. It adds ten tables; shared contract tables/columns are unchanged. The development
listener on 8010 belongs to the main checkout. Use **8013** (or another free temporary port)
for this worktree, with `MAYOR_SCHEDULER=0` for manual testing. Do not seed or migrate a shared
production database during tests; pytest uses its own `village_test` schema.

The complete route/body guide and policy choices are in
[`packages/contracts/proposals/API-003.md`](../../packages/contracts/proposals/API-003.md).
GET `/api/villages/{vid}/weekly/current` chooses the auditor; use that identity to request AI
suggestions, submit grades, then finalize. Any member can create a competition; each participant
must explicitly join. Audited entries reuse private evidence uploads and asynchronous Gemini
review. SOL entry and auditor-fee values are recorded intentions only; no chain operations exist.

```powershell
# Read-only HTTP smoke, temporary port selected automatically, no paid calls or DB writes:
python -m uv run python scripts/smoke_api003_http.py
# Exactly five synthetic logical trials; at most one validation repair per trial, no Gemini:
python -m uv run python scripts/smoke_api003.py --allow-paid
```


## API-004 voice onboarding and cost guards

Apply additive migration `004_voice_budget.sql` before running API-004 routes. The migration
runner above includes it. Keep the existing deployment on port 8010 intact during worktree
trials: use port 8014 (or another free temporary port), `MAYOR_SCHEDULER=0`, and a development
database. Use an API-local `ASSET_DIR` for isolated worktree trials; the real GPU bridge and
API must share storage for expression playback.

Full route shapes, consent wording and integration policies:
[`API-004 proposal`](../../packages/contracts/proposals/API-004.md).

- `POST /api/me/voice`: repeated multipart `files` (1?3 audio memos, at most 10 MiB each)
  and `consent=true`. One clone per user, with timestamp/version recorded. No raw memos
  are retained locally. `DELETE /api/me/voice` removes the clone and clears consent.
- `POST /api/voice/lines` queues CV-002 `voice_expr` work and returns a `job_id`.
  Poll `GET /api/voice/lines/{id}` for `expr_url`; audio works with the GPU offline.
- `POST /api/villages/{vid}/mayor/recap?voice=true` explicitly requests stock Mayor narration.
  Voiced recaps/nudges also queue expressions when the target has a LAM head.
- Valid photos over 10 MiB or 4096 px are normalized to bounded JPEGs. The compressed-input
  safety limit is 64 MiB; Pillow decompression-bomb protection remains enabled.
- `LLM_MAX_CALLS_PER_HOUR` (default 60, zero blocks all model calls) is enforced globally
  through PostgreSQL per clock hour, including repairs, fallbacks and vision reviews.
  Throttles appear in the affected village's agent log. The scheduler skips `QA-*` villages
  and villages with no recognized human activity in 48 hours.

Verification without paid providers:

```powershell
python -m uv run pytest -q
python -m uv run ruff check app scripts tests
python -m uv run ruff format --check app scripts tests
python -m uv run python scripts/smoke_api004_http.py
```

The HTTP smoke uses its own ephemeral port, disables scheduling, only reads health/OpenAPI,
and terminates only its subprocess. Tests isolate tables in `village_test` and mock all paid
providers. Do not run a real clone smoke with someone else's voice or without their consent.

## API-006: iMessage integration

Apply additive migration `005_imessage.sql` with the existing migration runner before serving
this branch. It adds durable inbound receipts and portrait placeholder metadata. `/me` now
returns membership join timestamps in join order. Photo job inputs expose
`portrait_placeholder`; stored manifests can set `portrait.placeholder` explicitly, otherwise
the API reads `users.portrait_placeholder` (initials fixtures are always placeholders).

`/internal/inbound` accepts optional `message_id` for transactional replay protection and
returns `processed_checkin` for transport reactions. It supports checkin/progress/goal/status/
pray/STOP commands and sender-context conversation. `/internal/outbox?limit=1` lets the agent
claim only the item it is about to deliver. See `../imessage/README.md` and
`../../packages/contracts/proposals/API-006.md` for behavior and delivery limits.

Run the complete isolated HTTP + fake Spectrum trial from the repository root:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
bun run --cwd apps/imessage simulate
```

This uses a temporary port and random schema in `village_test`, creates a new synthetic user,
checks check-in/XP/outbox effects, and cleans up. It never contacts real iMessage or paid AI.
# API-007 additions

Migration `006_world_group_photo.sql` adds village world progression, persistent building
unlocks, rate-limited Mayor weather, recoverable event penalties and group-photo claims.
Run the migration before deploying this build. The demo story now initializes level 4;
its first replay upgrades older fixtures without resetting progress.

Read `API-007-REPORT.md` and `../../packages/contracts/proposals/API-007.md` for routes,
validation and deployment notes. **Real group-photo uploads require the documented
group-aware GPU bridge change first**; the current bridge selects one person and must
not process group jobs. The API tests use synthetic crops and no live generation.

### API-008 shop and equipment

Apply migration 007 with `python scripts/migrate.py`; it is additive and safe to reapply.
The shop has 22 vetted items, including all ASSET-002 wearable meshes and three talking
styles. Both dogs require ownership of `house_backyard` and the permanent village
`pet_shelter` unlock. A backyard need not remain equipped. Buying still auto-equips,
replacing the previous item in its slot without removing ownership or charging again.
House levels remain progression state; unequipping a house item does not downgrade it.

`POST /api/villages/{vid}/inventory/equip` and `/inventory/unequip` accept
`{"item_id":"hat_festival"}` and operate only on the authenticated member's inventory.
They return `{"equipped":[{"item_id":"hat_festival","slot":"head","asset_key":"hat_festival"}],
"equipped_ids":["hat_festival"]}`. Villager payloads use these same fields. Clients that
previously read `equipped` as strings must switch to `equipped_ids` or consume the objects.
Asset keys are catalog GLB stems; styles and legacy items without meshes use null.

Voice-style IDs are `voice_pirate`, `voice_shakespearean`, `voice_hype_coach`; their enum
values are `pirate`, `shakespearean`, `hype_coach`. Nudges follow the speaking villager's
style. Explicit `/api/voice/lines` requests accept optional `village_id`; otherwise the
single shared village is inferred. With multiple shared villages, omit the ID for plain
speech or supply it to select equipment. Style changes only writing prompts, never the
voice model/clone. Provider failure preserves the original line; no style means no LLM call.

`python scripts/demo_story.py` upgrades an installed story once, preserving XP and later
outfit choices; `--reset` rebuilds only the fixed demo village. Added clothes/styles are
fixture gifts and Stefanny's crown represents her existing weekly win. See
`API-008-REPORT.md` for exact integration shapes and verification.

## FEAT-004: teammate rehearsal

Read secrets at runtime via `VILLAGE_ENV_FILE`. In your API shell set
`DEMO_AUTH=1`, `DEMO_DEBUG=1`, `MAYOR_SCHEDULER=0` (PowerShell:
`$env:DEMO_DEBUG = '1'`), then launch on a free port such as 8014.
Start web with `VITE_DEMO_AUTH=1`, `VITE_MOCK=0`, and `VILLAGE_API_URL=http://127.0.0.1:8014`.
Choose Iraj, Lance, Stefanny, Maya or Mario on first visit. The browser remembers
this choice; Play as and Testing as / switch share it. Open the bug button or
Ctrl+Shift+D for debug controls. `VITE_MOCK=1` also provides an offline simulation.

Debug requires both API flags, a seeded demo member and demo headers; Bearer auth
is rejected. All actions are scoped to the fixed demo village, logged and retry-safe.
Full reset uses the existing story reset in-process and preserves debug receipts.
Weekly reset retains earned XP and activity history; inventory clear restores the
base house. Random events are offline fixtures: no paid model/voice calls.
Festival weather takes precedence over repair fog until toggled off.

Seat heartbeats run every minute and expire after ten minutes. Warnings are advisory;
use one API worker because the registry is process-local and clears on restart.
Run `python -m uv run pytest tests/test_feat004.py -q` from apps/api and
`bunx playwright test --config tests/feat004.config.ts` from apps/web.

### Public deployment cost limits (SEC-001)

Run a single API process with `--no-proxy-headers` so the application can verify
the socket peer. Only the loopback proxy may supply X-Forwarded-For; it must
append or overwrite that header on every public request. Debug actions require
`DEMO_DEBUG=1` and direct loopback access with no X-Forwarded-For.

Daily generation/messaging defaults, environment overrides, endpoint inventory,
and deployment boundaries: [SEC-001](../../docs/security/SEC-001.md).
