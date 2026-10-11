# API-004 final report

Branch: `api/API-004` (the assigned current branch).
Implementation milestone: `12f3c95` — voice onboarding, expression jobs and cost guards.
This report, README and web route proposal are committed in the following documentation
milestone. No push or merge was performed.

## Delivered

- Consent-gated ElevenLabs IVC multipart creation, one clone per user under a row lock,
  consent timestamp/text version, request-shape validation, sanitized failures, deletion
  and stock-voice fallback. Tests use synthetic bytes and a mocked provider, never real voices.
- Automatic CV-002-compatible expression jobs for voice lines; authenticated polling reads
  bridge job results. Mayor voice paths enqueue for the target's LAM head when present.
- Self-profile PATCH with E.164 validation, nullable phone clearing, per-village role/current
  auditor metadata, private self-only voice fields, PATCH/DELETE CORS support.
- Server-side normalization of photos over 10 MiB or 4096 px, deterministic deduplication,
  orientation handling, and retained compressed-size/decompression-bomb safety limits.
- QA/inactive-village scheduler guards and global PostgreSQL hourly LLM reservations covering
  physical OpenRouter/Gemini calls, repairs, fallbacks and vision, with throttle agent logs.
- Explicit optional recap narration using the Mayor stock voice; fixture/audio behavior
  remains usable without a GPU or generated head. No existing provider smoke was run.

## Files changed

All implementation files are under `apps/api/`:

- `app/assets.py`, `app/auditor.py`, `app/auth.py`, `app/budget.py`, `app/competitions.py`,
  `app/config.py`, `app/main.py`, `app/mayor.py`, `app/models.py`, `app/scheduler.py`, `app/voice.py`.
- `migrations/004_voice_budget.sql` (additive, idempotent, UTF-8 without BOM).
- `tests/test_api.py`, `tests/test_api004.py`, `tests/test_providers_auth.py`.
- `scripts/smoke_api004_http.py`, `README.md`, `API-004-REPORT.md`.

Also `packages/contracts/proposals/API-004.md`, explicitly allowed by the task. No root files,
other apps, shared schema/api.md, environment files, dependency locks, real-person assets,
weights or sensitive logs changed. Secrets were loaded only at runtime through
`VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env`.

## Verification

Commands ran from repository root. All final checks below exited **0**:

| Command | Result |
| --- | --- |
| `python -m uv run --directory apps/api pytest -q` | **96 passed in 41.02s**, including all original 80 tests |
| `python -m uv run --directory apps/api ruff check app scripts tests` | All checks passed |
| `python -m uv run --directory apps/api ruff format --check app scripts tests` | 31 files formatted |
| `git diff --check` | Clean |
| `python -m uv run --directory apps/api python scripts/smoke_api004_http.py` | Temporary port **56203**, DB up, build API-004, 44 OpenAPI paths |

Pytest uses an isolated random schema in the separate `village_test` database and mocks all
paid providers. Migration application is exercised twice for idempotency. HTTP smoke only
reads health/OpenAPI with scheduling disabled and terminates its own hidden subprocess.
The shared deployment on port 8010 was untouched; no shared production migration was applied.
No real ElevenLabs clone/TTS, Gemini or OpenRouter request was made.

New tests cover concurrent clone creation (one provider call, second request 409), consent,
audio limits/MIME, provider shape/errors, deletion/repeated deletion/failure preservation,
profile validation and CORS, role/auditor projection, expression input and polling/access,
pending/failed GPU jobs, stock recap and nudge target behavior, no-head narration, both photo
resize triggers with deduplication, QA/inactive skips, concurrent global budget limits/hour
rollover, zero-budget blocks across all adapters, repair accounting and suppressed fallback.

Initial pytest exited nonzero for a circular import, subsequently fixed, then for updated
self-profile/build assertions and an overly broad route-count test edit, also fixed.
Initial Ruff checks found import/formatting issues; final checks are clean. No unresolved
test failures remain. Screenshot: **not applicable (API-only)**.

## Teammate trial

1. Keep `VILLAGE_ENV_FILE` pointed to the existing external environment. Use a development
   database and run `python -m uv run --directory apps/api python scripts/migrate.py`;
   seed with `scripts/seed.py` if needed. The integrator must apply migration 004 to the
   shared deployment before routing traffic to this build.
2. In `apps/api`, set `DEMO_AUTH=1`, `MAYOR_SCHEDULER=0`, and on Windows
   `UVICORN_LOOP=app.runtime:selector_loop`. Start
   `python -m uv run uvicorn app.main:app --host 127.0.0.1 --port 8014` on an available port.
   Open `/docs` with `X-Demo-User: 13370000-0000-4000-8000-000000000001`.
3. GET/PATCH `/api/me`; initialize the existing `/weekly/current` route and inspect auditor
   flags. Upload a synthetic photo over 4096 px to test normalization without the worker.
4. Run `pytest -q tests/test_api004.py` for provider-mocked clone, voice/expression, recap
   and budget checks. Real voice generation requires an explicit consenting user action;
   no real clone smoke is part of this handoff.
5. For authorized voice playback, POST `/api/voice/lines`, retain `id` and poll
   `/api/voice/lines/{id}`. With the bridge online and shared asset storage, `expr_url`
   becomes available. Without it, audio remains playable and the expression job stays queued.

## Choices, blockers and proposed contract changes

No implementation blocker. Deployment migration, real consented cloning, and GPU execution
remain integration steps, not claims made by this verification. The web-facing route list,
consent text, request/response shapes, error codes and proposed shared-schema additions are
in `packages/contracts/proposals/API-004.md`.

Reasonable task choices: recap `voice=true` is a query parameter; recap's expression target
is the requesting member; nudge's expression target is the nudged member. `/me` only reads
an already initialized auditor assignment. Voice memos have a 10 MiB per-file cap and are not
stored locally. Large photos become JPEGs (including originally transparent images).
Hourly budgets use clock-hour windows, count failed physical attempts, and never refund on
request rollback. Human mutation events, rather than agent/GPU output, keep villages active.

Provider creation and database commit cannot be atomic. A crash after provider creation can
leave an orphan clone requiring provider-side reconciliation; there are no automatic paid
creation retries. Recap TTS errors return 502/503 and roll back that recap request; unvoiced
recaps remain available. Throttling preserves existing conservative model fallback behavior.
No GPU bridge changes or Solana transactions were needed.
