# API-003 final report

Branch: `api/API-003` (assigned current branch).
Implementation: `239b0ec`.
Contract proposal, build identifier and runtime verification: `3616030`.
This report and a README wording correction are committed separately. No push or merge.

## Delivered

- DeepSeek/OpenRouter concrete JSON examples, bounded shape normalization, one validation
  repair attempt with sanitized errors, and existing provider/canned fallback behavior.
- Weekly random auditor with consecutive-week exclusion, human rubric grading, cached or
  explicitly refreshed AI suggestions using goal/check-in/evidence-review context, once-only
  finalization, 100-XP winner, crown transfer and completion stars.
- Majority emergency vote, duplicate/stale vote protection, random replacement, invalidated
  human grades, and automatically expiring seven-day pet-sad penalty.
- Opt-in audited and friendly competitions, immutable terms and stake/fee intentions,
  private photo ownership checks, asynchronous shared Gemini vision review, authoritative
  human entry decisions, concurrent-safe settlement, points and bounded audited XP awards.
- Ten additive tables, migration runner integration, 21 additional tests, standalone smoke
  scripts and web integration proposal. Existing fixture avatars and offline behavior remain.

## Files changed

Under `apps/api/`:

- `app/competition_models.py`, `app/competitions.py`, `app/weekly.py`.
- `app/config.py`, `app/domain.py`, `app/main.py`, `app/mayor.py`.
- `migrations/003_audits_competitions.sql`.
- `scripts/migrate.py`, `scripts/smoke_api003.py`, `scripts/smoke_api003_http.py`.
- `tests/conftest.py`, `tests/test_api.py`, `tests/test_api003.py`, `tests/test_providers_auth.py`.
- `README.md`, `API-003-REPORT.md`.

Also `packages/contracts/proposals/API-003.md`, explicitly permitted by the task.
No root files, other apps, shared api.md/schema.sql, environment files or dependency locks changed.
No secrets or real-person assets were copied. Credentials were loaded only at runtime using
`VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env`.

## Verification

Final commands ran from repository root, with the runtime environment pointer above:

| Command | Exit | Result |
| --- | --- | --- |
| `python -m uv run --directory apps/api pytest -q` | 0 | **80 passed in 15.80s**, including all original 59 tests |
| `python -m uv run --directory apps/api ruff check app scripts tests` | 0 | All checks passed |
| `python -m uv run --directory apps/api ruff format --check app scripts tests` | 0 | 28 files formatted |
| `git diff --check` | 0 | Clean |
| `python -m uv run --directory apps/api python scripts/smoke_api003.py --allow-paid` | 0 | **5/5, 100%** live DeepSeek trials |
| `python -m uv run --directory apps/api python scripts/smoke_api003_http.py` | 0 | Temporary port **50071**, DB up, build API-003, 42 OpenAPI paths |

Live trial order: pray, recap, nudge, pray, recap. All schema-valid; recaps also passed
name inclusion, recap kind, zero reward and null penalty checks. Trials directly called
OpenRouter so Gemini could not mask failures. There were five logical trials; the bounded
adapter permits at most one repair per trial, and this run did not instrument raw HTTP attempt
counts. No additional paid measurement loops, Gemini vision calls or ElevenLabs calls were run.

Pytest used a random isolated schema in `village_test`, with provider mocks or unavailable-key
fallbacks and synthetic images. Shared production tables were not migrated or seeded.
The migration was applied to public/isolated test schemas only. HTTP smoke performed health
and OpenAPI reads, disabled scheduling, and terminated only its own subprocess. Port 8010
was untouched. Initial test runs exited 1 for the old 30-route assertion and test assumptions
about seeded goals/XP ledger rows; those assertions were corrected. Initial lint formatting
errors were fixed before the final clean checks. No unresolved test failures remain.

Coverage includes strict rubric/reward bounds, schema drift and exactly one repair, cached
suggestions and unavailable providers, role/membership isolation, no self-grading, previous
week rotation, concurrent initialization/finalization, deterministic ties and crown transfer,
empty results, majority/duplicate/stale votes, penalty expiry, goal edit invalidation,
finalized goal freezing, opt-in/photo ownership, all VLM verdicts, decision authorization,
entry replay, concurrent settlement, late mutations, rejected entries and friendly no-XP mode.

Screenshot: not applicable (API-only).

## Teammate trial

1. Keep `VILLAGE_ENV_FILE` pointing to the existing external environment. Choose a development
   database; run `python -m uv run --directory apps/api python scripts/migrate.py` to apply the
   base schema plus additive migration, then seed if needed. The integrator must apply the
   migration to the shared deployment before routing web traffic to this build.
2. In `apps/api`, set `MAYOR_SCHEDULER=0`, `DEMO_AUTH=1`, and on Windows
   `UVICORN_LOOP=app.runtime:selector_loop`. Run
   `python -m uv run uvicorn app.main:app --host 127.0.0.1 --port 8013` (choose another free
   temporary port if needed). Open `/docs`.
3. Seed village is `13370000-0000-4000-8000-000000000000`; use header
   `X-Demo-User: 13370000-0000-4000-8000-000000000001`. Get `/weekly/current`, then switch
   the header to the returned auditor to request suggestions, grade every eligible goal,
   and finalize. Submit the returned `generation` with insufficient votes from other members.
4. Create a competition with title/terms and optional auditor/entry-lamport/fee intents.
   Participants join using their own identities, upload evidence through `/evidence`, then
   submit entries. Poll competition detail for reviews, decide entries as auditor, and settle.
   Friendly mode requires no auditor, fee, stake or photo and awards scoreboard points only.

## Route list for web

Relative to `/api/villages/{vid}`:

| Method | Route |
| --- | --- |
| GET | `/weekly/current` |
| GET | `/weekly/{week_start}` |
| POST | `/weekly/{week_start}/goals/{gid}/suggestion` (`?refresh=true` optional) |
| POST | `/weekly/{week_start}/goals/{gid}/grade` |
| POST | `/weekly/{week_start}/finalize` |
| POST | `/weekly/{week_start}/insufficient` |
| GET, POST | `/competitions` |
| GET | `/competitions/{cid}` |
| POST | `/competitions/{cid}/join` |
| POST | `/competitions/{cid}/entries` |
| POST | `/competitions/{cid}/entries/{eid}/decision` |
| POST | `/competitions/{cid}/settle` |

See `packages/contracts/proposals/API-003.md` for all body/response shapes, table descriptions,
errors, and policy choices. Villager projections gain `star_badges` and `pet_sad`; `has_crown`
uses the latest finalized result. Existing `/agent-log` includes all new AI decisions.

## Blockers, limits and proposed contract changes

No implementation blocker. Shared deployment migration and web UI integration remain the
integrator/web lanes' work. Shared contracts were not edited; the allowed proposal contains
all requested additions and should be merged by the integrator.

Choices: weeks initialize lazily; finalization is explicit (early demo finalization allowed);
human completion flags decide awards; all assigned auditors sit out. Weekly score ties use
ascending UUID; positive competition score ties share winner status. SOL/fee amounts remain
intent-only. Friendly points never become spendable XP.

Small-village limits: fewer than two members or no nonconsecutive candidate produces an
unassigned week; it remains unassigned for that initialized week. A two-person village cannot
reach a strict majority to remove its auditor without the auditor voting, which is disallowed.
Exhausted replacement candidates return 409. These policies are explicit in the proposal.

AI review jobs remain in-process; replay a pending entry before settlement to recover after
process failure. Human decisions work during AI outages. Weekly pre-grade holds a village lock
while generating to serialize votes/goal edits; this can delay those mutations during a slow
provider response. Durable job queues and shorter lock lifetimes are future hardening.
