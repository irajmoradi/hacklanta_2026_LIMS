# WEB-032 demo QA cleanup

Run from `apps/api` with `VILLAGE_ENV_FILE` pointing to the existing root environment file. `Settings.from_env()` reads credentials at runtime; the script does not write or print secrets.

```powershell
$env:VILLAGE_ENV_FILE='C:/Users/mourn/Downloads/hacklanta/.env'
python scripts/cleanup_qa_checkins.py
python scripts/cleanup_qa_checkins.py --apply
python scripts/cleanup_qa_checkins.py
```

Use the API environment's Python (in this worktree session, `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`).

The script has no village override. It requires the seeded demo UUID `13370000-0000-4000-8000-000000000000` and invite code `HACKLANTA`. It removes only check-ins beginning with `QA-` (case-insensitive, ignoring leading spaces), their evidence reviews/idempotency references, associated activity events and reactions. All writes run in one transaction. Other villages and ordinary check-ins are preserved. Existing XP/coin ledgers and uploaded assets are retained: this is text cleanup, not a financial or asset reset.

Executed on 2026-10-10 against the environment-configured demo database:

- Dry run: `8 demo QA check-ins matched (dry run)`; exit 0.
- Apply: `8 demo QA check-ins deleted`; exit 0.
- Verification dry run: `0 demo QA check-ins matched (dry run)`; exit 0.

API tests exercise filtering before pagination, evidence flags, cleanup idempotency, and preservation of another village's QA check-in in a private schema in `village_test`.
