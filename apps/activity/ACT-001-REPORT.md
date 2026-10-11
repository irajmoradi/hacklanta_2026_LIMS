# ACT-001 completion report

Branch: `act/ACT-001`. Implementation milestone: `de5ad77`. The following verification
commit contains this report, the isolated DB test, and the Windows event-loop correction;
use `git log -2 --oneline -- apps/activity` for both commit IDs.

All changes are under the authorized `apps/activity/` path:

- `pyproject.toml`, `uv.lock`, `.gitignore`: independent Python 3.12/uv environment.
- `sql/001_activity.sql`: idempotent account, preference, signal hypertable and Steam counter SQL.
- `config.py`, `core.py`, `repository.py`: runtime env loading, aggregation, transactional writes.
- `providers.py`, `main.py`, `link.py`: read-only collectors, dry-run, consent and opt-out CLI.
- `tests/conftest.py`, `tests/test_activity.py`, `tests/test_database.py`: fakes and opt-in DB tests.
- `README.md`, this report: run instructions, choices, integration handoff.

Validation from `apps/activity`:

| Command | Result |
| --- | --- |
| `python -m uv sync` | exit 0; Python 3.12.15 environment installed |
| `python -m uv run ruff check .` | exit 0; all checks passed |
| `python -m uv run pytest -q` (fake suite before DB test added) | exit 0; 16 passed |
| `python -m uv run pytest -q --tb=no tests/test_database.py` with `ACTIVITY_TEST_DB=1` | exit 0; 1 passed |
| `python -m uv run pytest -q --tb=no` with `ACTIVITY_TEST_DB=1` | exit 0; 17 passed |
| `python -m uv run main.py --dry-run` with supplied `VILLAGE_ENV_FILE` | exit 0; configuration loaded and client closed without network/DB |
| `git diff --check` | exit 0 |

Earlier verification found and fixed a Spotify fake missing `session_id`, lint line-length
issues, and psycopg's incompatibility with Windows' default Proactor loop. The final test
run has only discord.py's upstream Python 3.12 `audioop` deprecation warning. Dry-run also
reports optional voice playback libraries absent; this service never captures/plays audio
and voice-state metadata needs neither library.

DB verification used the existing local TimescaleDB server with a temporary, randomly
named schema containing synthetic data. It applied the migration twice, verified the
hypertable, checked one feed event per village, tested opt-out and opt-in baseline resets,
and forced a failed event insert to prove signal/counter rollback. The temporary schema
was dropped. No migration was applied to the application's public schema.

To try: follow `README.md`, have the integrator apply the migration, run `uv sync --locked`
and `uv run main.py --dry-run`, then link an existing user with `--consent`. Start
`uv run main.py` only when live observation is desired. No long-running collector was
started or left running during this task. Screenshot: not applicable (no UI).

Choices/limits: opt-out suppresses all collection and feed writes, separate from Mayor
messaging preferences; CLI ownership checks are operational, not OAuth; in-memory Discord
sessions are discarded across disconnects/restarts, so these may undercount. Steam uses
durable lifetime deltas and establishes baselines without historical import. Both providers
can observe the same game and are explicitly distinguished in payloads. All external text
is marked untrusted and must stay data when consumed by the Mayor.

Deployment prerequisites: integrator migration application; Discord privileged intents
enabled by the owner if needed; a Steam API key for Steam collection (absent from the
supplied runtime environment). Live gateway auth and Steam API calls were intentionally
not exercised. No implementation blockers remain.

Proposed contract changes: none required for ingestion. Optional integrator follow-up:
document the `external_activity` payload and expose authenticated preference/account-link
management in the API/UI. Shared contracts, root files, and other apps were not edited.
