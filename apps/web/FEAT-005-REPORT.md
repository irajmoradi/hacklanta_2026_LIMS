# FEAT-005 — Competition Colosseum

Branch: `feat/FEAT-005`.

Implementation commits:
- `314ffeb` — validated GLB, contact render, scene-only building registry.
- `048e7f4` — arena UI, evidence inspection, confirmed joining, fixtures and tests.

The frontend and asset work is implemented. Full live team/XP/owner-review behavior
needs the contract additions below. The 60 fps laptop acceptance criterion remains
unverified: this environment exposes only a software renderer.

## Behavior and choices

- Competition list includes All, Open to join, and Current filters. Detail previews
  warm the selected view. Opening a competition mounts the arena immediately, with
  a procedural scene while data/assets load; the entrance animation is 240 ms.
- The village stays mounted with its render loop paused, preserving its camera.
  Returning to town resumes it. Arena camera dollies take 320 ms; reduced-motion
  preference removes the entrance animation and makes the dolly immediate.
- Open view closes the gate and puts only joined participants outside it. Terms
  show rules, auditor, mode, available dates, XP support, SOL intent and auditor fee.
  Joining uses a dark-red button, existing `event_drumroll` SFX, a native modal cost
  confirmation, and the existing join endpoint. No SOL transaction is signed/sent.
- Current view places the top three on the numbered podium and other participants
  on the floor. Rank is competition ranking by confirmed points (1,1,3 for a tie),
  with deterministic ID ordering for physical positions. Pending/rejected entries
  cannot contribute. Tied participants have distinct physical slots.
- Participant badges and the keyboard-accessible leaderboard open the same card:
  portrait, score/rank or team share, evidence thumbnails, dates, human decision and
  auditor note. Team share means confirmed participant points divided by confirmed
  points within that participant's team; an empty team total displays 0%.
- Assigned auditors can approve/reject pending evidence, set points and give a
  required note. Existing create, submit, decide, settle and devnet-pot controls
  remain under **Submit / manage competition**.
- Escape backs out of an evidence image, then participant inspection, then the arena.
  Native dialogs trap focus. A nested dialog cancellation no longer closes its parent.
- Dusk colors, emissive flickering braziers, light dust and the existing crowd loop
  respect the sound lifecycle. No shadow-casting torch lights. Three instanced
  stand tiers and static geometry batched by material reduce draw calls.
- Mock data has an open challenge, current ordinal challenge and current team
  challenge. Evidence images are original synthetic SVG charts stored as mock blobs.
  Generated avatar assets and the GPU worker are optional.

The API has only `open`/`settled`, so **Current** means unsettled competitions;
open/current may overlap. Open-to-join additionally checks participation and auditor
eligibility. No unsupported start/end enforcement or XP debit is invented.

## Asset

`apps/web/public/models/colosseum.glb`: 3,414 unique mesh triangles, 4,386 including
repeated stand instances, below 12,000. Shared village palette, +Y up, +Z entry,
ground origin, no external textures. Includes sand floor, three stand tiers,
arches, banners, emissive braziers, gate and podium numbers 1/2/3.

Registry kind is `building`, tagged `separate_scene`, excluded from town lots and
progression/shop. The validator rejects town unlocks or shop tags on such buildings.
Rebuild instructions and node hooks: `assets/COLOSSEUM.md`.

## Files changed

- `assets/blender/colosseum.py`, `assets/check_glb.py`, `assets/COLOSSEUM.md`,
  `assets/previews/colosseum_contact.png`.
- `packages/catalog/catalog.json`, `packages/catalog/dist/catalog.ts`,
  `packages/catalog/validate.ts`, `packages/catalog/validate.test.ts`.
- `apps/web/public/models/colosseum.glb`.
- `apps/web/src/components/Colosseum.tsx`, `colosseum.css`, `colosseumData.ts`,
  `colosseumData.test.ts`, `CompetitionsPanel.tsx`, `shared.tsx`.
- `apps/web/src/scene/ColosseumScene.tsx`, `VillageScene.tsx`, `layout/town.ts`.
- `apps/web/src/App.tsx`, `src/sound/SoundControls.tsx`,
  `src/api/auditMock.ts`, `src/api/mock.ts`, `package.json`.
- `apps/web/playwright.colosseum.config.ts`, `tests/colosseum.spec.ts`,
  `tests/audits.spec.ts`, this report.

No API, contract, root or secret files were changed. Real screenshots remain local
test artifacts; no real people's photos were committed.

## Verification

Commands were run in the indicated directory. Exit codes below are actual results.

| Directory | Command | Result |
|---|---|---|
| Root | Blender `--background --python-exit-code 1 --python assets/blender/colosseum.py` | 0; GLB exported, imported and rendered |
| Root | `python assets/check_glb.py` | 157 GLBs, zero failures (output piped to `Select-Object -Last 4`); direct Colosseum validation also exited 0 |
| Root | `python assets/test_check_glb.py` | 0; 24 tests |
| `packages/catalog` | `bun run validate` | 0; 162 entries |
| `packages/catalog` | `bun test` | 0; 25 tests |
| `apps/web` | `bun run typecheck` | 0 |
| `apps/web` | `bun run build` | 0; existing large-chunk warnings |
| `apps/web` | `bun run test` | 0; 45 tests, including Colosseum unit tests |
| `apps/web` | `bun test src/components/colosseumData.test.ts src/scene/layout/town.test.ts src/sound/engine.test.ts` | 0; 16 tests |
| `apps/web` | `bunx playwright test --config playwright.colosseum.config.ts` with `VILLAGE_ARENA_HARDWARE_QA=1` | 0; 7 passed, 4 intentional cross-project skips |
| `apps/web` | `bunx playwright test --config playwright.colosseum.config.ts --project=regression` | 0; 3 passed; audited/friendly create-submit-review-settle flows and weekly review |
| `apps/web` | `bunx playwright test --config playwright.colosseum.config.ts --project=mock` | 0; 3 passed, 1 intentional skip; rerun after nested-dialog fix, including both approve/reject |
| `apps/web` | `bunx playwright test --config playwright.colosseum.config.ts --project=real` | 0; 1 passed, 3 intentional skips; final read-only connected capture and no-NaN pot assertion |
| Root | `git diff --check` | 0 |

Early runs caught a TypeScript tuple error, full-screen style specificity and nested
Escape behavior; these were fixed and rerun. One loaded-machine real-mode run hit
the original 5-second assertion timeout; connected QA now allows 15 seconds and
passed. The default e2e configuration's port 5174 was occupied by another server;
the dedicated config uses ports 5184/5185 without stopping unrelated processes.

## Screenshots and performance

Visually inspected local artifacts:
- `assets/previews/colosseum_contact.png` — exported asset render (committed).
- `apps/web/test-results/colosseum-current-real.png` — connected arena.
- `apps/web/test-results/colosseum-open-real.png` — connected gate and terms.
- `apps/web/test-results/colosseum-evidence-real.png` — connected participant evidence.
- `apps/web/test-results/colosseum-evidence-mock.png` — synthetic evidence and ranking.
- `apps/web/test-results/colosseum-mobile-mock.png` — 390 × 844 HUD/terms.
- `apps/web/test-results/colosseum-fallback-mock.png` — missing GLBs.
- `apps/web/test-results/colosseum-performance.json` — renderer/frame timing.

The timing test confirms a 240 ms entrance animation and exact viewport-sized
dialog. Both default and hardware-requested runs report ANGLE SwiftShader, not a
physical GPU. Median frame intervals were 50–100 ms under this software-rendered
test workload; this does **not** meet or verify 60 fps. Physical laptop-GPU testing
is still required. The browser data/assets may load after the fixed transition;
fallback geometry is displayed during that time.

## Teammate trial

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5184
```

Open `http://localhost:5184`, choose **More → Compete**, then **Open to join → The
next chapter** to confirm entry. Open **The seven-day sprint**, select Lance's
badge, inspect the synthetic evidence and approve/reject as Iraj (assigned auditor).
Use **Together to the summit** for team percentages. Escape backs out; **Back to
village** restores the preserved town view. Missing model requests may be blocked
to try the procedural fallback.

Connected QA uses the existing API at `http://localhost:8010`, demo village
`13370000-0000-4000-8000-000000000000`, and its **Study streak** competition. The
dedicated real test performs reads only. Set `VILLAGE_ENV_FILE` at runtime to the
provided root environment path if needed; do not copy it into this worktree.

## Blockers and proposed contract changes

1. Add explicit `mode`, participant `team_id`/team names, `starts_at`, `ends_at`
   and join deadline/phase. These are fixture presentation metadata today; live
   competitions default to ordinal and show dates as unspecified.
2. Define XP entry stake, auditor fee and debit/refund semantics before an XP-cost
   join can be implemented. Current API stores SOL intent and executes no payment;
   the UI shows 0 XP and clearly states XP stakes are unsupported.
3. Owner review is requested but the decision endpoint authorizes **only the
   assigned auditor**. Return `can_decide` or extend authorization to owners before
   enabling owner-only review buttons. The frontend follows existing authorization.
4. Standardize participant `entry_lamports_intent` (deployed API) versus
   `entry_lamports` (older frontend/fixtures). The new pot reader handles both.
   Include entry `created_at` in the typed competition contract.
5. The live Study streak evidence asset returns HTTP 500; the evidence card shows
   the existing retry UI. Repair asset storage/serving on the API side. No API
   changes or fabricated replacement evidence were made here.
6. Verify the 60 fps criterion on a physical laptop GPU. Software-only timing is
   recorded above, so this acceptance item is explicitly outstanding.
