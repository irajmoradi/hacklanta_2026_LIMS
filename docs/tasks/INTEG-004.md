---
id: INTEG-004
status: done
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-004 (from main)
allowed_paths: [apps/**, packages/**, assets/**, workers/**, docs/**]
---
# INTEG-004 — Merge WEB-025 + FIX-005

Same rules as INTEG-001..003 (read their reports): `git merge --no-ff` in order, keeping BOTH sides' behavior:
1. `web/WEB-025`: Make it real (photo items UI, photo_token, refunds), "Start as a new person" guest onboarding.
   Its migration `019_photo_refunds_guests.sql` collides with main's 019_item_colors, so renumber it to **021** (INTEG-003 is
   taking 020; if INTEG-003 already landed on main with more numbers, use the next free one). Move its prepared DEMO_TESTING
   update into `docs/DEMO_TESTING.md`.
2. `fix/FIX-005`: cosmetic fit on generated heads (head frame, per-slot fit, neck snap).
Known overlaps: client.ts, mock.ts, Modals.tsx, Cosmetics.tsx (FIX-004 anchors + FEAT-006 colors + FIX-005 fit + WEB-025 photo
items in town; keep all), styles.css, playwright.config.ts (union of projects), and catalog.json (union; regenerate dist; fix
counts). Main also has WEB-026 (Settings redesign, `SettingToggle`) and itemColors tests that use `firstMesh()`.
Run all checks (API pytest, web typecheck/test/build, catalog, branch e2e) using scratch DBs only. All green.
Don't merge to main. Final report: conflicts and resolutions.


## Integration report

Branch: `integ/INTEG-004`; baseline `ad9d620`. No push or merge to main.

Merge milestones, in order:
- `a92400e` Merge WEB-025: photo items, refunds and guest onboarding.
- `90ed423` Merge FIX-005: generated head frames and cosmetic fitting.
- `a63dacc` Browser port isolation, integrated workflow verification and synthetic evidence.
- `315d092` Reserve photo migration 022 after the concurrent study migration.
- Final documentation commit: see this branch HEAD / `git log -1`.

### Conflicts and resolutions

| Merge | Conflicting files | Resolution |
| --- | --- | --- |
| WEB-025 | web `playwright.config.ts`, `src/api/{client,mock}.ts`, `src/components/Modals.tsx`, `src/scene/Cosmetics.tsx`, `src/styles.css`; catalog JSON and generated TS | Union browser projects; retain item-color methods, validation, persistence and shop colors while adding photo balances/jobs/refunds. Shop contains PhotoItems and the WEB-026 Villagergram-to-Settings callback. Cosmetics retain FIX-004 skeleton/anchor checks and add authenticated photo patterns with cleanup. Keep color and Settings CSS alongside photo controls. Union catalog entries and regenerate dist: 186 entries. |
| FIX-005 | web `src/scene/cosmeticAssets.ts` | Keep skinned clothing rebinding and early return, plus material color channels; reset position, scale AND rotation for unskinned fitting. Add generated-head geometry frame, neck snap, per-slot fits and catalog overrides. Preserve rigAnchor lookups and firstMesh-based item-color tests. |

Additional integration choices:
- Rename photo migration `019_photo_refunds_guests.sql` to `022_photo_refunds_guests.sql`; 019 remains item colors. Initially used the requested 021, but a final check of the concurrent INTEG-003 branch (`5091511`) found both `020_farm_animals.sql` and `021_idle_studying.sql`. Use the next free integration number, 022, to prevent that known collision before landing. Main reserves 020-024 for these integrations and uses 025 for inbound evidence. No other branch was merged or edited. Update WEB-025 report reference.
- Move the prepared photo-item and guest walkthrough into `docs/DEMO_TESTING.md`, retaining the group-photo section.
- Keep Colosseum, all 16 outfit/color entries, earned rewards, Settings/SettingToggle and Mayor `phase < 120` behavior.
- Add `playwright.integ004.config.ts` with dedicated 5584/5585/5587 ports, preserving all base projects. Other worktrees occupied default browser ports; no external processes were stopped or reused.
- Runtime API settings come from the existing `VILLAGE_ENV_FILE`; no env values are copied into files. API mutations/migrations use the guarded `village_test` fixtures and private schemas only.
- FIX-005 browser QA reads existing avatar manifests/GLBs from port 8010. Its route guard aborts every non-GET API request. No live DB mutation, generation, messages or transactions occur. Likeness screenshots remain ignored/uncommitted.

### Validation

All required checks passed. API: 340 passed / 3 expected opt-in skips. Web: 74 unit tests. Catalog: 28 tests. Browser: 18 tests across three commands. All commands run in the directory shown; final exit codes are 0.

| Directory | Command | Exit/result |
| --- | --- | --- |
| apps/api | `python -m uv run pytest -q --tb=short` with `VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env` | 0; 340 passed, 3 opt-in skips in 929.09 seconds; scratch DB only |
| apps/web | `bun run typecheck` | 0, including a separate final rerun |
| apps/web | `bun run test` | 0; 74 tests / 941 assertions |
| apps/web | `bun run build` | 0; existing large-chunk advisory only |
| packages/catalog | `bun run validate` | 0; 186 entries regenerated after each merge |
| packages/catalog | `bun test` | 0; 28 tests |
| apps/web | `bunx playwright test --config playwright.fix005.config.ts` | 0; 1 suite, four existing heads x 21 entries x three views |
| apps/web | `bunx playwright test web025.spec.ts colors.spec.ts equipment.spec.ts --config playwright.integ004.config.ts --project=mock --trace=off` | 0; 9 tests (all four WEB-025, three colors, two equipment) |
| apps/web | `bunx playwright test --config tests/web026.config.ts` | 0; 8 Settings/voice/accessibility tests |
| apps/api | `python -m uv run ruff check app/account.py app/domain.py app/photo_items.py app/demo.py tests/test_web025.py tests/test_api011.py tests/test_catalog_registry.py` | 0 |
| repository | `git diff --check` | 0 |
| repository | `git merge-base --is-ancestor web/WEB-025 HEAD` and equivalent for `fix/FIX-005` | 0 each |

Initial browser startup attempts exited 1 on occupied ports 5174 and 5494. The first isolated-config implementation also inherited the base server array; using one spread config corrected it. The final 5584/5585/5587 run passed. No failed test assertion was suppressed or retried away. The three API skips are two paid-provider opt-ins and the older opt-in HTTP browser harness; the requested branch browser suites were run separately as listed above. Concurrent worktrees contended on shared scratch-database advisory locks during the full API run; it completed successfully. Playwright emits a Vite shutdown message after successful runs; the browser commands themselves exit 0.

### Evidence and teammate walkthrough

Synthetic WEB-025 screenshots are under `apps/web/tests/screenshots/WEB-025-*.png`; Settings evidence is under `apps/web/tests/screenshots/WEB-026/`.
FIX-005 local ignored evidence is under `apps/web/test-results/fix005/`: 84 triptychs / 252 views (four heads, 21 integrated head/face items), plus `measurements.json`. All measured neck gaps are approximately -0.0072. Representative round-glasses and headphone triptychs, the synthetic wearable result, and the decoration town screenshot were visually inspected. Existing baked-in eyewear can overlap equipped glasses; no CV/model regeneration was attempted.

From `apps/web`, set `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, then run `bun run dev --port 5584`. Open http://localhost:5584, pick a seat, and use Shop > Make it real to buy a token, upload a synthetic image, consent, create and equip/place. A synthetic file named `failure.png` exercises the mock refund. Debug > Start as a new person opens guest onboarding; join HACKLANTA and enter without waiting for the offline GPU. Remove guest users returns to Iraj. Also try wardrobe colors, Settings, and generated-head cosmetics where assets are available. See `docs/DEMO_TESTING.md` for deployment instructions; this task did not deploy or migrate the development DB.

### Blockers and limitations

No blockers. No proposed contract changes beyond the merged WEB-025 additions in `packages/contracts/api.md` (token/refund and guest routes). This integration did not alter `schema.sql`. Live paid generation was not exercised; the GPU-offline fallback and mocked provider paths pass. Existing large-chunk build warnings and baked eyewear overlap remain. Migration 022 is intentional because concurrent INTEG-003 consumes 020 and 021.

### Files changed relative to baseline

- `apps/api/app/account.py`
- `apps/api/app/demo.py`
- `apps/api/app/domain.py`
- `apps/api/app/photo_items.py`
- `apps/api/migrations/022_photo_refunds_guests.sql`
- `apps/api/tests/test_api011.py`
- `apps/api/tests/test_catalog_registry.py`
- `apps/api/tests/test_web025.py`
- `apps/web/FIX-005-REPORT.md`
- `apps/web/WEB-025-DEMO-TESTING.md`
- `apps/web/WEB-025-REPORT.md`
- `apps/web/playwright.config.ts`
- `apps/web/playwright.fix005.config.ts`
- `apps/web/playwright.integ004.config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/mock.ts`
- `apps/web/src/api/seat.ts`
- `apps/web/src/components/DemoTools.tsx`
- `apps/web/src/components/Modals.tsx`
- `apps/web/src/components/PhotoItems.tsx`
- `apps/web/src/components/ProfileOutfit.tsx`
- `apps/web/src/components/ShowcasePreview.tsx`
- `apps/web/src/scene/Cosmetics.tsx`
- `apps/web/src/scene/VillageScene.tsx`
- `apps/web/src/scene/cosmeticAssets.test.ts`
- `apps/web/src/scene/cosmeticAssets.ts`
- `apps/web/src/scene/generatedHead.test.ts`
- `apps/web/src/scene/headAssets.ts`
- `apps/web/src/scene/headFit.ts`
- `apps/web/src/styles.css`
- `apps/web/tests/fix005-real.spec.ts`
- `apps/web/tests/fix005-review.ts`
- `apps/web/tests/fix005.html`
- `apps/web/tests/screenshots/WEB-025-avatar.png`
- `apps/web/tests/screenshots/WEB-025-object-progress.png`
- `apps/web/tests/screenshots/WEB-025-object-result.png`
- `apps/web/tests/screenshots/WEB-025-object-town.png`
- `apps/web/tests/screenshots/WEB-025-onboarding.png`
- `apps/web/tests/screenshots/WEB-025-refund.png`
- `apps/web/tests/screenshots/WEB-025-wearable-progress.png`
- `apps/web/tests/screenshots/WEB-025-wearable-result.png`
- `apps/web/tests/screenshots/WEB-025-wearable-town.png`
- `apps/web/tests/web025.spec.ts`
- `docs/DEMO_TESTING.md`
- `docs/tasks/INTEG-004.md`
- `packages/catalog/catalog.json`
- `packages/catalog/catalog.schema.json`
- `packages/catalog/dist/catalog.ts`
- `packages/catalog/validate.test.ts`
- `packages/contracts/api.md`
