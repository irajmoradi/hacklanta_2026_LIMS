# FIX-018: disaster repair stability

Branch: `fix/FIX-018`.
Implementation commits: `5a7054a` (database clock and regression coverage),
`76cefdf` (historical migration test isolation). This report is committed separately.

## Root causes and changes

`disasters.start()` and `disasters.sync()` used Python `datetime.now(UTC)`, while
`check_ins.created_at` defaults to PostgreSQL `now()`. Comparing timestamps from
these different clocks made contribution eligibility depend on clock skew and
request timing. An application clock ahead of PostgreSQL excluded valid new
check-ins; a clock behind it could admit old check-ins or delay outbreak expiry.
There is also a same-transaction problem: a check-in can start a disaster, and
PostgreSQL `now()` is the transaction start, earlier than the subsequent Python
wall-clock read. Replacing Python time with PostgreSQL wall-clock time would not
fix that case.

Both disaster time reads now use PostgreSQL's transaction timestamp, matching
check-in creation. No sleeps, tolerance windows, retries, contract changes, or
changes to the original repair assertions were introduced. Four deterministic
regression cases cover application clocks seven days ahead/behind, contributions
within the disaster-start transaction, rejection of historical check-ins, the
inclusive 48-hour boundary, outbreak expiry, and late repair. All four failed
against the original implementation and pass with the fix.

Shuffling exposed a second, independent source of shared state:
`test_studying_migration_is_repeatable_and_preserves_preferences` committed migration
021, replacing the current idle-activity constraint from migration 046 with its
older definition. The fixture's TRUNCATE reset rows but retained that DDL, causing
later `gaming` and `working_out` cases to fail. The historical migration test now
checks preference preservation inside a transaction that always rolls back,
preserving the current schema for subsequent tests.

## Validation

Commands ran from `apps/api` using
`C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe` as `python`,
with `VILLAGE_ENV_FILE=C:/Users/mourn/Downloads/hacklanta/.env` read at runtime.
Database tests use isolated schemas in `village_test`; providers are mocked.
No live demo mutation or paid generation was performed.

| Command / stage | Exit | Result |
| --- | --- | --- |
| Before fix: `python -m pytest -q tests/test_api007.py::test_failure_fog_and_linked_repair tests/test_api009.py::test_penalties_recover --tb=short` | 1 | 15 passed, 2 failed (`blight-village_project`, `blight-weekend_build`). |
| Before fix: `python -m pytest -q tests/test_fix018.py --tb=short` | 1 | All 4 deterministic regression cases failed. |
| After clock fix: `python -m pytest -q tests/test_fix018.py tests/test_api007.py::test_failure_fog_and_linked_repair tests/test_api009.py::test_penalties_recover tests/test_feat012.py --tb=short` | 0 | 30 passed. |
| Initial `python -m scripts.verify_repair_stability` | 1 | Seed 18: 447 passed, 3 skipped. Seed 19: 445 passed, 3 skipped, 2 idle-activity failures; runner stopped. |
| After isolation fix: `python -m pytest -q tests/test_web017.py::test_studying_migration_is_repeatable_and_preserves_preferences tests/test_web017.py::test_idle_activity_round_trip tests/test_web024.py --tb=short` | 0 | 10 passed, explicitly placing the old migration before current activity tests. |
| Final `python -m scripts.verify_repair_stability` | 0 | Five consecutive full-suite passes, detailed below. |
| `python -m ruff check app/disasters.py tests/test_fix018.py scripts/verify_repair_stability.py tests/test_web017.py` | 0 | All checks passed. |
| `git diff --check` | 0 | Clean. |

Final sequence, with no code changes between runs:

| Shuffle seed | Passed | Skipped | Failed | Exit | Seconds |
| --- | --- | --- | --- | --- | --- |
| 18 | 447 | 3 | 0 | 0 | 304.97 |
| 19 | 447 | 3 | 0 | 0 | 284.88 |
| 20 | 447 | 3 | 0 | 0 | 294.55 |
| 21 | 447 | 3 | 0 | 0 | 295.56 |
| 22 | 447 | 3 | 0 | 0 | 301.88 |

`pytest-randomly` was unavailable. The committed runner uses a local seeded
collection-shuffle hook and a fresh Python process for each full suite. It stops
on the first failure; it does not retry. The initial sequence was restarted only
after correcting the independently discovered DDL leak.

## Changed files

- `apps/api/app/disasters.py`: use database transaction time.
- `apps/api/tests/test_fix018.py`: deterministic clock and window regressions.
- `apps/api/tests/test_web017.py`: roll back historical migration DDL.
- `apps/api/scripts/verify_repair_stability.py`: repeatable shuffled full-suite runner.
- `apps/api/FIX-018-REPORT.md`: this report.

## Teammate reproduction

From `apps/api` in PowerShell:

```powershell
$env:VILLAGE_ENV_FILE='C:/Users/mourn/Downloads/hacklanta/.env'
$python='C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe'
& $python -m pytest -q tests/test_fix018.py --tb=short
& $python -m scripts.verify_repair_stability
```

Use `python -m scripts.verify_repair_stability --seed 19` for one full shuffled run.
The full five-run verification took approximately 25 minutes.

Blockers: none. Proposed contract changes: none. UI/screenshot: not applicable.
All changed files are within `apps/api/**`; no secrets were copied into files.
