# FEAT-004 final report

Branch: `feat/FEAT-004`. API milestone: `94a5c34`. UI, tests and this report are
in the following milestone commit (see `git log -2 --oneline`).

Implemented five persistent browser seats, portrait picker, synchronized Play as /
Testing as controls, and advisory ten-minute conflict heartbeats. Added API-gated
bug menu and Ctrl+Shift+D, all seven debug actions, durable replay protection,
activity logging, and confirmed in-process demo story reset. Authenticated real
sessions cannot access these routes, even when demo headers are also supplied.

Files changed:
- API: `app/demo.py`, `app/config.py`, `app/main.py`, `app/domain.py`, `app/world.py`,
  `tests/test_feat004.py`, `README.md`, this report.
- Web: `src/App.tsx`, `src/api/seat.ts`, `src/api/mock.ts`,
  `src/components/DemoTools.tsx`, `src/styles.css`, `tests/feat004.config.ts`,
  `tests/feat004.spec.ts`, and the two screenshots below.
- Contract: `packages/contracts/api.md` documents all request/response shapes and guards.

Verification (final runs, exit 0):
- From apps/api: `python -m uv run pytest tests/test_feat004.py -q` — 3 passed.
  Covers flags/auth, seat expiry/conflicts, every action and replay, changed-key
  rejection, other-village preservation, and inventory/check-in isolation between seats.
- From apps/api: `python -m uv run pytest tests/test_api007.py tests/test_demo_story.py -q`
  — 31 passed, including existing world and offline reset regressions.
- From root: `python -m uv run --project apps/api ruff check apps/api/app/demo.py apps/api/app/config.py apps/api/app/domain.py apps/api/app/main.py apps/api/app/world.py apps/api/tests/test_feat004.py` — passed.
- From root: `python -m uv run --project apps/api ruff format --check apps/api/app/demo.py apps/api/tests/test_feat004.py` — passed.
- From apps/web: `bun run typecheck` — passed.
- From apps/web: `bun run test` — 40 passed, 727 assertions.
- From apps/web: `bunx playwright test --config tests/feat004.config.ts` — 3 passed.
- From apps/web: `bun run build` — passed (existing large-bundle advisory).
- `git diff --check` — passed.

Earlier attempts: pytest from the repository root exited 1 because its relative
basetemp parent did not exist; reran from apps/api. One new test initially exited 1
for an unescaped SQL LIKE percent, now fixed. Initial typecheck exited 2 until the
existing nested pot dependencies were installed with the repository's postinstall
command. One browser rerun exited 1 at its 30-second limit under machine load;
the dedicated config now allows 60 seconds and all three tests passed together.

Screenshots, visually inspected:
- `apps/web/tests/screenshots/FEAT-004-seats.png`
- `apps/web/tests/screenshots/FEAT-004-debug.png`

Try it: keep VILLAGE_ENV_FILE pointed at the existing secret file. Set API shell
DEMO_AUTH=1, DEMO_DEBUG=1, MAYOR_SCHEDULER=0; launch on a free port (e.g. 8014).
Set web VITE_DEMO_AUTH=1, VITE_MOCK=0, VILLAGE_API_URL=http://127.0.0.1:8014 and run
`bun run dev`. Choose a seat, then use the bug button or Ctrl+Shift+D. Alternatively
VITE_MOCK=1 provides the complete offline UI rehearsal. Secrets are only loaded at
runtime; tests use the existing isolated village_test schema fixture.

Choices/limitations: weekly reset preserves XP and activity history; inventory
clear restores base house level 1. Random Mayor events use offline fixtures with
no paid providers. Festival night overrides repair fog until switched off.
Seat registry is advisory, process-local and cleared on restart; run one API worker
for shared warnings. Debug receipts survive full reset so retrying cannot erase
new progress. No blockers or outstanding contract changes. No pushes or merges.
