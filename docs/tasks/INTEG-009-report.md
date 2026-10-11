# INTEG-009 integration report

Branch: `integ/INTEG-009`. Starting commit: `c466380`. Merge milestone: `d2aba80`; regression milestone: `d5357b5`. Final evidence/report commit follows these milestones.

Merged `integ/INTEG-008` with `git merge --no-ff --no-commit`, resolved conflicts, then committed on the supplied branch. No merge to main and no push. All changes are within `apps/**`, `packages/**`, and `docs/**`.

## Result and decisions

- Preserved WEB-031's App layout, dashboard, clean-view entry/exit handlers, and camera-driven zoom collapse. No removed self-card/feed-panel was restored.
- Added XP, coin balances, and the SOL devnet/test placeholder to the corner widget and its popout. The narrow top bar stays unchanged. Currency icons also appear in feed amounts, Mayor notes, and the expanded XP breakdown. The SOL dash remains a placeholder, not an invented wallet balance.
- Kept the optimistic/acknowledged check-in coin update from INTEG-008. Purchases use coins and leave XP unchanged.
- Combined VillageScene's onZoomChange callback with organic-map orientation, adaptive DPR/shadows, reduced-quality propagation, and other incoming performance changes. Retained TownCamera's merged zoom callback and performance governor.
- Preserved main's API-009 test file exactly, including FIX-007's cross-product coverage of disaster recovery. Preserved FIX-007's catalog count derived from shipped entries and full registry equality assertion. The first full run proved that retaining the catalog test file verbatim still used obsolete price_xp fields; migrated only those price fields/SQL to price_coins, keeping its validation, sync and rollback coverage.
- Added `playwright.integ009.config.ts` to exercise existing currency, WEB-030 and WEB-031 suites together with a new dashboard currency regression. Updated the map test's connected-mode assertion to tolerate WEB-031's intentionally hidden compact-desktop badge.

Integration-specific source/test files: `apps/web/src/App.tsx`, `apps/web/src/components/Dashboard.tsx`, `apps/web/src/components/Dashboard.css`, `apps/web/src/scene/VillageScene.tsx`, automatically merged `apps/web/src/scene/TownCamera.tsx`, `apps/api/tests/test_catalog_registry.py`, `apps/web/tests/web029.spec.ts`, `apps/web/tests/integ009.spec.ts`, and `apps/web/playwright.integ009.config.ts`. The full inherited merge and artifact inventory is in `docs/tasks/INTEG-009-files.txt`.

## Validation

Commands ran from their app/package directory unless stated otherwise. `VILLAGE_ENV_FILE` pointed to the external root env at runtime; no secrets were copied. API tests use a private schema in village_test with providers stubbed. The real-API preview used synthetic fixtures, disabled paid providers and an unavailable GPU worker.

- API `python -m uv sync`: exit 0.
- API `python -m uv run pytest -q`: first run exit 1, 412 passed, 3 skipped, 3 failed in 348.17 seconds. All failures were stale price_xp references in the preserved catalog tests; corrected as described above. Final full run: **exit 0, 415 passed, 3 skipped, 0 failed in 265.89 seconds**.
- API `python -m uv run ruff check tests/test_catalog_registry.py`: final exit 0. Initial lint found two lines made too long by price_coins; `python -m uv run ruff format tests/test_catalog_registry.py` exited 0 and resolved both.
- Web `bun install --frozen-lockfile`: exit 0, including nested pot dependencies.
- Web `bun run typecheck`: exit 0, including final dashboard adjustment.
- Web `bun run test`: exit 0; 110 passed, 0 failed, 30 files.
- Web `bun run build`: exit 0, including final dashboard adjustment. Existing large-chunk warning remains.
- Catalog `bun install --frozen-lockfile`, `bun run validate`, `bun test`: each exit 0; 292 entries, 36 tests passed. Generated catalog matches the merged file.
- With VILLAGE_BROWSER_GPU=hardware, `bunx playwright test --config playwright.integ009.config.ts`: first run exit 1; 16 passed, 1 failed. The new test clicked a globally matched Check in today button before the popout minimize animation completed. Added a wait for removal and scoped the click to the corner; targeted `--grep 'dashboard and corner'` exited 0, 1 passed. All 17 cases passed across these runs.
- Following removal of a redundant XP label, the same config with `--grep 'dashboard and corner|dashboard layout'`: exit 0, 5 passed. Covers desktop/mobile screenshots and balances. Existing cases cover clean fullscreen, rejected fullscreen fallback, key/villager/building exits, real wheel zoom/collapse/reset, per-seat widget preferences, purchases/debug coins without XP spend, competition SOL labels, and absent models.
- With VILLAGE_BROWSER_GPU=hardware, `bunx playwright test --config playwright.integ007-map.config.ts`: final exit 0, 1 passed, real API overview/street/reset/mobile/missing assets. Initial invocation from repository root exited 1 (config path); first app-directory run exited 1 because WEB-031 hides Connected at 1440px. Corrected the test to assert the mode badge's text independently of visibility.
- With VILLAGE_PERF_DIR=artifacts/integ009, `node tests/perf/town.mjs after hardware`: final exit 0, **134.02 FPS**, **13.9 ms p95**, **677 draw calls**, headed Chromium at 1440x1000, confirmed NVIDIA RTX 5090 / D3D11, shadows enabled with throttled updates, no browser exceptions. Exceeds 55 FPS. Earlier sample before removing the duplicate XP label was 100.71 FPS (exit 0); final artifacts supersede it. These samples ran while API tests were active and are not an isolated causal comparison.
- `git diff --check`: exit 0.
- Preview POST /qa/stop returned success; API process exited 0 after private-schema cleanup. Vite was explicitly interrupted (exit 1).

Evidence is under `apps/web/artifacts/integ009/`, including hardware JSON, gzip Chrome trace, dashboard currency screenshot, WEB-031 dashboard/popout/clean screenshots, real-API map views, and currency flow screenshots. Earlier branches' artifact paths were restored after copying this run's captures into INTEG-009. Desktop/mobile corner balances and clean view were visually inspected.

## Teammate walkthrough

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
$env:VITE_VILLAGE_ID=''
bun run dev --port 5377
```

Choose Iraj. Scroll the dashboard to Your little corner; inspect XP, coins and SOL devnet/test labels, open its popout, and submit a check-in. Buy Village Cap from Shop: coins decrease and XP stays fixed. Try widget hide/reorder/popout/minimize, zoom and reset the camera, then press F and exit using a key, villager or Gazette building. Repeat at 390px width. Fixture mode needs no generated assets, paid generation or GPU worker.

For real-API/hardware reproduction follow `apps/web/tests/perf/README.md`, setting VILLAGE_PERF_DIR to artifacts/integ009 and using the external VILLAGE_ENV_FILE. Stop the scratch API through /qa/stop afterward.

Blockers: none. No additional contract changes proposed; incoming `packages/contracts/api.md` already carries the coin contract. No Solana transaction was signed or sent.
