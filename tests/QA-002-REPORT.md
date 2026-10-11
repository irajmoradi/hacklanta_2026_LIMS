# QA-002 final report

Branch `qa/QA-002`. Implementation milestone **`cb80748`**; this report and release
checklist are in the subsequent documentation commit. No push or merge. Baseline
`885da5bfbb2b25bbcdc9405bdd0c138596858b1d`. Only `tests/**` changed; `ops/health.py`
needed no change. App source, contracts, root configuration and secrets are untouched.

The tested regression gates pass. This is **not** complete deployment certification:
the original app real suite is unsafe under the task's no-seeded-users constraint,
generated live assets/GPU-down behavior remain untested, and video verification fails
because `capture.json` is absent. Exact commands, exit codes, counts and rerun steps
are in [RELEASE-CHECK.md](RELEASE-CHECK.md).

Files changed:

- `tests/run_live.py`, `support/api.ts`: runtime DB credentials, five fresh UUID users
  with QA-prefixed names, fail-closed identity setup, transactional cleanup including
  orphan-prone retry/review rows and both hypertables, verified final counts.
- `tests/integration/regression.test.ts`, `weekly.test.ts`: remove seeded identities
  and live evidence-file writes; preserve regression checks; add live weekly finalization
  and new-route membership checks.
- `tests/integration/conftest.py`, `test_cross_cutting.py`: production ASGI/real PostgreSQL
  in an isolated schema, new QA identities, competition/evidence, queued voice expression,
  membership/self-settings and persistent-budget agent-log coverage.
- `tests/e2e/village.spec.ts`, `playwright.config.ts`: fresh user selectors, current
  village picker, real 409 balance assertion, settings/Week read checks, separate live output.
- `tests/playwright.mock.config.ts`: unchanged app mock suites with output under tests;
  uses the same Playwright installation as those suites.
- `tests/run_pot.sh`: Linux test copy, matching-program build checks and artifact checksum.
- `tests/.gitignore`, `.gitattributes`, `README.md`, `RELEASE-CHECK.md`, this report: runtime exclusions,
  safe operating instructions and honest release evidence.

Results: API 115 pass; web units 26 pass; web mock browser 29 pass; iMessage 9 pass and
simulation pass; WSL pot-client 19 pass; live HTTP 6 pass/4 skip; new Python integration
4 pass; live browser 3 pass/2 skip; health 4 pass. All these final commands exit 0.
LAM renderer has no test suite. Demo verifier exits 1 (missing artifact). The original
seed-dependent app real suite was inspected, not executed or edited; the checklist maps
every original case to replacement coverage or an explicit gap.

No live provider calls, GPU submissions, iMessages or chain transactions occurred.
The queued expression test uses mocked audio and a separate database schema invisible
to the live bridge. Competition vision is stubbed. Budget tests do not consume/exhaust
the shared budget. The existing API suite/simulator use local seed fixtures only within
their private `village_test` schemas; that is distinct from using live seeded villagers.
New tests use fresh QA identities throughout. QA village names are excluded by the
existing scheduler and their users have no phone and messaging disabled.

Cleanup succeeded after every live run, including the failed first browser run.
Successful final live runs removed 5 users/7 villages (HTTP) and 5 users/3 villages
(browser), with no check-in or activity rows remaining for those IDs. Private API and
simulation schemas were dropped by their fixtures. The health snapshot after cleanup
returned to 5 users and zero queued/running avatar jobs. Shared demo rows were not
selected for test scenarios or mutated. Runtime assets/screenshots are synthetic and
ignored; no secrets, real-person portraits/voices, model weights or sensitive logs committed.
The final direct DB audit also confirmed zero `auth_issuer='qa002'` users and zero
`QA-002 ` villages (exit 0). The shell runner is pinned to LF for Windows checkout safety.

Observed deployment: API/web/DB/GPU up; API reports API-004, GPU cv-003. That API tag
is not a deploy SHA, so the precise running revision cannot be established from health.
No claim that the process must equal the checkout is made. Shared services were untouched.

Resolved prior finding: **QA-B01** (stale balance after shop 409) no longer reproduces.
The fresh-user race spends 20 of 30 XP from another client, then receives a genuine 409
on the 25-XP purchase; both API and open dialog show 10 XP and the error stays readable.
QA-B02's historical transient 500 was not observed. The village selector exists and is
asserted, though native invite-screen behavior remains mock-covered rather than live-covered.

Harness failures, not hidden passes: initial mock wrapper attempts exited 1 due to two
Playwright installations, an incorrect working-directory path and Node directory-import
resolution. Corrected to the app CLI and explicit module file. Initial new pytest run
exited 1 because its temp-directory parent did not exist; fixture setup now creates it.
Initial live browser run exited 1 (2 failures/2 skips) because the old name assertion
matched a hidden `<option>`; it was corrected to assert the visible selector's value.
PowerShell Unicode editing also produced `?` in a selector; corrected with a JS Unicode
escape before the successful reruns. No app code was changed to obtain green tests.

Local screenshots (uncommitted):

- `tests/test-results/live/village-real-insufficient--a0d1c-rror-without-losing-balance/insufficient.png`
- `tests/test-results/live/village-fresh-QA-identity--b8641-ly-audit-without-generation/settings.png`
- `tests/test-results/live/village-fresh-QA-identity--b8641-ly-audit-without-generation/weekly.png`
- Profile/purchase PNGs are in the live `village-API-join-...` output directory.

The shop and weekly screenshots were opened and visually checked: readable dialogs,
10-XP corrected balance/error and a QA auditor sitting out, with no real-person assets.
Mock screenshots also stay under `tests/test-results/`; no UI source changed.

Teammate trial: install locked dependencies, export the existing `VILLAGE_ENV_FILE`,
and run the two `tests/run_live.py` commands and the Python integration command in
[README.md](README.md). Each live command provisions and cleans its own users automatically.
Run the remaining commands in the checklist before judging. Do not use the old direct
seeded-user instructions from QA-001 or run the demo recorder to fill the artifact gap.

Blockers/proposals for the integrator:

1. Parameterize app real e2e identities and provision synthetic assets to permit the
   full suite without shared demo dependency. No app file was edited here.
2. Add an immutable revision to health/build metadata. Current API-004 cannot identify
   a deployed commit reliably.
3. Supply video capture/verification artifacts in the demo lane. Recording is outside
   these allowed paths and would violate the zero-voice/GPU budget of this task.
4. Optional contract improvement: owner-authorized QA deletion that includes hypertables,
   retry/review rows and private asset files, avoiding direct DB lifecycle helpers.
5. Retain WEB-007's proposal to expose Mayor event `model`/`created_at`; no live paid prayer
   was made, so provider provenance display is not newly certified here.

No required contract edit was made or needed for the tests that ran.
