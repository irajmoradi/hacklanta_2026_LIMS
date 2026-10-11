# API-002 completion report

Branch: `api/API-002` (the assigned current branch).
Implementation: `acbbf9d` — v2 agents, vision review, durable delivery.
Validation/runbook: `32e94d2` — asynchronous review/lifespan tests and v2 operations.
This report is committed separately. No push or merge performed.

## Delivered

- Configurable OpenRouter/Gemini JSON adapter, one attempt per provider then canned output,
  empty-content/schema rejection, disabled OpenRouter reasoning, actual model provenance.
- Post-response Gemini vision auditor, stored verdicts and activity, review route and CheckIn
  projection, evidence ownership checks, progress XP hold and owner-only once-only override.
- Lifespan scheduler, LLM nudge/event/none decisions with reasons, most-active-friend nudges,
  consent/roast handling, UTC global three-message cap, six-hour scheduled event cooldown,
  optional nudge voice, event announcements, cross-process tick locking, agent log.
- Durable global check-in keys with pre-v2 replay compatibility; goal status, owner-audited
  event completion with per-recipient XP ledger keys, leased outbox claims and sent/failed
  acknowledgements, service assets, existing earliest-joined-village inbound mapping.
- Port 8010 runbook and explicit two-provider smoke. No shared contracts or launcher edits.

## Files changed

All under `apps/api/`:

- `app/auditor.py`, `app/config.py`, `app/domain.py`, `app/main.py`, `app/mayor.py`,
  `app/models.py`, `app/scheduler.py`.
- `tests/conftest.py`, `tests/test_api.py`, `tests/test_providers_auth.py`, `tests/test_v2.py`.
- `scripts/smoke_v2.py`, `scripts/smoke_providers.py`, `README.md`, `API-002-REPORT.md`.

No environment files, credentials, real-person images/voices, weights or sensitive logs were
written or committed. Credentials loaded at runtime via `VILLAGE_ENV_FILE` from the supplied
external root environment. Test assets are synthetic and stay in ignored API runtime storage.

## Verification (2026-10-10)

Commands ran from repository root using `--directory apps/api`; equivalent commands can run
from `apps/api` without that option. Each final check below exited 0:

| Command | Result |
| --- | --- |
| `python -m uv run --directory apps/api pytest -q` | **59 passed in 12.37s** |
| `python -m uv run --directory apps/api ruff check app scripts tests` | All checks passed |
| `python -m uv run --directory apps/api ruff format --check app scripts tests` | 22 files formatted |
| `git diff --check` | Clean |
| `python -m uv run --directory apps/api python scripts/smoke_v2.py --allow-paid` | OpenRouter JSON SUCCESS; Gemini vision SUCCESS, verified |
| Temporary Uvicorn subprocess + `GET /api/health` | SUCCESS; port 59545, db=up, build=API-002 |

The smoke made exactly one real OpenRouter request and one real Gemini vision request on a
red rectangle rendered in memory. It performed no database writes or ElevenLabs requests.
All pytest provider calls were mocked; tables were isolated in a random schema of `village_test`.
No production database truncation or schema modification was performed by this task.

Runtime smoke used `.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1
--port 59545`, with `UVICORN_LOOP=app.runtime:selector_loop` and `MAYOR_SCHEDULER=0`.
The runner asserted `ok=true` and build API-002 and terminated its own process afterward.
The initial 8010 preflight exited 1 because the port was already occupied; no existing process
was stopped. Initial pytest exited 1 solely for the old 23-path assertion (v2 has 30 paths).
Initial lint found formatting/line-length issues; these were fixed before the final clean checks.

Tests include both provider fallback directions and empty content; every review verdict,
withholding, duplicate awards and unauthorized overrides; response-before-model timing and
late-model/owner-override race; concurrent completion; scheduler idle/consent/roast/daily
limits, concurrent ticks, event cooldown and none; startup/cancellation; concurrent outbox
claims, lease expiry, authenticated audio, sent and terminal failure acknowledgements.

Screenshot: not applicable (API-only task).

## Teammate trial

Follow `README.md`, retain runtime `VILLAGE_ENV_FILE`, and start on port **8010** when available
(the shared launcher is `ops/run_api.sh`). For manual testing set `MAYOR_SCHEDULER=0`;
set it to 1 to enable autonomous decisions, with default tick interval 300 seconds.
Open `/docs`, use `X-Demo-User: 13370000-0000-4000-8000-000000000001` with `DEMO_AUTH=1`.
Seed village: `13370000-0000-4000-8000-000000000000`.

1. Upload synthetic evidence under `/api/villages/{vid}/evidence`.
2. POST a progress check-in with returned `evidence_asset_id` and a fresh UUID key.
3. Poll `/check-ins/{cid}/review` and `/agent-log`; replaying the check-in adds no XP.
4. As owner, POST `/check-ins/{cid}/review/override` with `{reason:"Verified in person"}`.
5. Complete an event with `{user_ids:["<member UUID>"]}`; retry awards zero additional XP.
6. Use service-key outbox GET to claim messages, then acknowledge actual transport outcomes.

## Choices, limits, and proposed contract changes

No blocker to task acceptance. The existing listener on 8010 was left intact. GPU processing,
real Auth0 login and live iMessage transport were not exercised; fixtures work without them.

- Progress with evidence holds all 25 XP while pending, suspicious, rejected or error. Status
  XP remains 10/day; progress without evidence preserves v1 behavior. Override approves with
  owner provenance and a reason. Document this policy, the override body/response, and null
  pending reviews in the shared contract.
- Global key uniqueness follows the supplied `check_in_keys` schema. A cross-user/village
  collision returns 409. Document UUID-style keys rather than user-scoped retry strings.
- Scheduler defaults on for demo/dev (`DEMO_AUTH=1`), off otherwise. First tick is delayed;
  no autonomous calls occur during tests/smoke. Explicit prayers/recaps are not blocked by
  the scheduler event cooldown. Voice defaults off. Error text is sanitized before logging.
- Leased delivery is at-least-once. The contract lacks claim tokens and transport idempotency
  keys; propose both to reject stale acknowledgements and avoid duplicates after a lost ack.
  Failed deliveries are terminal; define a separate retry policy if desired.
- The contract lacks inbound provider message IDs. Repeated inbound deliveries can create
  separate check-ins, though daily status XP cannot duplicate; propose a provider message ID.
- Review tasks run after response commit. Process termination before completion leaves a
  pending review recoverable by original-key/evidence replay or owner override. A durable
  review-job queue would enable automatic crash recovery without relying on a caller retry.
- Event completion accepts additional recipients after completion, awarding each only once;
  failed/expired events cannot complete. No automatic destructive penalties are applied.

Shared contracts were read only; proposals above are for the integrator.
