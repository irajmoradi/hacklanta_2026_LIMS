# Village regression gate (QA-004)

Use [RELEASE-CHECK.md](RELEASE-CHECK.md) for exact commands and the latest results.
The live API on 8010 and preview on 4173 must already be running. The harness does
not restart shared services. Install the locked API, web, iMessage and tests dependencies
as listed in the checklist. Read the external environment at runtime only:

```powershell
$env:VILLAGE_ENV_FILE = '/c/Users/mourn/Downloads/hacklanta/.env'
apps/api/.venv/Scripts/python tests/run_live.py integration
apps/api/.venv/Scripts/python tests/run_live.py e2e
apps/api/.venv/Scripts/python tests/wave3_live.py
apps/api/.venv/Scripts/python -m pytest tests/integration -q -o asyncio_mode=auto --basetemp=tests/.runtime/pytest
```

On POSIX use `apps/api/.venv/bin/python`. The live runner loads `DATABASE_URL` through
the API's native-path-aware environment loader. It inserts five fresh UUID users with
`QA·` display names, no phone and messaging disabled. Village names start `QA-002 `,
which the Mayor scheduler excludes. Never run live tests with seeded users. Direct
`bun run integration` / `bun run e2e` deliberately fail without runner-supplied identities.

A `finally` block removes every village associated with these identities, after checking
its QA name and membership ownership. It explicitly deletes evidence-review and retry-key
rows, then both hypertables by village ID, cascading village rows and users. Counts are
verified before commit. Cleanup also runs after test failures. No live evidence files,
voice lines or GPU jobs are created. Do not terminate the runner forcibly; ordinary errors
and interruption execute cleanup, but an OS kill cannot execute Python `finally`.

`QA_API_URL` (including `/api`) and `QA_WEB_URL` override HTTP targets. Their services
must use the same database as `DATABASE_URL`. The browser uses actual API responses,
forwards the fresh owner's demo header, restricts village requests to its own ID, and
filters `/me` memberships to that test's village. It still uses the visible Play-as control.
This covers API invite joining, not native invite-screen joining; the unchanged app mock
suite covers that screen. Global browser mutations are blocked.

The live suite covers authorization, XP/check-in/purchase concurrency, weekly auditor
assignment, human grading, repeated finalization, one crown and exactly 100 winner XP.
Browser checks cover profile/goal/check-in/purchase, real 409 balance refresh, settings
and weekly reads. Provider opt-in is forcibly disabled by this release runner: zero paid
Mayor, ElevenLabs or vision calls, zero live GPU jobs and no messages or chain actions.
The historical Mayor test remains skipped; it is not a certification of provider output.

The Python cross-cutting suite uses the production ASGI app and real PostgreSQL in a
random schema of `village_test`, with fresh QA users and no demo seed. It reuses the API
schema fixture, disables scheduling and provider keys, stubs synthetic speech/vision,
and stores temporary assets under `tests/.runtime`. Its queued expression row cannot
be consumed by the live bridge. Schema teardown removes all rows. Budget reservations
are exercised only in that isolated schema, never by exhausting the shared budget.

The original API tests and iMessage simulation use their own isolated `village_test`
schemas and existing local seed fixtures; they never address shared live demo rows.
The app's real browser suite hardcodes live seeded users/assets and is NOT safe for this
task. Its gap and the fresh-user replacement coverage are recorded in the checklist.

Mock browser tests run unchanged using `playwright.mock.config.ts`, which moves output
and screenshot writes into `tests/`. Use the app's Playwright CLI to avoid loading two
copies of Playwright. Live screenshots are under ignored `tests/test-results/live/`;
traces are disabled. Screenshots remain local and are not committed.

QA-003 adds isolated API growth/weather and group-photo consent/crop/claim tests,
plus safe live growth and rejected-upload checks. Successful uploads and claims only
run against the private `village_test` schema: the live bridge cannot see queued rows.
Synthetic crop files use `villages/<qa-id>/group/<job>/...` under `tests/.runtime`,
not the live asset directory. No live worker input is created. The dedicated live
script uses the existing QA-002 name prefix so the existing cleanup guard remains valid.

The browser wrapper also runs `tests/wave3/scene.spec.ts`, derived from WEB-008's
scene suite with explicit ferris-wheel unlocks required by the integrated scene.
The upstream scene fixture omitted that unlock and fails its model-request assertion.
Day/night captures are 1920x1080; existing WEB-009 cases cover 390x844 mobile.

The two QA-003 group-photo gates now pass: fresh live owners can open the uploader
and API `done` results show crop claim controls. QA-004 finds mobile profile-click
obstruction, missing wallet dependency wiring, and a generated pot-client/program
address mismatch. See QA-004-REPORT.md; failures remain ordinary gates.

`run_pot.sh` runs the unchanged pot-client suite in a Linux copy under `tests/.runtime`.
It requires Linux Bun and a prebuilt SBF artifact. Before reuse it compares the build's
program source, Cargo manifests/lock and Anchor config to this checkout (normalizing
only CRLF line endings), then prints
the binary SHA-256. It performs only LiteSVM and mocked-wallet execution; no owner wallet,
RPC broadcast, deployment or real transaction is used.

Health reporter (read-only, never a release gate by exit code alone):

```powershell
apps/api/.venv/Scripts/python ops/health.py --format json
apps/api/.venv/Scripts/python -m unittest discover -s tests/health -v
```

Inspect each service status and count error. Reporter exit 0 is intentional even when
services are down. `QA_GPU_HEALTH_URL` overrides the GPU health target. No credentials,
phone numbers or DB row contents are emitted. The old QA-001 report is historical;
its seeded-user and retained-village instructions are superseded by this document.

QA-004 runs dependencies and app suites in an ignored test-local checkout to keep
all filesystem output inside the allowed tree. Run `python tests/prepare_checkout.py`
from this worktree, then follow the current RELEASE-CHECK commands. Preparation
uses tracked source plus current QA edits; it never copies the external .env or
ignored live assets. The legacy setup commands above assume app-local environments;
use the test-local setup for this task. Do not run all browser suites concurrently.

`wave4_live.py --browser` creates three fresh QA users, exercises the new social,
SSE, bribe, Gazette/memory, event-pack/voice-style and delete-me endpoints, and runs
two live browser cases on 4173. Gazette and memory fixtures are synthetic DB rows.
It creates only done/failed photo jobs, checks reward-triggered token projection,
and links those tokens to terminal fixtures without enqueueing worker work. Actual
upload/spend concurrency and bribe consumption use the private upstream API suite.
The script removes terminal jobs before verified village/user cleanup. No dedicated
identity, token, fake job or village is retained. Its browser route guard allows
only its village, rejects private asset reads and blocks global mutations.

New screenshots live in `tests/.runtime/checkout/tests/test-results/wave4/`; scene
shots use Playwright's configured output path. The private QA harness can be rerun
with zero provider calls while teammates keep using the shared services.
