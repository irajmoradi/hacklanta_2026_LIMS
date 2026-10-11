# FIX-020 verification

Branch: `fix/FIX-020`. Implementation: `e2a8e9c`.

## Findings and changes

- QA-012-01: reproduced at 844×390 and 915×412. Both primary action centers hit the dashboard rather than their buttons. The short landscape layout now bounds the entire dashboard in a scrolling area above the dock, and compacts the welcome copy to make room. Collapse/reopen remains available.
- QA-012-03: keyboard defect **not reproduced** in Chromium. A synthetic 40-entry log was reachable through Tab and scrolled with PageDown. Skipped production changes as requested. Axe still reports `scrollable-region-focusable`; this is retained as an unconfirmed Safari/assistive-technology lead, not a confirmed keyboard blocker.
- QA-012-05: reproduced with a mock competition read failure; axe measured Retry at 1.64:1. The explicit arena recovery color `#fff2d9` on `#6b282e` calculates to 9.63:1.
- QA-012-06: arena unsupported naming reproduced with axe; portrait/head generic labels confirmed in source. Arena status now uses a named group; the animated head and crown use named images. Existing head-renderer unit coverage also checks the image role and accessible label.
- QA-012-07: reproduced with Chromium's native 34 px safe-area override and an independent CSS probe. At 390×844, button bottoms were 821 px, beyond the 810 px safe boundary. The dock now adds `env(safe-area-inset-bottom)` to its bottom padding and total height; neighboring HUD surfaces reserve the same inset.

## Scope

Changed production files: `src/components/Dashboard.css`, `src/components/Colosseum.tsx`, `src/components/GaussianHead.tsx`, `src/components/shared.tsx`, `src/components/colosseum.css`, and `src/styles.css`.

Verification files: `src/components/GaussianHead.test.tsx`, `tests/fix020.config.ts`, `tests/fix020.spec.ts`, and this report.

Mock mode only: API adapters supply synthetic log entries and the competition error. No live village actions, model calls, transactions, or secrets are needed. Generated screenshots/measurements go to the explicitly requested `apps/web/artifacts/fix020/` directory and are not committed. All source/document edits are inside the task's allowed paths.

## Commands and results

All commands run from `apps/web` through `ops/remote_run.sh` on the configured runner.

- Baseline capture: `FIX020_BEFORE=1 ../../ops/remote_run.sh --env FIX020_BEFORE bunx playwright test --config tests/fix020.config.ts` — exit 0; six observational checks captured the defects. This does not mean the baseline passed the later regression assertions.
- `../../ops/remote_run.sh bun run test` — exit 0; 179 passed, zero failed.
- `../../ops/remote_run.sh bun run build` — exit 0; `tsc -b` and Vite build passed. Vite warned about chunks larger than 500 kB.
- `../../ops/remote_run.sh bunx playwright test --config tests/fix020.config.ts` — exit 0; seven passed. Both primary controls opened by pointer at all four sizes; dashboard scrolling and collapse/reopen passed. Arena contrast/ARIA and crown ARIA scans had zero targeted violations. The AI log remained keyboard operable.
- `../../ops/remote_run.sh bunx playwright test --config tests/fix020.config.ts --grep '844x390|915x412'` — exit 0; both passed on the final committed source, after compacting the welcome title. Refreshed both landscape screenshots and visually verified title/dashboard separation and reachable primary controls.

## Evidence

Before/after screenshots and JSON are in `apps/web/artifacts/fix020/`: `before-844.png` / `after-844.png`, `before-915.png` / `after-915.png`, `before-390.png` / `after-390.png`, `before-412.png` / `after-412.png`, plus `before-arena.png` / `after-arena.png` and `before-log.png` / `after-log.png`. Matching JSON files retain hit tests, button coordinates, and axe observations. Screenshots use synthetic fixture avatars.

The 34 px inset probe resolved correctly at all four sizes. The first two buttons changed from blocked to reachable at both landscape sizes. At 390×844 their bottom edge moved from 821 px to 787 px, safely above the 810 px home-indicator boundary. The dock background retains its outer margin; the added internal padding protects the controls.

## Try it

Run `../../ops/remote_run.sh bunx playwright test --config tests/fix020.config.ts` from `apps/web`. The config starts an isolated mock Vite server. The suite covers 844×390, 915×412, 390×844, and 412×839, including the simulated safe-area inset, direct primary-action clicks, dashboard scrolling/collapse, AI-log keyboard scrolling, arena recovery, and crown semantics.

For manual review, start the web app with `VITE_MOCK=1 VITE_DEMO_AUTH=1`, choose a fixture seat, and use the phone viewport sizes above. Leave the dashboard expanded and open Check in and Village through the bottom dock.

No blockers or proposed contract changes. Chromium emulation is not physical Safari or screen-reader certification. Shared runner queueing accounted for most elapsed verification time; no local fallback or live demo testing was used.
