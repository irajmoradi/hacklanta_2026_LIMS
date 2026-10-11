# QA-004 release checklist — 2026-10-10

**HOLD:** mobile scene labels block a profile control, the configured wallet panel
cannot resolve its dependencies, and generated pot-client addresses disagree with
the current program. Reproductions and evidence: [QA-004-REPORT.md](QA-004-REPORT.md).
The two QA-003 photo integration blockers now pass.

Branch: `qa/QA-004`. Baseline: `cc09d3739b9d9ec0d2592a97a78afbf667b6698b`.
Live harness milestone: `5ddde02`. Only `tests/**` is changed. No app fixes were made.
API reports `API-004`, GPU reports `cv-006`; these are not deployed commit attestations.

To reproduce without writing dependency or test output into other app directories:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
python tests/prepare_checkout.py
$qaPython='C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python'
Set-Location tests/.runtime/checkout
bun install --cwd apps/web --frozen-lockfile
bun install --cwd apps/imessage --frozen-lockfile
bun install --cwd tests --frozen-lockfile
& $qaPython tests/wave4_live.py --browser
```

`prepare_checkout.py` copies tracked source and the QA harness, not the external
`.env` or ignored generated assets. The existing Python 3.12 environment above was
reused; a teammate can substitute a compatible API environment. All commands below
ran with that executable and the external environment selected. `C` below means
`tests/.runtime/checkout` relative to this worktree. Browser suites used one worker
each; do not run these all concurrently on this machine.

| Check | Executed command / working directory | Exit and observed result |
| --- | --- | --- |
| Dependency installs | Three `bun install --cwd ... --frozen-lockfile` commands above, from C | 0 each; lockfiles unchanged |
| API | `& $qaPython -m pytest -q -o cache_dir=../../tests/.runtime/cache --basetemp=../../tests/.runtime/pytest --tb=short`, C/apps/api | 0; 234 passed, 1 skipped, 145.34s |
| Web units | `bun run test`, C/apps/web | 0; 32 passed, 214 assertions |
| Scene/social/Gazette units | `bun test src/scene/worldTypes.test.ts src/api/social.test.ts src/api/gazette.test.ts`, C/apps/web | 0; 15 passed, 1551 assertions |
| Original mock/auth/connection + QA scene/photo | `node ../apps/web/node_modules/@playwright/test/cli.js test --config playwright.mock.config.ts --workers=1`, C/tests | 1; 34 passed, 5 failed, 6.3m; details below |
| Focused failure triage after heartbeat-stub fix | Same CLI/config with `--project=scene --project=connection --project=mock --grep 'town:|newly arriving|native recording|WEB-010 shop' --workers=1`, C/tests | 1; 2 passed, 3 failed. Equipment passes; mobile obstruction repeats; day/night fixture still used outdated level |
| Corrected scene fixture | `node tests/.runtime/checkout/apps/web/node_modules/@playwright/test/cli.js test --config tests/.runtime/checkout/tests/playwright.mock.config.ts --project=scene --workers=1 --output tests/.runtime/scene-final`, worktree root | 0; 3 passed, 29.9s; repeated after screenshot-path fix: 3 passed, 28.9s |
| Live HTTP baseline | `& $qaPython tests/run_live.py integration`, C | 0; 6 passed, 4 skipped, 54 assertions; 5 users/7 villages cleaned |
| Wave-5 live API | `& $qaPython tests/wave3_live.py`, C | 0; growth/unlocks, membership and rejected photo uploads; 3 users/1 village cleaned |
| Cross-cutting API/DB | `& $qaPython -m pytest tests/integration -q -o asyncio_mode=auto --basetemp=tests/.runtime/cross --tb=short`, C | 0; 6 passed, 4.90s |
| Live browser baseline | `& $qaPython tests/run_live.py e2e`, C | 0; 4 passed, 2 skipped, 1.4m; 5 users/4 villages cleaned |
| New wave-7 API | `& $qaPython tests/wave4_live.py`, worktree root | 0; seven named checks; 3 users/1 village cleaned |
| Final wave-7 API + browser | `& $qaPython tests/.runtime/checkout/tests/wave4_live.py --browser`, worktree root | 0; seven API checks + 2 browser cases passed, browser 23.9s; 3 users/1 village cleaned |
| Configured mock wallet/Gazette/memory | `node node_modules/@playwright/test/cli.js test --config tests/web012.config.ts --project=flag-on --workers=1`, C/apps/web | 1; 3 passed, 2 wallet failures; unresolved `@solana/kit`; no wallet signing reached |
| Social/presence/bribe/delete UI | `node node_modules/@playwright/test/cli.js test --config tests/web014.config.ts --workers=1`, C/apps/web | 0; 6 passed, 23.9s, includes forced offline |
| iMessage units | `bun test --cwd apps/imessage`, C | 0; 9 passed, 42 assertions |
| iMessage simulation | `bun run --cwd apps/imessage simulate`, C | 0; fake Spectrum, 1 check-in, 10 XP, sent outbox, durable receipt; isolated DB |
| Pot-client Linux | WSL command below, worktree root | 1; 14 passed, 5 failed, 123 assertions; program address mismatch |
| LAM renderer | `rg --files packages/lam-renderer`; read package.json | No test script or suite exists |
| Health units | `& $qaPython -m unittest discover -s tests/health -v`, C | 0; 4 passed |
| Service health | `& $qaPython ops/health.py --format json`, C and final worktree root | 0; API/web/DB/GPU up; inspect statuses, not exit alone |
| Demo verifier | `bun tests/demo/verify.ts`, C | 1; missing `docs/submission/video/data/demo/capture.json` |
| Original real/real-town app browser suites | Inspected, not run | Unsafe shared seeded identity/assets; replaced with fresh QA browser checks |
| Cleanup audit | Runtime Python/psycopg SELECT counts described in report | 0; zero QA users, villages, fake jobs and reward tokens |
| Whitespace | `git diff --check`, worktree root | 0 |

The first API attempt used a basetemp parent that had not been created: exit 1,
65 passed/1 skipped/169 setup errors. The directory was created inside the test
checkout and the complete API rerun above passed. An initial wave-7 browser memory
assertion expected manually seeded facts after event completion had legitimately
rebuilt them; corrected to assert the actual live response, then both cases passed.
These were harness issues, not application failures.

```powershell
wsl -d Ubuntu-24.04 --user iraj bash -lc 'QA_BUN=/mnt/c/Users/mourn/Downloads/hl-sol2/packages/pot-client/.local/bun/package/bin/bun QA_POT_BUILD=/mnt/c/Users/mourn/Downloads/hacklanta/programs bash /mnt/c/Users/mourn/Downloads/hl-qa4/tests/run_pot.sh'
```

Program SHA-256: `9ec3129e493c9aa9f8e3a1152a99ede620eff2e1de1e0989677438d7d43875fc`.
The old `hl-sol2/.../.local/programs` artifact was rejected (exit 1) for a real
Anchor config mismatch. The current build initially failed byte comparison because
of CRLF; all five files matched after normalizing only line endings. The runner
now permits this equivalent checkout representation, preserving all other checks.
The five LiteSVM failures are `DeclaredProgramIdMismatch` (4100), not broadcasts.

Wave-7 coverage:

- [x] Live Gazette latest/archive, source-shaped content, mobile layout and memory rendering.
- [x] Message inbox/outbox privacy, read retry, pokes/cheers feed, zero external relay.
- [x] Real authenticated presence SSE and heartbeat; upstream tests cover TTL/revocation.
- [x] Concurrent live bribes debit exactly once without overdraft; private API scheduler tests cover consumption once, concurrent ticks, rollback, bounded rewards and Gazette provenance.
- [x] Delete-me typed confirmation, QA owner erasure and preservation of the QA peer village.
- [x] Reward-triggered token appears; fake terminal jobs consume fixtures and materialize once; failed jobs/private access verified. Successful upload/token-spend concurrency runs only in the isolated API suite.
- [x] Registry event pack activates and clears on completion; private tests cover expiry; three voice styles are present and registry extension/validation tests pass.
- [x] Rectangular town loads, scene labels open villagers, QA profiles/messages operate; missing-assets and late-model recovery pass.
- [ ] Configured wallet panel integration (QA4-B02).
- [ ] Mobile unobstructed profile click (QA4-B01).
- [ ] Generated pot client matches program (QA4-B03).
- [x] Zero live Mayor/ElevenLabs/vision calls, real GPU jobs, iMessages or on-chain transactions. No shared service restart, public tunnel use or seeded live-user scenario.
- [x] Cleanup verified after both passing and failing live runs.

The initial five mock-browser failures reduce to one reproducible app defect:
mobile click obstruction. The equipment test passed on focused retry (cold Vite
module/root lookup flake); the three QA scene failures were fixed by forwarding
heartbeat JSON and setting the current registry's level-5 gate. Final scene test
screenshots use `info.outputPath` so any invocation stays in the configured output
directory. Do not describe this as a single all-green full browser run.

Gaps: optional paid Mayor path deliberately skipped; live worker never stopped;
real generated portraits and voice cloning not tested; configured wallet simulation
cannot mount; demo capture absent. Final global job counts changed while teammates
used the system (42 done/1 failed, zero queued/running), so global counts are not a
QA write audit. Run-specific QA artifacts were zero. Final users=5 and pending
outbox=0. Local screenshots and exact bug reproductions are in the report.
