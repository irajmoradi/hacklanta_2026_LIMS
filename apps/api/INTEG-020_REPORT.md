# INTEG-020 verification

Branch: `integ/INTEG-020`.

Implementation commits:
- `9f9d979` — seed offline demo competitions with coins.
- `57b8ea3` — align text joins and Treasury isolation with FEAT-027.

## Findings and fixes

1. Eight failures shared one cause: the demo story tried to join a SOL competition
   without a confirmed transaction. The study competition now stakes 10 in-game
   coins through the normal competition API functions, retaining its auditor,
   evidence, decisions, replay guarantees, and 5% fee. Expected coin balances and
   the demo summary now describe the actual fixture. No SOL bypass or seed-only
   production authorization exception was introduced.
2. The old iMessage test created a SOL competition without its required deadline
   and expected text confirmation to join it. It now exercises a coin competition,
   including the debit and photo-entry routing. Text SOL joins direct the user to
   the app for a confirmed devnet transaction. Coin consent includes stake, fee,
   auditor, payout, and deadline, and must be renewed if those terms change.
   Regression tests cover SOL rejection, changed stakes, and charging only once.
3. The historical coin-migration test committed its old `coins_from_xp` trigger,
   replacing the Treasury-aware version for later tests. It now rolls back the
   historical DDL and immediately verifies that Treasury XP does not grant coins.
   The full baseline confirmed this was the Treasury failure (500 coins instead
   of 300), rather than an auditor-weight calculation failure.
4. Inspection also found that the live overworld's level calculation included
   Treasury XP even though HTTP world state excluded it. Both now count positive,
   non-Treasury XP from current members. Tests check HTTP/live level agreement and
   ordinary/capped auditor weighting after Treasury awards.
5. The latency failure did not reproduce on runner 2. The unchanged test passed
   in the baseline and focused run; the separate measured run reported 62 samples,
   p50 **8.77 ms**, p95 **12.02 ms**, below the original **20 ms** limit. This is
   consistent with contention on the previously overloaded runner, not evidence
   of a reproducible latency regression. No latency threshold, sampling logic,
   database path, or live transport was relaxed or mocked to obtain a pass.

## Files changed

- `scripts/demo_story.py`, `scripts/demo_check.py`, `tests/test_demo_story.py`:
  offline coin fixture and its invariants.
- `app/inbound_play.py`, `tests/test_feat026.py`: text consent and entry coverage.
- `tests/test_feat007.py`: isolate historical migration DDL.
- `app/overworld.py`, `tests/test_feat027.py`: Treasury XP exclusion and coverage.
- `INTEG-020_REPORT.md`: this report.

## Validation

All database tests ran through the wrapper on **<runner-2-ip>**, from `apps/api`,
against the runner's isolated test schema in `village_test`. Providers are mocked;
no live village, paid generation, or signed/sent chain transaction was used.

Baseline at `09f73a7`:

```bash
RUNNER_IP=<runner-2-ip> ../../ops/remote_run.sh python -m uv run pytest -q
```

Exit **1**: **10 failed, 649 passed, 4 skipped, 2 warnings**, 705.30 seconds.
The historical report named in the task was absent locally; this run reproduced
all listed failures except latency. Local output: `integ020-baseline.log` (ignored).

Focused fixes:

```bash
RUNNER_IP=<runner-2-ip> ../../ops/remote_run.sh python -m uv run pytest -q tests/test_api007.py tests/test_api008.py tests/test_demo_story.py tests/test_feat004.py tests/test_feat026.py tests/test_feat027.py tests/test_overworld_latency.py --tb=short
```

Exit **0**: **100 passed, 1 warning**, 151.72 seconds.
Local output: `integ020-focused.log` (ignored).

Historical migration followed by Treasury checks and measured live latency:

```bash
RUNNER_IP=<runner-2-ip> ../../ops/remote_run.sh python -m uv run pytest -q -s tests/test_feat007.py::test_historical_backfill_replay_and_progress tests/test_feat027.py::test_treasury_xp_adds_auditor_chance_without_village_xp tests/test_overworld_latency.py
```

Exit **0**: **5 passed, 1 warning**, 11.71 seconds; latency statistics above.
Local output: `integ020-order-latency.log` (ignored).

Full post-fix suite at `57b8ea3`:

```bash
RUNNER_IP=<runner-2-ip> ../../ops/remote_run.sh python -m uv run pytest -q
```

Exit **0**: **662 passed, 4 skipped, 2 warnings**, **720.97 seconds**.
Wrapper wall time including sync/cache: 735.54 seconds. The unchanged latency
test also passed in this full run. Local output: `integ020-full.log` (ignored).

The four existing skips are the two opt-in paid Gazette proofs, the unconfigured
Tiger database check, and opt-in HTTP/browser integration. Existing warnings
concern the Starlette/httpx deprecation and a duplicate asset HEAD operation ID.

Local lint: `python -m ruff` was unavailable (exit 1); the existing executable at
`C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/ruff.exe` was then used.
Its `check` passed (exit 0) for `app/inbound_play.py`, `scripts/demo_story.py`,
`scripts/demo_check.py`, `tests/test_demo_story.py`, `tests/test_feat007.py`,
`tests/test_feat026.py`, and `tests/test_feat027.py`. `git diff --check` passed
(exit 0). The existing compact formatting of `app/overworld.py` was preserved.

## Try it

Run the focused command above to exercise the offline story, text/photo flow,
mocked devnet receipt verification, Treasury behavior, and real WebSocket path.
The migration-order command specifically verifies the former cross-test leak.
Demo seeding/reset checks run in scratch data; do not use the live demo for them.

No UI changes; screenshot: not applicable. No blockers or proposed contract
changes. No files outside `apps/api/**` were changed; no secrets were copied.
