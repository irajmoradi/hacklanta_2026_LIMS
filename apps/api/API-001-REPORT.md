# API-001 completion report

Branch: `api/API-001`.

Implementation milestone: `6f4edbb` (`feat(api): implement Village contract and deterministic seed`).
Tests/runtime milestone: `7355d85` (`test(api): validate isolated DB flows and Windows runtime`).
This report is committed separately after those milestones. No push or merge performed.

## Delivered

All 23 contract paths (including all HTTP methods) under `/api`: village creation/join/profile,
goals/check-ins/evidence/feed/shop, Mayor prayer/recap/nudge, voice, avatars/jobs/private assets,
health, identity, and service-key iMessage inbound/outbox/acknowledgement. Includes Auth0 RS256
verification and cached JWKS, membership checks, atomic XP/shop transactions, consent-gated photo
jobs, preset fallbacks, a deterministic additive seed, and opt-in real-provider smoke tooling.

Files changed, all under `apps/api`:

- `.gitignore`, `pyproject.toml`, `uv.lock`, `README.md`, `API-001-REPORT.md`.
- `app/__init__.py`, `config.py`, `runtime.py`, `db.py`, `auth.py`, `models.py`, `domain.py`,
  `main.py`, `mayor.py`, `voice.py`, `assets.py`.
- `scripts/__init__.py`, `migrate.py`, `seed.py`, `smoke_providers.py`.
- `tests/conftest.py`, `test_api.py`, `test_providers_auth.py`.

Shared contracts, task records, root configuration, other apps, and environment files were not edited.
Runtime credentials were read from `VILLAGE_ENV_FILE`; no credentials were copied into project files.

## Verification (2026-10-10)

Commands run from `apps/api` unless stated otherwise:

| Command/check | Result |
| --- | --- |
| `python -m uv sync --python 3.12` | Exit 0; Python 3.12.15 and locked dependencies installed |
| `python -m uv run python scripts/migrate.py` | Exit 0; shared TimescaleDB schema applied unchanged |
| `python -m uv run python scripts/seed.py` | Exit 0; Hacklanta Crew and five villagers seeded |
| `python -m uv run pytest -q` | Exit 0; **41 passed in 10.42s**, no warnings |
| `python -m uv run ruff check app scripts tests` | Exit 0; all checks passed |
| `python -m uv run ruff format --check app scripts tests` | Exit 0; all 18 Python files formatted |
| `git diff --check` | Exit 0 |
| `python -m uv run uvicorn app.main:app --port 8000` with `UVICORN_LOOP=app.runtime:selector_loop` | Startup successful; HTTP requests return 200 |
| `curl.exe --fail --silent http://127.0.0.1:8000/api/health` | Exit 0; `ok=true`, `db=up`, `gpu_worker=down`, build API-001 |
| Authenticated curl for seeded village | Exit 0; Hacklanta Crew, exactly five villagers |
| `python -m uv run python scripts/smoke_providers.py --allow-paid` | Exit 0; **Gemini prayer SUCCESS**, **ElevenLabs short line SUCCESS**; exactly one call each, no content reported |

Tests used the separate **village_test** database on the same PostgreSQL server and an isolated
random schema. They exercised all village-route membership denials; concurrent check-in retries;
UTC daily XP and weekly goal limits; insufficient funds, prerequisites, concurrent purchases and
rollback; feed events; joining; avatar consent/deduplication/private files/path traversal;
authenticated voice; malformed/out-of-bounds LLM output; recap fallback; kind nudges; outbox opt-out
and acknowledgements; Auth0 RSA claim/signature restrictions; CORS; and seed idempotency.
All external paid providers were mocked in tests. `village` was never truncated or wiped.

Initial checks found pytest import/temp-directory setup issues and the Windows Proactor/Psycopg
incompatibility. These were corrected; the final suite and startup checks above passed.
The plain Windows Uvicorn command without a Selector loop failed startup (exit 1), which is why
the runbook specifies `UVICORN_LOOP`. An initial lint command accidentally run at repository root
could not locate Ruff; all final lint commands ran successfully from `apps/api`.

Screenshot: not applicable; this task implements an API, not a UI.

## Try it

Follow `README.md` for installation/startup. With `DEMO_AUTH=1`, use the identities below via
`X-Demo-User`, open `/docs`, and set a goal, check in, buy an affordable item, and read the feed.
Repeated check-ins with the same key return the same record and zero additional XP.
The API remains usable with no GPU worker or generated avatar files.

Village: **`13370000-0000-4000-8000-000000000000`**. Invite: **`HACKLANTA`**. Seed: **1337**.

| User | UUID |
| --- | --- |
| Iraj | `13370000-0000-4000-8000-000000000001` |
| Lance | `13370000-0000-4000-8000-000000000002` |
| Stefanny | `13370000-0000-4000-8000-000000000003` |
| Maya | `13370000-0000-4000-8000-000000000004` |
| Dev | `13370000-0000-4000-8000-000000000005` |

## Remaining integration limits and proposed contract changes

No blocker to the specified core acceptance. GPU processing was not tested because the worker is
offline; queueing and fallback behavior were tested. Live Auth0 login was not exercised; RS256/JWKS
integration and claim validation were tested with local signing keys. Raw private photos and cloned
voices were not used. The two paid smoke calls used a generic prompt and stock voice.

The following shared-contract gaps are documented in `README.md`; no contract changes were made:

1. A durable check-in idempotency key independent of the hypertable timestamp is needed for
   writers outside this API. Current API transactions serialize retries with the member lock.
2. An outbox table with delivery claims and provider message IDs is needed for multiple consumers
   and fully idempotent inbound delivery. Current activity-event outbox supports one consumer;
   repeated inbound check-ins cannot duplicate daily status XP.
3. The check-in request needs an evidence reference to attach the uploaded evidence to a check-in.
4. Challenge completion/goal status actions need explicit routes; reward proposals remain inert.
5. Formalize GPU job-input keys/shared asset paths and service-authenticated voice-asset fetches
   for iMessage attachments. Current asset URLs require user authentication.

Runtime choices: UTC dates/weeks, auto-equip purchases, owner-only raw-photo/job access, shared-village
voice/avatar access, consent required for custom voices, earliest-joined village for inbound iMessage,
and stock presets when generated assets are unavailable. Smoke audio lives only in ignored
`apps/api/.runtime/smoke/assets` to honor this worktree's write scope; normal runtime assets default
to repository-root `data/assets` as requested.
