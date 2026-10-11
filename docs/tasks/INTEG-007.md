---
id: INTEG-007
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-007 (from main)
allowed_paths: [apps/**, packages/**, assets/**, docs/**]
---
# INTEG-007 — Land currencies + bigger map, and make the map fast

Same rules as earlier INTEG tasks (read their reports), keeping BOTH sides' behavior. Merge in order with `git merge --no-ff`:
1. `feat/FEAT-007`: coins/SOL/XP (R-37). Its migration `027_coins.sql` collides with main's `026_disasters.sql`, so renumber it to
   **027** (+ references). Main since branched: WEB-030 (profile tabs + HUD layout), FEAT-012 (disasters + revival potions), so
   revival potions and any new shop items must be priced in **coins**; the debug menu keeps both +XP and +coins.
2. `web/WEB-029`: bigger organic map (R-59). **Performance gate:** its final sample was 22.8 fps (draw calls 657). Get the town to
   **≥55 fps on the RTX 5090 headed Chromium at 1440×1000** (report SwiftShader numbers separately). Profile first (Chrome
   trace / r3f-perf): likely culprits are per-frame React re-renders of villagers/labels (Html overlays are expensive, so cap
   them, hide offscreen/far labels, update at 10 Hz), shadow-map size/count, unbatched trees/props (InstancedMesh per
   species from the ASSET-009 nature pack), per-frame allocations in useFrame, high DPR (cap at 1.5), postprocessing. Add an
   adaptive quality tier (drop shadows/DPR if fps <45 for 2 s).
Run all checks (API pytest, web typecheck/test/build, catalog, branch e2e, a perf measurement script committed under
apps/web/tests/perf). All green. Don't merge to main. Final report with before/after fps and draw calls.


## Integration report

Branch: `integ/INTEG-007`; baseline `037b01d`. No push or merge to main.

Milestone commits:
- `3b7a41e`: no-fast-forward FEAT-007 merge, coins + disaster recovery + compact HUD.
- `21df6a9`: no-fast-forward WEB-029 merge, organic map + disaster visuals.
- `6fd5d63`: bounded town overlays, shadow cadence, regression coverage, performance harness.
- `054b475`: persist adaptive quality through Canvas reconfiguration.
- Final evidence/report commit: the commit containing this report.

### Delivered and conflict resolution

Kept both sides in every conflict. FEAT-007 overlaps in API demo actions, web
package scripts, App/HUD, mock state, ShopItem, EventTerms, Wardrobe, CSS and
api.md were combined: +XP and +coins, XP/coin rewards with disaster repair terms,
away-pet/consumable restrictions, WEB-030 profile tabs and compact header, and both
contract sections. WEB-029 conflicts in package.json and GridTown retain all
unit suites, organic town geometry, static batching, and disaster effects/closures.

Renamed `026_coins.sql` to `027_coins.sql` and updated its test/report/contract
references. Disaster migration 026 now uses `ADD COLUMN IF NOT EXISTS`, because
main already folded these columns into schema.sql. Catalog is the 259-entry union,
including the 30-coin Revival potion; generated types were regenerated. Revival
charges coin_ledger, remains concurrent/retry safe, and preserves XP. Mock earning
now retains disaster/repair state. The header shows XP, coins and explicitly tagged
devnet SOL without restoring the removed self-card or Mayor card; horizontal
header scrolling preserves all controls at smaller widths.

TownLabel replaces the per-frame Drei overlays for homes/villagers: projected
positions update at 10 Hz through DOM transforms, with no React state update per
frame; offscreen/beyond-180-unit labels are hidden and simultaneous visible labels
are capped at 24. Existing model-species instancing and static model batching are
retained. One 1024-square shadow map updates at 20 Hz, while animation and camera
motion retain display cadence. DPR stays capped at 1.5. After an eight-second
shader warm-up, a two-second window below 45 FPS drops DPR to 1 and disables
shadows; Canvas retains this tier through subsequent renders. Synthetic unit
samples cover warm-up, background tabs, isolated stalls and sustained slow frames.

### Performance evidence

All native samples are headed Chromium at 1440 x 1000, using actual NVIDIA RTX
5090 / ANGLE D3D11. Same synthetic five-person scratch village and daylight.
The committed measurement script asserts the native renderer and >=55 FPS.

| Capture | FPS | p95 frame ms | Main-pass draw calls | Shadows |
| --- | ---: | ---: | ---: | --- |
| WEB-029 published final (historical) | 22.8 | 166.6 | 657 | on |
| Reproduced before performance edits (`21df6a9`) | 142.3 | 7.1 | 657 | on |
| Final native hardware | 127.5 | 13.9 | 657 | on, 20 Hz |
| Final SwiftShader, headless (separate software result) | 5.7 | 350.0 | 657 | off, reduced tier |

The hardware gate passes. The earlier 22.8 FPS was not reproduced. Do not infer
an isolated speedup from these shared-host timings: the reproduced baseline was
already above the gate, and this final sample is slower than that baseline.
The changes bound overlay/shadow work and make degradation reliable; they do not
reduce the reported main-pass draw calls. Three resets gl.info.render.calls after
its shadow pass, so shadow work is excluded from that counter. Both final samples
use DPR 1; 1.5 is the cap on higher-density displays. Software rendering remains
slow and does not certify a 55 FPS software target.

Chrome traces were captured before editing. The baseline ten-second trace records
about 9.6 seconds of animation-frame JavaScript, 31 ms UpdateLayoutTree and 44 ms
minor GC (nested trace durations are not additive). This justified bounding DOM
updates and shadow work rather than adding postprocessing. No postprocessing was
introduced. Compressed original traces, renderer metadata and screenshots are in
`apps/web/artifacts/integ007/`. Read `apps/web/tests/perf/README.md` to reproduce and
load traces. Final screenshots were visually reviewed alongside mobile map and
profile evidence; all people are synthetic fixtures.

### Verification

All commands below were actually run. Environment assignments are PowerShell;
API runs use the external `VILLAGE_ENV_FILE` and private `village_test` schemas,
with paid provider adapters stubbed/disabled. No development DB migration or
Solana transaction was performed.

| Directory | Command | Exit/result |
| --- | --- | --- |
| apps/api | `python -m uv run pytest -q --tb=short` | 0; 400 passed, 3 expected opt-in skips (373.99 s) |
| apps/api | `python -m uv run pytest tests/test_feat007.py tests/test_feat012.py -q --tb=short --basetemp=.runtime/integ007-coins` | 0; 21 passed |
| apps/web | `bun run typecheck` | 0 |
| apps/web | `bun run test` | 0; 109 passed, 142915 assertions |
| apps/web | `bun run build` | 0; existing large-chunk advisory |
| packages/catalog | `bun run validate` | 0; 259 entries |
| packages/catalog | `bun test` | 0; 29 passed, 162 assertions |
| apps/web | `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.integ007.config.ts` | 0; 8 cases (coins, SOL, offline assets, profile tabs, HUD desktop/mobile) |
| apps/web | `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.integ007-disasters.config.ts` | 0; all four disasters and repair, missing models |
| apps/web | `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.integ007-map.config.ts` | 0; real scratch API overview/street/reset/offline/mobile |
| apps/web | `node tests/perf/town.mjs before hardware` | 0; pre-edit trace/sample |
| apps/web | `node tests/perf/town.mjs after hardware` | 0; 127.5 FPS, renderer and FPS gate passed |
| apps/web | `node tests/perf/town.mjs after swiftshader` | 0; 5.7 FPS reported separately, reduced shadows confirmed |
| root | `python -m uv run --project apps/api ruff check apps/api/app/disasters.py apps/api/tests/test_api009.py apps/api/tests/test_feat012.py` | 0 |
| root | `git diff --check` | 0 |

Resolved failures: initial API bootstrap failed on duplicate disaster columns;
subsequent full run had 394 passed / 6 failed / 3 skipped. Four API-009 tests still
expected legacy fog/manual repair instead of cozy disasters/shared check-ins,
one expected 258 catalog entries, and one drained XP instead of coins. Updated
assertions check the new disaster, linked repair, rejection of manual completion,
shared recovery, 259-entry union and insufficient coins. The revived-pet suite
also explicitly proves unchanged XP and concurrent single charging.

Initial browser tests exposed a header overflow after adding currencies and a
Unicode character damaged by shell input; both were fixed. The disaster test must
use its HTTP interception harness (not forced mock mode); its proper harness
passes on dedicated port 5386 because the original port was occupied. An early
TownLabel experiment used a DOM portal in the Three reconciler and failed; the
final separate DOM root is browser-verified. Typecheck caught a readonly ref and
was rerun after correction. A few preliminary commands ran from the wrong cwd
and failed before execution; the table records corrected completed invocations.

### Teammate walkthrough and files

From `apps/web`, set `$env:VITE_MOCK='1'`, `$env:VITE_DEMO_AUTH='1'`, then run
`bun run dev --port 5377`. Choose Iraj; buy an item in Shop and verify coins fall
while XP stays fixed. Use Debug for +XP/+coins, an outbreak and Repair now. Open
My profile and use Overview/Outfit/House/Rewards/Activity; pan/zoom/reset the larger
town. No generated assets or GPU worker are required. For repeatable native perf
and real API map checks follow `apps/web/tests/perf/README.md`; it documents scratch
schema cleanup and the three-terminal setup.

Primary screenshots:
- `apps/web/artifacts/integ007/after-hardware.png`
- `apps/web/artifacts/integ007/after-swiftshader.png`
- `apps/web/artifacts/web029/after-street.png`, `after-fallback.png`, `after-mobile.png`
- `apps/web/artifacts/web030/overview-390.png`
- `apps/web/tests/screenshots/FEAT-007/hud.png`, `shop.png`, `debug.png`

Exact changed-file inventory: `docs/tasks/INTEG-007-files.txt` (against `037b01d`).
Changes are confined to apps, packages and docs. Secrets were loaded only at
runtime, never copied into task artifacts. No blockers or proposed contract
changes remain; api.md already contains the implemented coin/disaster contract.
