# INTEG-008 integration report

Branch: `integ/INTEG-008`. Merge milestone: `524d754`; currency regression milestone: `e88d371`; prewarm-aware disaster test: `668f7fa`.

Merged `integ/INTEG-007` into the supplied latest-main worktree using `git merge --no-ff`. No merge to main and no push.

## Resolution

- Kept FIX-006 batched profile assembly. Coins are returned in the same member SQL read; positive-only XP preserves FEAT-007 progress semantics. Seven profile reads remain constant; the village endpoint still executes 28 statements.
- Kept immediate accepted-write acknowledgments and background refresh; check-in acknowledgments update coins as well as XP.
- Photo-token eligibility, labels, and optimistic balance deduction all use coins, retaining accessible shortage explanations and revision refresh.
- Kept the hero colosseum, arena prewarming, contrast fixes, organic map, instanced nature, throttled labels/shadows, adaptive quality and DPR cap.
- Converted 33 newer nature catalog entries from legacy price_xp to price_coins and regenerated catalog types. Kept 027_coins.sql alongside 026_disasters.sql.
- Updated currency regressions and scoped the disaster canvas assertion to the town because arena prewarming intentionally mounts another canvas.

## Validation

API environment was loaded at runtime through VILLAGE_ENV_FILE; tests and preview used isolated schemas in village_test with paid providers disabled.

- `python -m uv run pytest tests/test_fix006.py -q -s`: exit 0, 3 passed. Village GET warm p95 229.01 ms, 28 queries; house 26.57 ms, idle 27.19 ms, check-in 35.30 ms. Full samples: `apps/api/integ008-timings.json`. This sample ran alongside the full test suite, so it includes shared-host contention.
- `python -m uv run ruff check app/domain.py tests/test_fix006.py`: exit 0.
- `bun run typecheck`: exit 0.
- `bun run test`: exit 0, 110 passed.
- `bun run build`: exit 0; existing large-chunk warning remains.
- Catalog `bun run validate`: exit 0, 292 entries; `bun test`: exit 0, 36 passed.
- `bunx playwright test --config playwright.integ007.config.ts`: exit 0, 8 passed.
- `bunx playwright test --config playwright.fix006.config.ts`: exit 0, 8 passed.
- `bunx playwright test --config playwright.integ007-disasters.config.ts`: exit 0, 1 passed after scoping its canvas selector.

Initial checks also exposed missing local JS dependencies, a leftover photo-token price_xp reference, and the catalog schema mismatch. Installed dependencies using frozen lockfiles; repaired the references and reran the checks above successfully.

Additional completed checks:

- `python -m uv run pytest -q`: exit 1; 401 passed, 3 skipped, 2 failed in 568.69 s. `test_shipped_registry_and_legacy_parity` expects 259 entries, actual 292. This is the explicitly excluded FIX-007 registry-count work, left unchanged. The four warned API-009 penalty failures did not reproduce with the incoming INTEG-007 tests.
- `python -m uv run pytest tests/test_api008.py::test_demo_outfits_and_preserve_user_equips_on_replay --basetemp=.runtime/integ008-recheck -q`: exit 0, 1 passed. The full run's other failure was a missing temporary demo asset; the concurrent targeted timing invocation shared pytest's default basetemp and likely deleted it. The isolated rerun required no code change. Future concurrent pytest commands must use distinct basetemp directories. The full suite was not rerun after this isolated check.
- With VILLAGE_BROWSER_GPU=hardware, `bunx playwright test --config playwright.web028.config.ts`: exit 1 initially, 7 passed / 1 skipped / 2 stale assertions failed. Updated the removed mobile More selector and old SOL wording; `bunx playwright test --config playwright.web028.config.ts --grep 'friendly competition and emergency|open ? explicit cost'`: exit 0, 2 passed. All 9 applicable arena/audit tests pass across these runs; the live-only case is intentionally skipped by the mock project. Prewarm ordering and the maximum 50 ms transition-frame assertion passed unchanged.
- With VILLAGE_BROWSER_GPU=hardware, `bunx playwright test --config playwright.integ007-map.config.ts`: exit 0, 1 passed against the private real API, including street view, reset, mobile and missing assets.
- With VILLAGE_PERF_DIR=artifacts/integ008, `node tests/perf/town.mjs after hardware`: exit 0; **118.60 FPS**, 14.0 ms p95 frame interval, **677 calls**, headed Chromium at 1440x1000, confirmed NVIDIA RTX 5090 / D3D11, no browser exceptions. Shadows enabled with throttled updates. Exceeds the 55 FPS gate.
- Same output directory, `node tests/perf/town.mjs after swiftshader`: exit 0; **5.46 FPS**, 333.4 ms p95, 677 calls, headless SwiftShader, no browser exceptions, adaptive shadows disabled. This is separate software-renderer evidence, not the hardware gate.
- `git diff --check`: exit 0.

Hardware/software JSON, screenshots and gzip Chrome traces are in `apps/web/artifacts/integ008`. Screenshots of the town, photo-token shortage and mobile header were visually inspected. Preview shutdown returned success and the API exited 0 after its schema cleanup; Vite was stopped explicitly.

Remaining blocker to a completely green full API suite: FIX-007's registry-count assertion only. No implementation blocker remains for this integration.

## Teammate walkthrough

From apps/web, set VITE_MOCK=1 and VITE_DEMO_AUTH=1, then run `bun run dev --port 5377`. Choose Iraj. Buy a shop item: coins decrease while XP stays fixed. Check photo-token shortages, submit a check-in, open Compete, switch profiles, and pan/reset the organic town. The mock village works without generated assets or the GPU worker.

For the live scratch API and headed RTX 5090 reproduction, follow `apps/web/tests/perf/README.md`, setting VILLAGE_PERF_DIR to artifacts/integ008. Stop the preview with POST http://127.0.0.1:8029/qa/stop so its private schema is removed.

Screenshots: `apps/web/artifacts/integ008/photo-token.png`, `mobile-seat.png`, `arena-contrast.png`. Exact file inventory against starting commit d3060f5: `docs/tasks/INTEG-008-files.txt`.

No additional contract changes proposed; the merged api.md contains the currency contracts. No secrets, real-person photos/voices, or model weights were added.
