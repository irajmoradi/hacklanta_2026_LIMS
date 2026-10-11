# FIX-007 delivery

Branch: `fix/FIX-007`. Test milestone: `18e0f5e`. This report is committed separately.

## Decision and changes

The API is correct: FEAT-012 routes expired challenge/random events through
`disasters.sync`, marks them failed, and creates a disaster with a linked repair.
Disaster selection is independent of the template's legacy penalty. Storm blackout
forces **rain and night**, not fog. Other disasters preserve the stored weather.
Fog in `world.state` is a compatibility fallback for pending repairs without an
active disaster. The legacy `/mayor/effects` flags remain compatibility fields;
the village response's `world.disaster` describes the current penalty.

- `tests/test_api009.py`: replaced obsolete fog/manual-repair expectations with
  all 16 combinations of the four affected templates and four disaster kinds.
  Only random selection is patched; real event expiry, disaster creation, HTTP
  reads, and check-in recovery run against PostgreSQL. Assertions cover the linked
  repair, weather, shelter closure, gardening availability, manual-completion
  rejection, six contributions from three neighbors, cleared effects, and persisted
  failed/completed event statuses. Existing FEAT-012 tests cover outbreak pet
  departure, rolling repair windows, distinct-neighbor requirements, and selection.
- `tests/test_catalog_registry.py`: replaced the magic entry count with count and
  complete definition parity against `packages/catalog/catalog.json`, retaining
  legacy-row and referenced-asset checks. The current catalog has 292 entries.
- `FIX-007-REPORT.md`: this report.

No production behavior or contracts needed changes. All edits are inside
`apps/api/**`. No UI changes; screenshots are not applicable.

## Validation

Commands run from `apps/api` with `VILLAGE_ENV_FILE` set as shown below:

- Before changes: `python -m uv run pytest tests/test_api009.py::test_penalties_recover tests/test_catalog_registry.py::test_shipped_registry_and_legacy_parity -q`
  — exit **1**, **5 failed**, reproducing every reported failure.
- After changes: the same focused command — exit **0**, **17 passed** in 25.31s.
- Full suite: `python -m uv run pytest -q` — exit **0**, **403 passed, 3 skipped,
  0 failed** in 571.39s. Skips are the two explicit paid gazette proofs and the
  opt-in live HTTP integration test.
- `python -m uv run ruff check tests/test_api009.py tests/test_catalog_registry.py`
  — exit **0**, all checks passed.
- `git diff --check` — exit **0**.

## Teammate reproduction

From `apps/api`, in PowerShell:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
python -m uv run pytest -q
```

The application reads the supplied environment file at runtime; secrets are not
copied. Tests use the guarded `village_test` database and isolated schemas, with
mocked generation providers. The existing paid/live tests remain opt-in.

Blockers: none. Proposed contract changes: none.
