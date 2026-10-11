---
id: INTEG-005
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-005 (from main)
allowed_paths: [apps/**, packages/**, assets/**, workers/**, docs/**]
---
# INTEG-005 — Land INTEG-003 + the next finished batch

Main has moved since INTEG-003 branched (main now has INTEG-004: WEB-025/FIX-005, migration 022; WEB-026 Settings redesign;
FEAT-011 iMessage evidence, migration 025). Merging `integ/INTEG-003` into main conflicts in ~11 files. Same rules as
INTEG-001..004 (read their reports), keeping BOTH sides' behavior. Merge in order with `git merge --no-ff`:
1. `integ/INTEG-003` (FEAT-008 farm/paddocks/pigeons, FEAT-009 study nook, ASSET-007 shop art r1; migrations 020 and 021 are fine,
   since 022 and 025 are taken and 023/024 are free). Known conflicts: test_catalog_registry.py, playwright.config.ts (union),
   App.tsx, Modals.tsx, ProfileOutfit.tsx, VillageScene.tsx, itemColors.test.ts (keep the `firstMesh()` helper), styles.css,
   catalog.json (union + regenerate dist + fix counts), api.md (keep all sections).
2. `web/WEB-027`: single-photo camera capture (camera only; no multi-angle).
3. `web/WEB-028`: colosseum-first Compete.
4. `asset/ASSET-008`: materials, 60 house variants, rebuilt rewards. It was BASED ON asset/ASSET-007, so it merges cleanly after
   step 1. Also implement its proposed API fields so house picks persist server-side: `house_variant` and `house_materials`
   (migration **023**, validated against the registry; exposed on village/people payloads; PATCH via the house editor endpoint
   from WEB-020; api.md; pytest), and wire the House editor to save them (it currently uses localStorage).
5. `asset/ASSET-009`: nature variety pack + distinct shop/arcade buildings (assets + registry only).
Run all checks (API pytest, web typecheck/test/build, catalog, asset validator, all branch e2e suites) using scratch DBs only.
All green. Don't merge to main. Final report: conflicts and resolutions.


## Integration report

Branch: `integ/INTEG-005`; task baseline `d66ae5c`. All four requested branch tips
are ancestors. No push or merge to main. Changes are restricted to allowed paths.
Implementation is integrated; acceptance is **blocked by WEB-028 transition timing**.
The final native-GPU run passes eight functional tests but records a 133.4 ms frame,
exceeding the unchanged 50 ms assertion. The requested "all green" condition is unmet.
No development DB migrations, paid generation, real messages or Solana transactions.
Runtime credentials load from the external `VILLAGE_ENV_FILE`; no secret values copied.

### Milestones

- `b74062b`: merge INTEG-003 (farm, paddocks, pigeons, study nook and shop art).
- `397813f`: merge WEB-027 (single-photo camera capture).
- `31ebb1f`: merge WEB-028 (colosseum-first Compete).
- `40bd197`: merge ASSET-008 (materials, house variants and authored rewards).
- `823f7d4`: complete the 258-entry catalog union and regenerate distribution.
- `155909c`: migration 023, registry validation, scoped house persistence and camera integration.
- `2350cfb`: house persistence, variant/paddock and shared-registry verification.
- `7385577`: authored reward expectations and neighbor-profile browser coverage.
- `043c27b`: explicit native-GPU browser QA configuration, retaining software defaults.

### Conflicts and resolutions

| Merge | Conflicting paths | Resolution |
| --- | --- | --- |
| INTEG-003 | API `tests/test_catalog_registry.py`; web `playwright.config.ts`, `src/App.tsx`, `src/components/{Modals,ProfileOutfit}.tsx`, `src/scene/{VillageScene.tsx,itemColors.test.ts}`, `src/styles.css`; catalog JSON/generated TS; `packages/contracts/api.md` | Union farm/study suites, shop department navigation, settings links, photo creation, farm showcase slots and scene imports. Keep `firstMesh()` traversal. Combine all CSS and contract sections. Union catalog entries and regenerate rather than selecting generated output. Preserve migrations 020/021, photo/guest 022 and iMessage evidence 025. |
| WEB-027 | web `src/components/{CompetitionsPanel,Modals}.tsx` | Union camera imports with Colosseum and photo-item imports. Preserve single-photo multipart/consent flows; no multi-angle code. |
| WEB-028 | web `src/components/CompetitionsPanel.tsx` | Keep camera evidence capture alongside pot-intent and colosseum-first navigation. |
| ASSET-008 | web `src/scene/{Cosmetics,OptionalModel,VillageScene}.tsx`, `cosmeticAssets.ts`; `assets/{CATALOG.md,check_glb.py}`; catalog JSON/generated TS | Retain FIX-004/FIX-005 generated-head fitting, clothing skeleton ownership/disposal and per-item colors. Add catalog-authoritative reward models, protected untinted material details and torso badge attachment. Combine surfaces with study animation and paddock transforms. Union farm/study/arena/variant budgets and skinned outfit/jacket checks. Regenerate asset documentation and the final 258-entry catalog. |

### Implementation and choices

- Migration `023_house_options.sql` adds nullable JSONB membership fields `house_variant`
  and `house_materials`; existing migration ordering remains intact.
- `PATCH /api/me` uses the WEB-020 settings endpoint, requires village membership,
  updates only the caller's house in that village, and saves all four house fields
  atomically. Village and `/users/{uid}` profile payloads expose both new fields.
- Shared choices live in `packages/catalog/house-options.json`. API validation rejects
  unknown keys/values and checks nonclassic variants against all six styles in the
  catalog. Registry tests verify material recipes and variant model mappings.
- Omission preserves a field; null/empty objects restore defaults; supplied maps replace
  previous maps. Future-level choices are allowed without granting house progression.
- The editor saves to the API and uses API values for town/showcase rendering. Removed
  user-global localStorage house overrides, including the fallback that could leak a
  user's choice into another village. Mock API uses equivalent scoped state/validation;
  its fixtures intentionally reset on reload. Real browser QA checks reload and a fresh
  neighbor session against the scratch API.
- The profile Make it real button now wraps the complete WEB-025 token/refund/equip UI,
  and that UI uses WEB-027's shared camera sheet. This preserves both entry points and
  avoids two implementations with different token behavior.
- Preserve the Mayor gather `phase < 120` condition, camera consent, Settings, earn-only
  rewards, iMessage evidence, generated-head fits, and GPU-offline/procedural fallbacks.
- All classic and new house variants are checked against paddock/neighbor boundaries.
- Geometry-only unit loaders skip texture decoding; browser QA verifies actual textures.
  This prevents a combined Bun suite from hanging on happy-dom image loading.
- Round-two thumbnail validation targets its 29 authored shop cards plus 60 variants;
  later outfits and farm entries retain the established icon/model fallback.
- Browser QA can opt into native rendering with `VILLAGE_BROWSER_GPU=hardware`.
  On Windows this enables GPU, bypasses the blocklist and selects ANGLE D3D11;
  simply removing SwiftShader flags still selected software rendering. The existing
  `VILLAGE_ARENA_HARDWARE_QA=1` alias remains supported. No production renderer
  experiments or changes to the strict frame assertion are included.

### Verification

Verification (commands use PowerShell environment assignments where indicated):

| Directory | Command | Exit/result |
| --- | --- | --- |
| apps/api | `python -m uv run pytest -q --tb=short` | 0; 379 passed, 3 expected opt-in skips (435.47 s) |
| apps/web | `bun run typecheck` | 0 |
| apps/web | `bun run test` | 0; 96 tests / 11,056 assertions |
| apps/web | `bun run build` | 0; existing large-chunk advisory |
| packages/catalog | `bun run validate` | 0; 258 entries regenerated |
| packages/catalog | `bun test` | 0; 29 tests / 162 assertions |
| repository | `python assets/check_glb.py` | 0; 251 GLBs, zero failures |
| repository | `python assets/test_check_glb.py` | 0; 26 regressions |
| repository | `python assets/validate_round2_008.py` | 0; 60 variants, 10 designs, 89 thumbnails |
| repository | `python assets/validate_shop_007.py` | 0; 16 preserved/rebuilt model contracts, 29 thumbnails |
| repository | `python assets/validate_houses_006.py` | 0; 28 original house contracts |
| repository | `python assets/catalog.py` | 0; 251-model documentation |
| repository | `node apps/web/node_modules/@playwright/test/cli.js test --config assets/round2.playwright.config.ts` | 0; 2 browser cases (skins, materials, saved choices and offline controls) |
| apps/api | `python -m uv run pytest tests/test_feat003.py tests/test_house_options.py -q --tb=short` | 0; 22 tests |
| apps/api | `INTEG_E2E=1 INTEG_E2E_CONFIG=playwright.integ005-house.config.ts python -m uv run pytest tests/test_integ_e2e.py -q -s --tb=short --basetemp=.runtime/integ005-house-verified` (PowerShell environment assignments) | 0; 1 harness / 1 browser case; reload plus fresh neighbor session |
| repository | `python -m uv run --project apps/api ruff check apps/api/app/house_options.py apps/api/app/models.py apps/api/app/main.py apps/api/tests/test_house_options.py` | 0 |
| apps/web | `bunx playwright test farm.spec.ts equipment.spec.ts colors.spec.ts house.spec.ts web025.spec.ts --config playwright.integ004.config.ts --project=mock --trace=off --timeout=120000` | 0; all 13 cases |
| apps/web | `bunx playwright test --config playwright.web027.config.ts`, then the same command with `--last-failed` | initial 1: 13 passed / 2 failed; rerun 0: remaining 2 passed; all 15 camera cases passed across runs |
| repository | `node apps/web/node_modules/@playwright/test/cli.js test --config assets/shop007.playwright.config.ts` | 0; 2 cases |
| apps/api | `INTEG_E2E=1 INTEG_E2E_CONFIG=playwright.colosseum.config.ts VILLAGE_BROWSER_GPU=hardware python -m uv run pytest tests/test_integ_e2e.py -q -s --tb=short --basetemp=.runtime/integ005-arena` | 0; 1 harness / 1 real browser case, 3 mock-only skips |
| apps/api | `INTEG_E2E=1 INTEG_E2E_CONFIG=playwright.feat009-real.config.ts VILLAGE_BROWSER_GPU=hardware python -m uv run pytest tests/test_integ_e2e.py -q -s --tb=short --basetemp=.runtime/integ005-study-final` | 0; 1 harness / 1 real study browser case; 74.98 s |
| apps/web | `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.feat009.config.ts` | 0; both GLB and offline study cases; 1.5 min |
| apps/web | `VILLAGE_BROWSER_GPU=hardware bunx playwright test --config playwright.web028.config.ts` | **1; 8 passed, 1 real-only skip, 1 strict performance failure**; 133.4 ms max, 3 frames over 50 ms, NVIDIA RTX 5090 D3D11 |
| repository | `git diff --check` and four `git merge-base --is-ancestor <branch> HEAD` checks | 0 each |

Initial failures and corrections: catalog dependencies were absent (installed with
`bun install --no-save`); the round-two union initially omitted later entries and was
corrected/regenerated to 258; Node required JSON import attributes; a Bun geometry
loader needed texture decoding disabled under happy-dom. The first API invocation
from the repository root failed its relative basetemp path; all subsequent API
commands run from `apps/api`. The first complete API suite was 378 passed / one stale
Champion Mantle tint assertion / three opt-in skips; the assertion now follows its
authored asset and registry metadata, and its targeted suite passes. Browser runs
started while catalog generation was still changing modules suffered HMR state resets
and stale direct-import API instances; fresh-server runs use stable source. One
new real browser test assumed an editable House tab/dialog on a neighbor's desktop
profile; corrected to its existing read-only showcase/aside. Renamed that real-only
test to avoid the older unanchored `house.spec.ts` mock matcher. Software-only concurrent
browsers also exceeded old 45-second case limits; the combined regression rerun allows
120 seconds without changing assertions.
All API invocations run from `apps/api`, with `VILLAGE_ENV_FILE` pointing to the external
file. The fixtures reject any DB other than `village_test`, create private schemas, and
clean them up. Real browser runs use `tests/test_integ_e2e.py` and its synthetic seed.

### Teammate walkthrough

From `apps/web`, set `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, then run
`bun run dev --port 5584`. Select Iraj. Try My profile > House (architecture/materials),
Shop > Farm Store (earn village XP via Debug first), Studying in the idle picker,
Make it real > Take a photo, and Compete's arena/banner navigation. Missing models
retain procedural controls and fixture avatars.

For persistent house verification, from `apps/api` set `VILLAGE_ENV_FILE` to the external
env, `INTEG_E2E=1`, and `INTEG_E2E_CONFIG=playwright.integ005-house.config.ts`; run
`python -m uv run pytest tests/test_integ_e2e.py -q -s --tb=short --basetemp=.runtime/integ005-house-check`.
The harness starts a scratch API on 8021 and Vite on 5496; leave those ports free.
The API must include migration 023 for live house saves; this task does not migrate
or seed the development DB. Contract changes are implemented in `api.md`, with no
pending proposal to another owner.

Changed-file inventory: `docs/tasks/INTEG-005-files.txt` (relative to task baseline).


Visual QA completed for `apps/web/tests/screenshots/INTEG-005/house-real.png`
and `house-neighbor.png`: saved architecture/materials are visible in the editor and
in the neighbor's town. All people in these captures use synthetic fixture avatars.
Additional evidence in that directory includes the mobile camera confirmation,
farm paddock, shop, round-two editor, real study day/night views and arena views.

### Remaining acceptance blocker

WEB-028 arrived with a documented strict frame-time failure in
`apps/web/WEB-028-REPORT.md` (200.1 ms final capture on SwiftShader).
This integration reproduced it on both software and native hardware. The final
unmodified-production capture reports a 133.4 ms maximum and three frames over
50 ms on NVIDIA GeForce RTX 5090 D3D11. Functional arena flows, missing-model
fallback, reduced motion and the live scratch-API case pass. This does **not**
certify the frame-time criterion or satisfy the task's all-green requirement.

Profiling identified WebGL context creation and initial shader compilation among
the stalls. Isolated experiments with asynchronous shader compilation and keeping
the arena context mounted still exceeded the threshold; they were not promoted
to production. Further renderer optimization is required before acceptance.
The strict test was neither skipped nor weakened.

Evidence: `apps/web/tests/screenshots/INTEG-005/arena-transition-performance.json`
and `arena-transition-trace.zip`. From `apps/web`, inspect with
`bunx playwright show-trace tests/screenshots/INTEG-005/arena-transition-trace.zip`.
There are no pending contract proposals; both new house fields are implemented.
