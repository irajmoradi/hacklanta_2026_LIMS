# QA-001 execution report — 2026-10-10

Branch: `qa/QA-001`. Implementation milestone: `9864f49`; the follow-up commit contains expanded membership/atomicity coverage and this report. Only `ops/health.py` and `tests/**` changed. No app, contract, root configuration, or secret files were edited. Services were not stopped or restarted.

## Actual commands and results

Commands run from `tests/` unless stated otherwise:

| Command | Result |
| --- | --- |
| `bun install` | Exit 0; locked Playwright 1.58.2 installed |
| `bun run integration` (final) | Exit 0; 4 passed, 4 skipped, 42 assertions |
| `bun run e2e --grep "API join\|insufficient"` (after harness corrections) | Exit 0; 2 passed |
| `bun run e2e` (final, paid opt-in unset) | Exit 0; 2 passed, 2 skipped (Mayor opt-in unset; worker up) |
| `$env:QA_ALLOW_MAYOR='1'; bun run e2e` (initial authorized provider run) | Exit 1 overall; Mayor test passed, 2 other tests failed, worker-down skipped. Exactly one prayer was submitted; no paid rerun. |
| `tests/.venv/Scripts/python -m unittest discover -s tests/health -v` (root) | Exit 0; 4 passed; includes an actual subprocess with unreachable probe targets, all down and exit 0 |
| `tests/.venv/Scripts/python ops/health.py --format json` (root) | Exit 0; API/web/DB/GPU all up, row counts populated, main SHA populated |

The initial suite used the mock-fixture UUID prefix and got 401 before creating any villages; corrected to the live seed prefix `13370000`. Initial browser harness selected the wrong profile; fixed through the visible Play-as control. A race-test funding calculation initially left exactly enough XP; corrected to goal + daily note = 30. A copied tiny PNG failed API validation; replaced with a generated valid one-pixel PNG. These were harness issues, not app bugs. One ad-hoc outage command used a Windows executable path without `.exe` and failed before launching; the committed subprocess test uses `sys.executable` and passes. A whitespace check found an extra trailing blank line, subsequently removed.

The first health snapshot reported `API-001` and local main `2ec2e9eb3625b9e87ae33fa311f4364060563265`. A later snapshot reported `API-002` and main `e7ea878da2e7255532288d18773d01bbc9ebfec8`. Another collaborator changed the running candidate during this task; the suite did not perform those changes. The authorized Mayor pass was observed on the earlier run, not re-certified on the later build.

## Bugs / observations with repro

**QA-B01 — stale shop balance after real 409 (reproduced).** Create a QA village as Dev; goal + daily status give 30 XP. Open its shop in a browser. From a second client purchase `decor_flowers` for 20 XP. In the first tab click `shirt_stripes` for 25 XP. API correctly returns 409 `Insufficient XP`, and the UI correctly shows that error, but the dialog still shows 30 XP and affordable buttons while actual balance is 10. Closing and reopening reloads balance. Run `bun run e2e --grep insufficient` for the automated repro. Financial atomicity passes; recommended web fix: refresh shop/profile state after a rejected stale-balance purchase.

**QA-B02 — transient shop HTTP 500 (observed once; not reproduced later).** During the first browser run, opening the shop in village `e94e2943-e481-4c4e-bdc6-5439d9c7bfdf` displayed `Request failed (500). Please try again.` and remained at “Opening the shutters…”. Repro attempt: GET `/api/villages/e94e2943-e481-4c4e-bdc6-5439d9c7bfdf/shop` through ports 8010 and 4173 as Dev; both subsequently returned 200. Later browser runs passed. Build changed during testing, so root cause is unconfirmed; do not classify this as a confirmed persistent API defect. The UI has no in-dialog retry for failed initial loading; closing/reopening retries.

**QA-B03 — join/selection coverage limitation.** The current stable build opens the oldest membership and offers no invite input or village selector. Creating a throwaway village alone does not make it selectable through navigation. The test-only `/me` filter is documented in README. A native village picker and invite flow would allow removing this harness adaptation.

## Evidence and residual coverage

Local, ignored screenshots (not committed because real portraits may be present):

- `tests/test-results/village-API-join-→-live-vi-6b3e4-l-→-status-retry-→-purchase/profile.png`
- `tests/test-results/village-API-join-→-live-vi-6b3e4-l-→-status-retry-→-purchase/purchase.png`
- `tests/test-results/village-real-insufficient--a0d1c-rror-without-losing-balance/insufficient.png`

The insufficient-funds screenshot was visually inspected: the server error is readable, the 30 XP stale balance is visible, and the shop is rendered without overlap. Earlier Mayor screenshot was replaced by subsequent Playwright output; the observed passing result is recorded above without claiming retained evidence.

Real GPU-down behavior remains unverified because the worker stayed up; neither test fakes a server outage. Invalid Mayor proposal validation and retried GPU completion remain unverified without test hooks. Independent animation/recolor isolation lacks an observable control/hook. These are explicit skips, never reported as passes. No GPU acceptance or real-person upload/voice test was attempted.

Suggested integrator-owned contract additions: authenticated, nonproduction-only proposal-validation and isolated job-completion test hooks; an owner-authorized deletion API for QA villages including their time-series rows/assets. None were implemented. Existing contracts were sufficient for tests that ran. Retained villages are named `QA-001 ...`; tests do not delete or mutate seeded-village data. Shared users gain QA memberships, as explicitly required by this task.

Teammate reproduction: follow `tests/README.md`; ordinary integration and browser runs need no secrets or paid calls. Use the health reporter with the existing `VILLAGE_ENV_FILE` environment for DB counts. Keep all services running and execute the GPU-down checks later only when the worker is already down.
