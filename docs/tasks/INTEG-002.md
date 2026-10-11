---
id: INTEG-002
status: done
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-002 (from main)
allowed_paths: [apps/**, packages/**, assets/**, workers/**, docs/tasks/INTEG-002.md]
---
# INTEG-002 — Merge the second finished batch

Same rules as INTEG-001 (read docs/tasks/INTEG-001.md, including its report): `git merge --no-ff` each branch in order into
`integ/INTEG-002`, keeping BOTH sides' behavior, never dropping a feature:
1. `feat/FEAT-005`: Colosseum competitions (asset + separate scene + open/current views + evidence card)
2. `feat/FEAT-006`: ~16 outfits + per-item colors. Renumber its migration to the next free number after 017 if it collides.
3. `web/WEB-023`: lazy Gaussian heads, revisioned asset caching (API cache headers), drag-to-rotate previews
Main now includes INTEG-001 (WEB-021, FEAT-001, WEB-020, FEAT-003, FEAT-004; migrations up to 017), WEB-017, FEAT-002, and
the integrator commits (villagergram moderation D-034, imessage ffmpeg/logging, cv shirt fallback). Keep the Mayor-gather
`phase < 120` limit. Catalog: union of entries, regenerate dist, update entry-count assertions. Wardrobe/showcase now
have both FEAT-006 color panels and WEB-023 drag-rotate controls, so integrate them into one coherent preview component.
Run all checks (API pytest, web typecheck/test/build, catalog validate/test, branch e2e suites) using scratch DBs only.
All green. Don't merge to main. Final report: the conflicts and how each was resolved.


## Integration report

Branch: `integ/INTEG-002`. Task baseline: `bc69816`. No push or merge to main.

Merge milestones, in the requested order:
- `6edb71d` Merge FEAT-005: Colosseum competitions and evidence views.
- `6b47a49` Merge FEAT-006: outfits and per-item colors.
- `14eb1fe` Merge WEB-023: lazy heads, revision caching and rotating previews.
- `ba0b30d` Shared preview and catalog/browser integration fixes.
- `876a292` Regression fixtures, equipment color assertion and preview hint layout.
- `ebd8120` Explicit UTF-8 catalog fixture reads on Windows.
- `a5cf3d6` Committed synthetic visual evidence and browser metrics.

### Conflicts and resolutions

| Branch | Conflicting files | Resolution |
| --- | --- | --- |
| FEAT-005 | web `package.json`, `src/App.tsx`, `src/scene/VillageScene.tsx`; catalog JSON, generated TS and validation test | Union test scripts and 169 catalog entries. Add arena sound/scene pause while retaining demo seats, reactions, goal bursts, house navigation and camera gesture/reset handling. Preserve Mayor `phase < 120`. Keep separate-scene Colosseum out of town placement. Regenerate catalog rather than selecting one generated side. |
| FEAT-006 | API `app/{domain,main}.py`, `tests/{test_api,test_arch003,test_catalog_registry}.py`; web `package.json`, `playwright.config.ts`, `src/api/{client,mock,types}.ts`, `src/components/Wardrobe.tsx`, `src/scene/cosmeticAssets.ts`, `src/styles.css`; catalog JSON/generated TS/test; `packages/contracts/api.md` | Combine acquired/source/rarity metadata and colors in equipment/shop projections. Preserve house, idle, pet, voice/gram consent and consumable types. Keep photo-item and color endpoints. Keep prerequisite reasons, focused cards and earned rewards alongside color editing. Combine material-channel palettes with photo-item tint fallback and both styles/contracts. Renumber item colors from 015 to 018. Union all 185 catalog entries and required metadata; update entry count. |
| WEB-023 | web `package.json`, `src/components/shared.tsx`; Wardrobe auto-merged but required semantic integration | Union unit suites. Keep color-aware portrait backgrounds and revisioned head URLs. Wardrobe and house/villager showcases now use the same ShowcasePreview and PreviewMotion controller: mouse/touch rotation, inertia, zoom, reset, keyboard controls and reduced-motion behavior. Keep live color preview/save/cancel, equipment highlighting and fallback models. |

Additional integration corrections:
- API registry now recognizes the same separate-scene building rule as the TypeScript validator; Colosseum is neither a shop item nor a town progression building. Source/rarity remain required catalog metadata.
- Remove the redundant raw JSON shop overlay: the regenerated typed catalog already contains every outfit and preserves requirements/source/rarity. This also restores Node/Playwright import compatibility.
- Keep selection bounds in world space when rotating a showcase; anchor the instruction hint inside the wardrobe preview.
- Reuse the explicit test seat hook for new suites, use the visible mobile seat switcher, update the old preview accessible-name selector and remaining Dev-to-Mario selector.
- Extend the real HTTP browser harness with a synthetic competition, Colosseum and WEB-023 checks. It uses `test_database` (village_test plus a disposable schema), synthetic people, and an empty temporary asset directory. No development DB migrations/catalog sync, generated personal assets, paid provider calls or Solana transactions were used.
- Runtime settings come from `VILLAGE_ENV_FILE`; no secret values were copied into files.

### Validation

Final state: all required cases pass. API: 329 passed / 3 opt-in skipped. Web: 66 unit tests. Catalog: 25 tests. Browser: 35 distinct cases passed across the final runs and targeted retries.

Commands below run from the directory shown. API commands load the external env at runtime; all DB mutations use scratch fixtures. No live-provider opt-in was enabled.

| Directory | Command | Result |
| --- | --- | --- |
| apps/api | `python -m uv run pytest -q` | Initial exit 1: 321 passed, 3 opt-in skipped, one stale equipment assertion, five Windows UTF-8 fixture errors, one DB connection timeout. Fixes and final runs below. |
| apps/api | `python -m uv run pytest -q --lf --tb=short` | Exit 0; all 7 formerly failing/erroring cases passed. |
| apps/api | `python -m uv run pytest -q --tb=short` | Final exit 0: 329 passed, 3 opt-in skipped in 254.95 seconds. |
| apps/web | `bun run typecheck` | Exit 0. |
| apps/web | `bun run test` | Exit 0; 66 tests, 894 assertions. |
| apps/web | `bun run build` | Exit 0 on final UI; existing chunk-size warning only. |
| packages/catalog | `bun run validate` | Exit 0; generated 185 entries. |
| packages/catalog | `bun test` | Exit 0; 25 tests. |
| apps/web | `bunx playwright test --config playwright.colosseum.config.ts --project=mock --project=regression` | Final exit 0; 6 passed, 1 real-only case skipped (passed against scratch API). |
| apps/web | `bunx playwright test colors.spec.ts house.spec.ts --project=mock` | Exit 0; 5 passed, covering normal/offline/missing-base colors and house save/reset. |
| apps/web | `bunx playwright test --config tests/feat003.config.ts` | Final exit 0; 3 desktop/mobile/offline showcase cases. |
| apps/web | `bunx playwright test --config playwright.web021.config.ts` | Initial exit 1; 13 passed, one obsolete preview-name selector failed. |
| apps/web | `bunx playwright test equipment.spec.ts --config playwright.web021.config.ts --grep 'shop and wardrobe'` | Exit 0; the remaining equipment case passed after selector correction. |
| apps/api | `python -m uv run pytest tests/test_integ_e2e.py -q -s --basetemp=.runtime/integ002-browser` with `INTEG_E2E=1` | Initial exit 1; FEAT-001 real 4 passed, WEB-021 real 1 passed, Colosseum real 1 passed (3 mock-only skips), then WEB-023 timed out waiting 5 seconds for wardrobe data. |
| apps/api | `python -m uv run pytest tests/test_integ_e2e.py -q -s --basetemp=.runtime/integ002-web023` with `INTEG_E2E=1` and `INTEG_E2E_CONFIG=playwright.web023.config.ts` | Exit 0; harness and WEB-023 real browser passed with a bounded 30-second data wait. Mouse drag, wheel, pinch, touch, reset and zero town ZIP requests verified. |
| apps/api | `python -m uv run ruff check app/catalog_registry.py tests/test_catalog_registry.py tests/test_api008.py tests/test_integ_e2e.py` | Final exit 0. |
| repository | `git diff --check` | Exit 0. |

Earlier failures corrected during integration: missing local dependencies; missing catalog metadata/API separate-scene support; raw JSON Node import; first-visit seat modal; hidden old mobile Play-as selector; old preview accessible name; equipment projection expectation and explicit UTF-8 schema/catalog reads on Windows. One Colosseum startup encountered a releasing port; retry succeeded without reusing another service. Build/install dependencies used `bun install --no-save` inside allowed app/package paths.

Evidence (all synthetic) is in `apps/web/tests/screenshots/INTEG-002/`: `wardrobe-colors.png`, `wardrobe-offline.png`, `showcase-mobile.png`, `colosseum-mobile.png`, `colosseum-evidence.png`, `colosseum-real.png`, `wardrobe-real.png`, and two JSON metrics files. Wardrobe colors, mobile showcase and mobile Colosseum screenshots were visually inspected. The WEB-023 fixture has zero generated assets, so its zero asset-transfer measurement is not evidence of real-head bandwidth savings; cache behavior is checked by the API cache tests.

### Teammate walkthrough

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5198
```

Open http://localhost:5198 and select Iraj. Shop for Cozy Hoodie; open My profile > Wardrobe > Choose colors. Drag/zoom the preview, try a palette, save, unequip and equip again. Profile showcases use the same controls and retain earned rewards and house details. Open Compete for open/current arena views, explicit join confirmation, participant evidence and assigned-auditor decisions. Everything works without GPU/generated assets.

For real API browser checks, set `VILLAGE_ENV_FILE` to the existing external env path and `INTEG_E2E=1`, then run `python -m uv run pytest tests/test_integ_e2e.py -q -s --basetemp=.runtime/integ002-browser` from `apps/api`. Optional `INTEG_E2E_CONFIG` selects a single config. The harness owns port 8021 and drops its private schema on exit.

### Limitations and contracts

Integration blockers: none.

No new integration contract proposal. The merged item-color contract points at migration 018. Existing FEAT-005 API limitations remain explicit in its UI/report: no XP staking semantics, optional competition dates/team metadata, assigned-auditor-only decisions and intent-only SOL. A physical-GPU 60 fps certification and generated-head/public-tunnel performance are not claimed; browser checks use SwiftShader and fixture avatars. Existing build chunk-size warnings remain.

### Files changed relative to task baseline

- `apps/api/app/assets_cache.py`
- `apps/api/app/catalog_registry.py`
- `apps/api/app/domain.py`
- `apps/api/app/item_colors.py`
- `apps/api/app/main.py`
- `apps/api/migrations/019_item_colors.sql`
- `apps/api/tests/test_api008.py`
- `apps/api/tests/test_catalog_registry.py`
- `apps/api/tests/test_integ_e2e.py`
- `apps/api/tests/test_item_colors.py`
- `apps/api/tests/test_web023.py`
- `apps/web/FEAT-005-REPORT.md`
- `apps/web/FEAT-006-REPORT.md`
- `apps/web/WEB-023-REPORT.md`
- `apps/web/package.json`
- `apps/web/playwright.colosseum.config.ts`
- `apps/web/playwright.config.ts`
- `apps/web/playwright.web023.config.ts`
- `apps/web/public/models/colosseum.glb`
- `apps/web/public/models/outfit_backpack.glb`
- `apps/web/public/models/outfit_bandana.glb`
- `apps/web/public/models/outfit_beanie.glb`
- `apps/web/public/models/outfit_beret.glb`
- `apps/web/public/models/outfit_bow.glb`
- `apps/web/public/models/outfit_bucket.glb`
- `apps/web/public/models/outfit_earmuffs.glb`
- `apps/web/public/models/outfit_flannel.glb`
- `apps/web/public/models/outfit_flower_crown.glb`
- `apps/web/public/models/outfit_hoodie.glb`
- `apps/web/public/models/outfit_overalls.glb`
- `apps/web/public/models/outfit_sunhat.glb`
- `apps/web/public/models/outfit_sweater.glb`
- `apps/web/public/models/outfit_tee.glb`
- `apps/web/public/models/outfit_tote.glb`
- `apps/web/public/models/outfit_varsity.glb`
- `apps/web/src/App.tsx`
- `apps/web/src/api/auditMock.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/itemColors.test.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/api/types.ts`
- `apps/web/src/components/Colosseum.tsx`
- `apps/web/src/components/CompetitionsPanel.tsx`
- `apps/web/src/components/GaussianHead.test.tsx`
- `apps/web/src/components/GaussianHead.tsx`
- `apps/web/src/components/ItemColorPanel.tsx`
- `apps/web/src/components/ShowcasePreview.tsx`
- `apps/web/src/components/Wardrobe.tsx`
- `apps/web/src/components/colosseum.css`
- `apps/web/src/components/colosseumData.test.ts`
- `apps/web/src/components/colosseumData.ts`
- `apps/web/src/components/previewMotion.test.ts`
- `apps/web/src/components/previewMotion.ts`
- `apps/web/src/components/shared.tsx`
- `apps/web/src/scene/ColosseumScene.tsx`
- `apps/web/src/scene/Cosmetics.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/cosmeticAssets.ts`
- `apps/web/src/scene/itemColors.test.ts`
- `apps/web/src/scene/itemColors.ts`
- `apps/web/src/scene/layout/town.ts`
- `apps/web/src/sound/SoundControls.tsx`
- `apps/web/src/styles.css`
- `apps/web/tests/audits.spec.ts`
- `apps/web/tests/colors.spec.ts`
- `apps/web/tests/colosseum.spec.ts`
- `apps/web/tests/equipment.spec.ts`
- `apps/web/tests/real.spec.ts`
- `apps/web/tests/screenshots/INTEG-002/colosseum-evidence.png`
- `apps/web/tests/screenshots/INTEG-002/colosseum-mobile.png`
- `apps/web/tests/screenshots/INTEG-002/colosseum-real.png`
- `apps/web/tests/screenshots/INTEG-002/colosseum-swiftshader.json`
- `apps/web/tests/screenshots/INTEG-002/showcase-mobile.png`
- `apps/web/tests/screenshots/INTEG-002/wardrobe-colors.png`
- `apps/web/tests/screenshots/INTEG-002/wardrobe-offline.png`
- `apps/web/tests/screenshots/INTEG-002/wardrobe-real.png`
- `apps/web/tests/screenshots/INTEG-002/web023-fixture-metrics.json`
- `apps/web/tests/web023-real.mjs`
- `apps/web/tests/web023.spec.ts`
- `assets/CATALOG.md`
- `assets/COLOSSEUM.md`
- `assets/blender/colosseum.py`
- `assets/blender/outfits.py`
- `assets/blender/preview.py`
- `assets/catalog.py`
- `assets/check_glb.py`
- `assets/outfits_spec.py`
- `assets/previews/colosseum_contact.png`
- `assets/previews/feat006-offline-mock.png`
- `assets/previews/feat006-village-mock.png`
- `assets/previews/feat006-wardrobe-mock.png`
- `assets/previews/outfits_fit.png`
- `docs/tasks/INTEG-002.md`
- `packages/catalog/catalog.json`
- `packages/catalog/dist/catalog.ts`
- `packages/catalog/validate.test.ts`
- `packages/catalog/validate.ts`
- `packages/contracts/api.md`
