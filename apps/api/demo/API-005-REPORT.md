# API-005 final report

Branch: `api/API-005` (the assigned current branch).
Implementation milestone: `ff1e519`.
Crater visibility, generated images and live verification milestone: `3924a3d`.
This report is committed separately. No push, merge, deployment restart or paid generation.

## Delivered and files changed

All changes stay within the task's allowed paths:

- `apps/api/scripts/demo_story.py`: offline story builder, transactional scoped reset,
  strict replay no-op, synthetic Pillow evidence, current/past weeks and all pitch state.
- `apps/api/scripts/demo_check.py`: read-only one-screen summary.
- `apps/api/scripts/demo_server.py`: optional original-API factory with an authenticated
  synthetic-evidence route; retains the configured asset root for Dev's existing avatar.
- `apps/api/tests/test_demo_story.py`: 13 tests covering complete-row replay identity,
  scoped reset including a shared user in another village, global avatar preservation,
  rollback, legacy/name guards, all seven weekday boundaries, fixture contents, ledger
  holds, weekly exclusion, competition states, image repeatability and asset authorization.
- `apps/api/demo/README.md`: three-minute pitch and run commands, assumptions and deployment notes.
- `apps/api/demo/API-005-REPORT.md`: this report.
- `apps/api/demo/assets/evidence/13370000-0000-4000-8000-000000000000/demo-story/`:
  `canvas.png`, `notes.png`, `steps.png`; entirely synthetic 720x460 Pillow mockups.

Domain functions perform check-ins, XP awards, stored evidence reviews, purchases, current
goals, human grades/finalization, competition creation/join/submission/decisions. Historical
assignments/timestamps, Mayor events and precomputed competition review JSON are explicit
fixture inserts. Timescale historical rows move through DELETE/INSERT in one transaction
because cross-chunk timestamp UPDATE is unsupported; IDs and other fields survive intact.

## Verification

Commands from repository root, with runtime `VILLAGE_ENV_FILE` pointing to the supplied
external `.env`. Credentials were never printed or copied into files.

| Command/check | Exit | Result |
| --- | --- | --- |
| `python -m uv run --directory apps/api pytest -q` | 0 | **109 passed in 32.54s** (96 existing + 13 demo tests) |
| `python -m uv run --directory apps/api ruff check app scripts tests` | 0 | All checks passed |
| `python -m uv run --directory apps/api ruff format --check app scripts tests` | 0 | 35 files formatted |
| `git diff --check` and `git diff --cached --check` | 0 | Clean |
| `python -m uv run --directory apps/api python scripts/demo_story.py --reset` | 0 | Live development DB rebuilt, fixed demo UUID only |
| `python -m uv run --directory apps/api python scripts/demo_story.py` | 0 | Live replay unchanged; identical counts in every public table |
| `python -m uv run --directory apps/api python scripts/demo_check.py` | 0 | Read-only live summary, shown below |
| In-memory live pre/post snapshot harness, invoking the reset/replay commands above | 0 | Every non-demo row unchanged, including all shared/global avatar rows; Dev's two manifest revisions unchanged |
| Live HTTP ASGI smoke against `create_demo_app`, using existing DB | 0 | Five profiles, all five evidence references return PNG/200, 17 agent-log rows; original asset root retained, scheduler disabled |

The final reset/replay used subprocesses launched by the snapshot harness so snapshots
bracketed the actual CLI transactions. It compared full JSON rows in memory for unrelated
villages, their dependent rows, and global tables. No sensitive snapshot files were written.
The isolated test suite used a random schema in `village_test`, not the shared live schema.
The live ASGI smoke ran before the last crater-only refinement; the final full suite tests
that the active crater aftermath and exactly one active challenge reach the village API.

Initial targeted tests exposed Timescale's cross-chunk update restriction and a level-variety
assertion; both were fixed. Initial lint issues and PDF console encoding were also resolved.
No unresolved test failures. No real provider, iMessage, Solana or GPU execution was tested
or invoked. Screenshot: not applicable (no UI code changed); the canvas evidence PNG was
visually inspected, and all synthetic images were decoded/verified in tests.

## Final live summary (2026-10-10)

```text
Hacklanta Crew | 13370000-0000-4000-8000-000000000000 | invite HACKLANTA
Week 2026-10-05: open; auditor Maya (sits out); winner -
Week 2026-09-28: finalized; auditor Dev (sits out); winner Stefanny
Iraj     XP 460 | L4 | streak 4 | 4 check-ins | Ship the hackathon project
Lance    XP 410 | L3 | streak 3 | 3 check-ins dog+backyard | Gym 4x
Stefanny XP 915 | L5 | streak 5 | 5 check-ins CROWN | Finish a painting series
Maya     XP 220 | L3 | streak 2 | 2 check-ins | Study for an exam
Dev      XP 385 | L3 | streak 2 | 4 check-ins | Run 15 miles
Evidence reviews: 1 suspicious, 4 verified
Minecraft hours: friendly / no stakes; 2 entries, 2 confirmed
Study streak: 0.01 SOL intent / 5% fee intent; 2 entries, 1 confirmed
Mayor: active - Touch grass, bring a friend
Mayor: completed - Last week: paint, pace, and a prototype
Mayor: active - Movie-night crater: repair pending [crater]
Mayor: failed - The great movie-night no-show [crater]
Agent decisions: 12 | Dev avatar revisions: 2 (preserved)
Offline scripted demo; model names are simulated provenance. No payments or messages sent.
```

The active aftermath keeps the failed movie night's crater visible with the current web
renderer, which only examines active events. The failed event remains historically failed.
There is one active challenge and no new XP deduction. The recap and failed-event bodies
are also present in feed payloads; use `/feed?limit=200` to include the older history.

## Teammate trial, assumptions and integration limits

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
python -m uv run --directory apps/api python scripts/demo_story.py --reset
python -m uv run --directory apps/api python scripts/demo_check.py
$env:DEMO_AUTH='1'
$env:UVICORN_LOOP='app.runtime:selector_loop'
python -m uv run --directory apps/api uvicorn scripts.demo_server:create_demo_app --factory --host 127.0.0.1 --port 8015
```

Use an available port and point the web client at that API. Open `/docs` with
`X-Demo-User: 13370000-0000-4000-8000-000000000001`. See README for the timed tour.
The pitch server serves the new synthetic evidence and preserves normal avatar routing.
Automatic Mayor scheduling is disabled there; explicit user actions retain normal behavior.

The current running deployment was left untouched. Its configured asset directory is outside
API-005's allowed paths, so it needs the pitch-server entry point or an integrator deployment
of the synthetic evidence subtree before it can serve those images. This is an integration
step, not an unimplemented script dependency. The live DB already contains the complete story.

Dates use UTC; early-week multiple posts can share a day. Strict replay preserves progress
and timestamps across weeks: use explicit reset to refresh the pitch. All review/model
provenance is visibly marked simulated; no claim is made that Gemini reviewed mock images.
Stake and fee amounts remain intentions; no payments or outbound messages are queued.
Generated files may remain after a failed database transaction, but are deterministic and
contain no personal data. Existing user preferences, voice records and Dev's manifests survive.

No blocking implementation issue or required contract migration. Optional integrator proposal:
expose persistent cosmetic aftermath/repair state separately from event `penalty`, which
currently doubles as the renderer's visibility signal. Shared contracts were not edited.
