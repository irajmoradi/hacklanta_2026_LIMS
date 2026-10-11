# API-006 final report

Branch: `api/API-006` (the assigned current branch).
Implementation milestone: `a9d3a96` — iMessage commands, delivery hardening and isolated harness.
This report, runbooks and contract proposal are committed in a subsequent documentation milestone.
No push or merge was performed.

## Delivered

- Boot configuration validation, runtime external-env loading, JSON logs without sensitive
  payloads, exponential API-down backoff, nonoverlapping bounded outbox claims and shutdown.
- Shared, testable Spectrum handlers: ignore outbound echoes/non-text, dedupe message IDs,
  transactional API receipt replay, authenticated same-origin voice assets via `voice()`,
  thumbs-up after successful check-ins, and STOP opt-out with queued-message cancellation.
- All requested inbound commands. Free text gets an AI-labeled sender-context response without
  creating an event; explicit prayers retain the event path. Unknown/ambiguous phones and
  users without membership get generic invite guidance. Tests mock all model calls.
- Membership `joined_at` projection/order, portrait placeholder projection and photo-job
  metadata, plus additive idempotent migration 005 in UTF-8 without BOM.
- A local harness using the production handlers, fake Spectrum stream, new synthetic user,
  real temporary-port API, isolated test tables and assertions for check-in, XP and sent outbox.

## Files changed

Under `apps/api/`:

- `app/main.py`, `app/domain.py`, `app/models.py`, new `app/inbound.py`.
- `migrations/005_imessage.sql`, `scripts/simulate_api006.py`, `tests/test_api006.py`.
- `README.md`, `API-006-REPORT.md`.

Under `apps/imessage/`:

- `src/index.ts`, new `src/agent.ts`, `src/config.ts`, `src/agent.test.ts`.
- `scripts/simulate.ts`, `package.json`, `tsconfig.json`, `README.md`.

Also `packages/contracts/proposals/API-006.md`, explicitly allowed by the task.
No shared contract/schema, root/environment files, web/GPU code or dependency locks changed.
No secrets, real-person assets, model weights or sensitive logs were written or committed.

## Verification

Commands below ran from repository root, with
`$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'` for database-backed commands.
Credentials were loaded at runtime only. Final checks all exited **0**:

| Command | Result |
| --- | --- |
| `bun install --cwd apps/imessage` | 120 packages; existing lock preserved |
| `python -m uv run --directory apps/api pytest -q` | **115 passed in 26.89s** |
| `bun test --cwd apps/imessage` | **9 passed, 42 assertions** |
| `bun run --cwd apps/imessage typecheck` | TypeScript clean, including simulation |
| `python -m uv run --directory apps/api ruff check app scripts tests` | All checks passed |
| `python -m uv run --directory apps/api ruff format --check app scripts tests` | 38 files formatted |
| `bun run --cwd apps/imessage simulate` | PASS on **58828**: check-ins=1, XP=10, outbox=sent, receipt=1 |
| `git diff --check` | Clean |

The simulation also passed earlier on port 52078. Both runs cleaned up their own server/schema.
The shared listener on 8010 was untouched. Pytest uses the existing random-schema isolation in
`village_test`; the harness creates its own schema and new `Simulation Friend` user with test
phone `+15555550101`. It never edits seeded villagers' phone numbers. Migration application
runs twice to verify idempotency. No paid generation, live iMessage or Solana action occurred.

API tests cover concurrent identical-message replay, ID conflicts, status/progress XP and goal
linking, empty/long commands, sender-week context and fallback, explicit prayer effects,
unknown phone privacy, service auth, STOP cancellation including claimed items, bounded
claims, membership ordering and manifest flag precedence. Bun tests use fake Spectrum spaces
and message streams, including transient API recovery, concurrent dedupe, echo suppression,
reaction failures, authenticated voice content, ack retry without duplicate sends, failed audio,
external asset rejection, config validation and poll overlap prevention.

Initial tests failed for two test assumptions: fixture data already contained a Mayor event,
and Spectrum voice returns a builder whose content must be inspected after `build()`. Both
were corrected. Initial Ruff line-length failures were fixed. No unresolved failures remain.

Screenshot: not applicable (API/messaging task, no UI changes).

## Teammate trial

1. Install API dependencies with uv and run `bun install --cwd apps/imessage`.
2. Set the runtime `VILLAGE_ENV_FILE` above and run
   `bun run --cwd apps/imessage simulate`. This needs local PostgreSQL/TimescaleDB but no
   Photon/LLM credentials and automatically chooses a temporary port.
3. For integration against a development deployment, apply migration 005 using
   `python -m uv run --directory apps/api python scripts/migrate.py` with that deployment's
   environment. Do not direct the isolated harness at a production database.
4. Start the API on an available port, e.g. 8016, with `MAYOR_SCHEDULER=0`, `DEMO_AUTH=1`
   for demo headers, and on Windows `UVICORN_LOOP=app.runtime:selector_loop`:
   `python -m uv run --directory apps/api uvicorn app.main:app --host 127.0.0.1 --port 8016`.
5. Set `VILLAGE_API_URL=http://127.0.0.1:8016/api`. `bun run --cwd apps/imessage start`
   connects to real Spectrum and delivers real messages; use it only for the intended live
   trial with configured project credentials and consenting/allowlisted recipients.
   Available commands are documented in `apps/imessage/README.md`.

## Choices, blockers and contract proposals

No implementation blocker. Migration 005 deployment and real Spectrum transport validation
remain integration steps; neither was performed on the shared main deployment.

- `STOP` uses the existing authenticated inbound route rather than a second opt-out route.
  Proactive consent is disabled; later explicit inbound commands still receive replies.
- `status` calls the highest current XP balance the village leader (ties by user ID). Commands
  use the oldest joined village. Progress requires an active goal in the current UTC week.
- Optional provider-prefixed IDs preserve old callers while enabling durable effect dedupe.
  Legacy callers without IDs can still repeat effects. Receipts are retained indefinitely.
- Initials are placeholders. A stored manifest's explicit boolean takes precedence over the
  new user column; operators/seeders can mark stand-in photos with that column. New photo
  jobs carry the column as input metadata. Bridge propagation is proposed, outside scope.
- External delivery remains at-least-once. Memory prevents repeats on an ordinary ack retry,
  but process crashes, expired leases and uncertain provider sends can duplicate delivery.
  STOP cannot retract a send already in flight. The serial inbound loop queues behind API
  outages; backoff caps at 60 seconds. An in-flight HTTP request may take up to 90 seconds.
- `packages/contracts/proposals/API-006.md` describes inbound request/response additions,
  command semantics, bounded outbox claims, joined_at, placeholder metadata, migration tables,
  and future claim fencing/renewal/transport idempotency proposals.

Applied the installed Spectrum skill at `C:/Users/mourn/.agents/skills/spectrum/SKILL.md`;
checked the actual locked 12.10.1 types for SDK compatibility. No messaging tool was used to
contact any person.
