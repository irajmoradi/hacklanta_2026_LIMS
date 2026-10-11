# FEAT-001 — accomplishments and emoji reactions

Branch: `feat/FEAT-001`.

Implementation milestones:
- `8bb45b6`: API, migration, HTTP contract, and API tests.
- `2ef4fd3`: accomplishments wall, shared optimistic reaction bars, mock behavior, scene burst.
- `bda8d13`: preserve short-laptop profile access, poll new activity, add backfill and recovery checks.
- `ea0b706`: real-mode recovery verification and desktop/mobile/laptop screenshot artifacts.

Completed behavior:
- Member-only, idempotent POST/DELETE reactions for activity, goals, and check-ins; fixed eight-emoji palette, target/village checks, viewer-specific counts.
- Completed goals, competition winners (including ties), weekly completion stars, and prospective XP level-ups appear newest first on the wall. Goal cards share profile reactions; other achievement cards share feed reactions.
- Goal status changes emit one completion event per transition and record completion time. Retrying completion does not repeat the event.
- The wall opens from the desktop feed footer, the mobile action menu, or A. Portraits, dates, empty/loading/error states, keyboard dismissal, and touch-sized reactions are supported. The desktop dock retains its original width.
- Reaction counts and selection update optimistically, revert on failure, and can be retried. Current and past profile goals and feed items have reaction bars.
- New goal-completion activity triggers a 3.2-second, pointer-transparent burst over the villager. The initial feed never replays old completions; changing viewers/villages resets detection. Feed polling every 15 seconds catches other villagers' completions. Reduced motion suppresses moving sparks.
- All mock flows run without GPU/model/voice services. No paid providers were invoked for implementation or QA.

Choices and compatibility:
- POST adds and DELETE removes instead of ambiguous server-side toggling, making retries safe.
- Migration is `apps/api/migrations/014_reactions.sql`; 013 was the highest existing number when checked.
- Historical wins/stars are backfilled idempotently. Old completed goals have no recorded completion time, so their original creation time is retained. Historical level changes cannot be reconstructed reliably and are not invented.
- Reactions use application-validated polymorphic targets because activity/check-in tables are Timescale hypertables. Aggregates are fetched once per result page.
- All edits stay within `apps/api/**`, `apps/web/**`, and the explicitly allowed `packages/contracts/api.md`.

Changed files:
- API: `app/{main,domain,competitions,weekly,reactions}.py`, `migrations/014_reactions.sql`, `tests/test_feat001.py`, `tests/test_catalog_registry.py`, `scripts/feat001_server.py`.
- Web: `package.json`, `src/App.tsx`, `src/styles.css`, `src/api/{types,client,mock,auditMock,reactions,reactionMock,reactions.test}.ts`, `src/components/{Accomplishments,ReactionBar,ProfilePanel}.tsx`, `src/scene/VillageScene.tsx`.
- QA: `tests/feat001.config.ts`, `tests/feat001.spec.ts`, this report, and `tests/artifacts/feat001/*.png`.
- Contract: `packages/contracts/api.md`, additive v2 documentation. No outstanding contract proposal.

Try it:
1. Offline: from `apps/web`, set `VITE_MOCK=1`, run `bun run dev`, open My profile, mark the goal done, close the profile, then open Accomplishments. React and switch Play as to see counts and viewer-specific highlights. On mobile use More → Accomplishments.
2. Existing API: load secrets through `VILLAGE_ENV_FILE` at runtime, run the existing migration command (`uv run python -m scripts.migrate`) from `apps/api`, and start the normal API/web servers. No asset generation is required.
3. Isolated real-mode QA: from `apps/api`, run `uv run python -m scripts.feat001_server`. It seeds a private schema in `village_test`, serves port 8021, disables paid providers, and drops its schema on normal Ctrl+C shutdown. From `apps/web`, set `FEAT001_REAL=1` and run `bunx playwright test --config tests/feat001.config.ts`. Start a fresh QA server/schema for a full repeat (the first test completes its seeded goal).
4. Focused offline browser checks: `bunx playwright test --config tests/feat001.config.ts` with `FEAT001_REAL` unset.

Screenshots, visually inspected:
- `tests/artifacts/feat001/real-desktop-wall.png`
- `tests/artifacts/feat001/real-mobile-wall.png`
- `tests/artifacts/feat001/real-profile.png`
- `tests/artifacts/feat001/real-laptop-wall.png`
- Corresponding mock desktop/mobile/profile captures are included.

Real-mode captures use this branch's FastAPI and PostgreSQL with synthetic seeded villagers and fixture avatars, not intercepted API responses. The rollback test alone deliberately intercepts one reaction failure.

Validation (commands run from the indicated app directory):

| Directory | Command | Exit | Result |
|---|---|---:|---|
| `apps/api` | `.venv/Scripts/python.exe -m pytest -q tests/test_v2.py` | 0 | 18 passed |
| `apps/api` | `.venv/Scripts/python.exe -m pytest -q tests/test_feat001.py` | 0 | 5 passed, including concurrent retries, village boundaries, all target kinds/palette, profile/feed aggregation, achievements, and idempotent historical backfill |
| `apps/api` | `.venv/Scripts/python.exe -m pytest -q` | 1 | 279 passed, 2 skipped; 1 stale catalog-count assertion and 1 PostgreSQL connection-timeout setup error |
| `apps/api` | `.venv/Scripts/python.exe -m pytest -q --lf --tb=short` | 0 | Both failed/setup-error cases passed; all 281 executed API cases now covered by passing runs |
| `apps/api` | `.venv/Scripts/python.exe -m ruff check app/reactions.py tests/test_feat001.py scripts/feat001_server.py app/main.py app/domain.py app/competitions.py app/weekly.py` | 0 | All checks passed |
| `apps/web` | `bun run test` | 0 | 39 passed, 261 assertions |
| `apps/web` | `bun run build` | 0 | TypeScript and production build passed; existing large-bundle advisory only |
| `apps/web` | `bunx playwright test --config tests/feat001.config.ts` | 0 | 3 mock cases passed; real-only failure injection skipped |
| `apps/web` | `bunx playwright test --project mock` | 1 | 32 passed; 3 exposed the feed/profile overlap subsequently fixed |
| `apps/web` | `bunx playwright test --project mock --grep 'WEB-010 shop\|AI journal\|avatar consent' --timeout 120000` | 0 | All 3 corrected regressions passed; all 35 mock regression cases now covered by passing runs |
| `apps/web` | `$env:FEAT001_REAL='1'; bunx playwright test --config tests/feat001.config.ts` | 1 | Final fresh-schema run: 3 passed (desktop, mobile, laptop); retry case exceeded the assertion's 15-second wait while the HTTP client permits 30 seconds |
| `apps/web` | `$env:FEAT001_REAL='1'; bunx playwright test --config tests/feat001.config.ts -g 'real reaction error'` | 0 | 1 passed after allowing the assertion to wait for the HTTP deadline; verifies rollback, retry, and the final persisted selection. All 4 real-mode cases have passing results |

Initial real-mode runs exposed slow-start fallback during a redundant second navigation in the test harness. The harness now verifies Connected after its single navigation and retries startup only; it never silently accepts mock mode. Real-mode desktop persistence, mobile reactions, laptop access, and failed-request rollback have each passed against the isolated API. The QA server was stopped and its private schema removed. Existing tracked regression screenshots were restored; only this task's captures are included.

The full API run found a pre-existing registry expectation of 138 entries. The shipped `packages/catalog/catalog.json` contains 142 (last changed by `6e8f33c`), so the API test expectation was corrected to 142; the catalog itself was not edited. Its asset-existence, legacy-parity, and progression assertions all pass. The other API issue was a transient five-second database connection timeout and passed on rerun.

Final status: no unresolved implementation or validation failures. Two explicitly opt-in paid Gazette integration tests remain skipped (`API011_LIVE_GAZETTE`, `API012_LIVE_GAZETTE`). No blockers, no outstanding contract changes, no secrets copied, and no push/merge performed.
