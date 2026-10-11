# FEAT-014 delivery

Branch: `feat/FEAT-014`. API milestones: `e75e151`, `bb5b47a`.
The final UI commit also contains this report; use `git log -1` for its hash.

## Behavior and choices

- Open / Current / Mine / Past are the only view switch. Open lists all unsettled competitions so joined participants and auditors can still use it. Mine includes creator, auditor, and participant memberships. Past shows final ranks, winner names, podium and confetti.
- Cumulative remains the default for existing competitions. Scoreboard accepts decimal values and a required unit, with optional target progress. Ordinal ranks confirmed completion/target crossing time, then submission time, then user ID for an exact tie. Unfinished racers cannot win.
- Correcting a confirmed numeric value records a new confirmation time; identical retries preserve the timestamp. Pending entries block settlement, which remains authorized and idempotent.
- Friendly mode supports all three scoring modes with self-confirmation and no XP. Audited numeric totals award floored XP capped at 500, preserving the existing settlement cap.
- The auditor sees a VIP camera, paginated pending queue, evidence, claimed value, AI advisory verdict, editable decision/reason, A/R and J/K shortcuts, fee/payout intent preview, and settlement. Shortcuts pause in text fields and nested dialogs. Contestants see the auditor indicator.
- Offline fixtures and missing-model fallbacks remain usable. No paid provider generation or blockchain transactions were used.

## Files changed

API:
- `apps/api/app/competition_models.py`
- `apps/api/app/competition_scoring.py`
- `apps/api/app/competitions.py`
- `apps/api/migrations/047_competition_scoring.sql`
- `apps/api/tests/test_competition_scoring.py`
- `packages/contracts/api.md`

Web:
- `apps/web/src/api/{types.ts,client.ts,auditMock.ts}`
- `apps/web/src/components/{Colosseum.tsx,CompetitionsPanel.tsx,colosseum.css,colosseumData.ts,colosseumData.test.ts}`
- `apps/web/src/scene/ColosseumScene.tsx`
- `apps/web/playwright.feat014.config.ts` and `apps/web/playwright.feat014-perf.config.ts`
- `apps/web/tests/{feat014.spec.ts,audits.spec.ts,colosseum.spec.ts,web028.spec.ts}`
- `apps/web/tests/screenshots/FEAT-014/*.png`
- `apps/web/FEAT-014.md`

## Validation

Commands from the repository root unless stated otherwise. API tests load the external env file at runtime using `VILLAGE_ENV_FILE`; only the isolated `village_test` database is used.

| Command | Final result |
| --- | --- |
| `python -m uv run --directory apps/api pytest tests/test_competition_scoring.py tests/test_api003.py -q` | Exit 0; 36 passed |
| `python -m uv run --directory apps/api ruff check app/competition_models.py app/competitions.py app/competition_scoring.py tests/test_competition_scoring.py` | Exit 0 |
| `bun run test` (apps/web) | Exit 0; 128 passed |
| `bun run typecheck` (apps/web) | Exit 0 |
| `bun run build` (apps/web) | Exit 0; existing bundle-size warning |
| `bunx playwright test --config playwright.feat014.config.ts` (apps/web; initial three-suite configuration) | Exit 0; 10 passed, 1 live-server-only screenshot test skipped |
| Supplemental Web028/renderer checks (command below) | Exit 1; 3 checks passed; separate 50 ms frame budget failed on SwiftShader (716.6 ms maximum) |
| `$env:VILLAGE_BROWSER_GPU="hardware"; bunx playwright test --config playwright.feat014-perf.config.ts` (apps/web) | Exit 0; 1 passed; RTX 5090 maximum frame 33.5 ms (budget 50 ms) |
| `git diff --check` | Exit 0 |

Supplemental command (apps/web; temporary Web028 inclusion):

```powershell
bunx playwright test --config playwright.feat014.config.ts web028.spec.ts colosseum.spec.ts --grep "arena first|reduced motion|record transition|arena renderer"
```

Earlier runs found and fixed unfinished-racer ordering, a mobile status caption intercepting the Village button, and old selectors for removed controls. The legacy colosseum regression command initially exited 1; its functional suites subsequently passed under the FEAT-014 configuration. Production code was unchanged during the final validation runs.

Screenshots were visually inspected: `auditor-booth.png`, `auditor-mobile.png`, `create-scoreboard.png`, plus cumulative/ordinal and settled desktop/mobile captures in `apps/web/tests/screenshots/FEAT-014/`.

## Try it

1. Run the normal API migration (`python -m uv run --directory apps/api python scripts/migrate.py`) against your development database with `VILLAGE_ENV_FILE` pointing to the shared env file. Start the API and web normally.
2. For a zero-provider demo, start web with `VITE_MOCK=1`, `VITE_DEMO_AUTH=1`, and `VITE_VILLAGE_ID` empty, then `bun run dev` from apps/web.
3. Choose the Iraj demo seat, open Compete, and select The seven-day sprint for the auditor booth. Enter a reason and approve an entry; the standings update. J/K changes the queue selection; A/R saves a decision outside text fields.
4. Create a challenge using each scoring picker option. For scoreboard, enter hours and target 10; join through Open and submit a value. Switch Current/Mine/Past using the left rail. Settle after deciding every pending entry.

## Blockers and contracts

No functional blockers. SwiftShader exceeded the separate Web028 frame budget; the NVIDIA hardware run passed it. The permitted `packages/contracts/api.md` is updated. No additional contract changes are proposed. Apply the migration before deploying the new API. Shared/live deployment and the live-server-only screenshot test were not performed.
