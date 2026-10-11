# DOCS-012 validation and handoff

Branch: `docs/DOCS-012`. Source reviewed: `f80f5b7` (`main` at assignment). Architecture/audit milestone: `1d98528`. The subsequent validation commit contains corrected diagrams, startup evidence and this completed report; use `git log -1 --oneline` for its SHA.

## Delivered

- [README](../../README.md): approximately 2,030 words including code/diagrams, a system flowchart, check-in and talking-head sequences, current component boundaries, runnable fixture/connected setup and contribution guidance.
- [Architecture](../ARCHITECTURE.md): contracts, transactions, cross-store failures, job/delivery semantics, threat/cost models, deployment, scale and explicitly unverified behavior.
- [Publication audit](../security/REPO-AUDIT.md), [redacted inventory](history-inventory.json) and [reproducible scanner](audit_history.py): every blob reachable from captured refs, including expanded trace ZIP members; no values emitted.
- [PR template](../../.github/PULL_REQUEST_TEMPLATE.md), [bug template](../../.github/ISSUE_TEMPLATE/bug_report.md), [feature template](../../.github/ISSUE_TEMPLATE/feature_request.md).
- [Documentation checker](check_docs.py), [isolated runner harness](validate.test.ts), [scratch orchestration](isolated_validation.py), [API check](validate_api.py), [browser check](validate_runtime.mjs), [Mermaid renderer](render_diagrams.mjs) and artifacts below.

Only `README.md`, `docs/ARCHITECTURE.md`, `docs/architecture/**`, `docs/security/REPO-AUDIT.md` and `.github/**` changed. No application, contract, root environment or task-record edits. No push, merge, deployment, visibility change or history rewrite.

A final local scope/secret comparison inspected all 27 changed/new files: zero out-of-scope paths and zero exact matches for configured secret values read only at runtime (exit 0).

## Executed commands and results

| Location | Command | Exit / result |
| --- | --- | --- |
| Worktree root | `python docs/architecture/audit_history.py` with existing `VILLAGE_ENV_FILE` | **0**; captured 1,035 commits, 13,951 objects, 7,186 blobs, 785,737,504 bytes and 837 ZIP members. No known configured secret, provider-token, private-key or JWT match. Media clearance remains separate. |
| Worktree root | `python docs/architecture/check_docs.py` | **0**; all task-owned Markdown relative links resolve, fences balance, README length is within 1,500–2,200 words and exactly three diagrams exist. |
| `apps/web`, Git Bash | `bash ../../ops/remote_run.sh bun test ../../docs/architecture/validate.test.ts` | **0**, final run; one orchestration test passed in 96.07 seconds, 99.82 seconds including sync/cache. Performs all nested checks below remotely. |
| Runner `apps/web` (initial wrapper dependency setup) | `bun install --frozen-lockfile` | **0**; 173 packages installed, nested `npm ci` postinstall completed. Later checks used the dependency cache. |
| Runner `apps/api` | `python -m uv sync --frozen --python 3.12` | **0**; 50 packages checked. Existing wrapper `VIRTUAL_ENV` advisory is harmless; uv selects the project environment. |
| Runner `apps/api`, unique scratch DB | `python -m uv run python scripts/migrate.py` | **0**; fresh contract schema and incremental migrations applied. |
| Runner `apps/api`, same scratch DB | `python -m uv run python scripts/seed.py` | **0**; fixture village seeded. No production data copied. |
| Runner `apps/api` | `python -m uv run uvicorn app.main:app --host 127.0.0.1 --port <free-port> --no-proxy-headers` | Startup/health **passed** under the successful harness; explicitly stopped after browser checks. Scheduler, voice, debug, Tiger and provider endpoints/keys disabled. |
| Runner `apps/web` | `VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev --host 127.0.0.1 --port <free-port>` | Fixture page mounted with **zero page errors**; screenshot captured; server explicitly stopped. |
| Runner `apps/web` | `VITE_MOCK=0 VITE_DEMO_AUTH=1 VILLAGE_API_URL=<scratch-api> bun run dev --host 127.0.0.1 --port <free-port>` | Connected page and API proxy **passed**, zero page errors; seeded village/profile/feed loaded; server explicitly stopped. |
| Runner `apps/web` | `node ../../docs/architecture/render_diagrams.mjs` | **0**; Mermaid CLI **11.17.0** rendered all three diagrams as both SVG and PNG. Six `mmdc` invocations succeeded. |
| Runner `apps/web` | `bun run test` | **0**; **196 passed, 0 failed**, 48 files, 3,438,682 assertions, 7.70 seconds. This is the package's defined suite, not every optional E2E suite. |
| Runner `apps/web` | `bun run build` | **0**; TypeScript and Vite succeeded, 2,496 modules, Vite 17.71 seconds. Existing >500-kB chunk advisory remains. |
| Worktree root | `git diff --check` | **0**; no whitespace errors. Git may print Windows line-ending conversion notices. |

The runner harness requires the wrapper's loopback scratch server and `VILLAGE_ENV_FILE=/dev/null`. It creates a unique `run_docs012_<uuid>` database, assigns free API/web ports, and drops that database in `finally`; API and Vite subprocesses are stopped. It follows the existing SCALE-001 independent Bun-test lane pattern, so it does not contend for fixed browser ports or touch the shared `village_test` schema. Runtime services are startup checks, not expected-to-exit-on-their-own commands; the harness's exit code records their verification.

The README uses convenient example ports 8016/4174. The isolated run substitutes OS-assigned ports to avoid teammates' services; all flags and entry points are otherwise the documented ones. Native Windows Uvicorn's selector-loop setting is source-verified, not newly run against a local Windows DB. No full API pytest suite was rerun for this documentation task. Browser presence heartbeats mutated only the disposable village. No GPU/provider generation, Photon send, Solana signature/transaction or live debug action occurred.

## Failures and corrections retained

Two initial `--with-api` wrapper attempts waited behind another worker's long browser/render job. Their dependency installs, migration/seed and disposable API health succeeded, but the validation commands had not begun. Only this task's remote executor processes were deliberately terminated; both wrappers reported remote **143** (local wrapper **1**) and cleaned up their APIs/databases. The second attempt referenced an intermediate combined shell harness, replaced by the isolated harness above. No failing remote test was rerun locally.

The first isolated run exited **1** because semicolons in sequence-message labels were interpreted as Mermaid statement separators. Labels now use commas. The next run exited **1** because the extraction regex assumed LF after the Mermaid fence; Windows rewriting produced CRLF. Both extraction helpers now accept LF/CRLF. The final complete remote run passed, including actual rendering. Startup checks passed in those earlier runs too; they were repeated within the corrected end-to-end harness.

## Visual evidence

All three rendered diagrams were visually inspected for visible text, node/arrow placement and clipping. Startup screenshots show the existing first-run help overlay over fixture or freshly seeded state; they establish mounting, not completion of every UI workflow. They contain no uploaded real faces or voice assets. No product UI was changed.

- [System SVG](artifacts/diagram-1.svg) / [PNG](artifacts/diagram-1.png)
- [Check-in SVG](artifacts/diagram-2.svg) / [PNG](artifacts/diagram-2.png)
- [Talking-head SVG](artifacts/diagram-3.svg) / [PNG](artifacts/diagram-3.png)
- [Fixture startup screenshot](artifacts/fixture-start.png)
- [Connected startup screenshot](artifacts/connected-start.png)

The generated Puppeteer config contains a runner-specific browser path and is ignored. Mermaid source snapshots are retained alongside the renders; the authoritative source is the README.

## Teammate reproduction and remaining decisions

Read the README in GitHub or a Mermaid-capable Markdown viewer. For the offline app, follow its fixture commands. For the complete documentation check, from `apps/web` run:

```bash
bash ../../ops/remote_run.sh bun test ../../docs/architecture/validate.test.ts
```

Then from root run `python docs/architecture/check_docs.py` and `git diff --check`. The wrapper requires the configured runner's SSH access; it forwards no private environment file. To reproduce the history comparison separately, run the scanner with the existing private-file path in `VILLAGE_ENV_FILE`; never paste its values into a command or report. A later scan naturally has different refs/counts as the team commits more work.

Implementation blockers: **none**. Proposed contract changes: **none**. Publication blockers/decisions: historical media needs the rights/privacy clearance and any resulting history cleanup described in the audit. No confirmed key leak requires rotation from this scan; the heuristic limitations are explicit. Suggest **MIT for project-authored code** if the owner wants permissive reuse, after third-party and media review. No LICENSE was added, as requested.
