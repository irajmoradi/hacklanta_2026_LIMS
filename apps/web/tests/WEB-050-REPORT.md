# WEB-050 — restored woodland

Branch: `web/WEB-050`. Implementation milestone: `2cb8562`. Verification harness milestones: `592bd03`, `4e3e75c`.

Placement restores woodland on all four island edges, adds offset clumps to empty civic/park lawns, and fits two small trees beside home footpaths. Plaza verges favor blossoms. Evergreen, broadleaf and blossom trees retain seeded dimensions, tint, yaw and lean, with the same instanced renderer and model batches. Roads, fence/hedge choices and occupied-lot envelopes remain intact.

Empty residential addresses and every catalog attraction remain reserved, including locked buildings, patios and paddocks. Empty nonresidential lawns can grow groves; adding a catalog building replaces that lawn's planting through the existing town rebuild. Rounded island corners and the east creek bank are protected. Trees remain independent of unlock/world state and require no generated assets.

## Measurement

Baseline main is `2667e12fc1fec06fda6798293d01c33ea5d94e2a`. Pre-WEB-043 is `e8909eb^1`. Counts execute the historical town/street generation and GridTown placement callback extracted from Git, with five member slots and the same fallback-plus-compiled merged registry used by VillageScene. The only catalog change between these revisions renames/repoints Community Hall; placement/unlock rules are identical. Historical locked and fully unlocked worlds are both measured because the old garden-tree count depended on unlocks.

| Seed | Before WEB-043, locked / unlocked | Main | Restored |
| --- | --- | --- | --- |
| 1337 | 69 / 59 | 40 | 166 |
| 42 | 77 / 64 | 39 | 164 |
| 19 | 72 / 61 | 43 | 172 |
| 24109 | 74 / 61 | 44 | 179 |

All exceed 1.3 times even the larger historical count. Initial fallback-only measurements were 179/177/181/183 restored trees (historical locked counts unchanged; unlocked 63/71/66/68). The table above is the corrected runtime-registry measurement: compiled catalog entries reserve additional attractions. Both catalogs pass 100-seed minimum-count/clearance coverage. Seed 1337 comes from `apps/api/scripts/seed.py`; a read-only lookup on localhost:8010 was unreachable, so it could not be independently confirmed against the running village. Browser captures use only mock mode, never live mutations.

The old batches have no instance cap: they allocate exactly `trees.length`. Main attempts 69/80/85/81 trees for these seeds, rejects 19/29/34/26 at the island boundary and 10/12/8/10 against previously occupied decor, respectively. One extra candidate in seed 24109 intersects reserved bounds. Main had no east-edge planting, and blanket reservation of every parcel prevented open-lawn candidates from being attempted. This is a placement problem, not a batching limit.

## Validation

Commands run from `apps/web` through the configured remote runner:

- `bash ../../ops/remote_run.sh bun run test` — exit 0; 188 tests, 0 failures, 2,792,111 assertions.
- `bash ../../ops/remote_run.sh bun run build` — exit 0; includes `tsc -b`, followed by a 2,458-module Vite build. Existing large-chunk advisory remains.
- `bash ../../ops/remote_run.sh bun test tests/web050-counts.test.ts` - exit 0; 2 tests, 1,484,181 assertions. Checks historical counts, identical non-tree decor, and 100-seed runtime-registry clearance/minimum counts.
- `bash ../../ops/remote_run.sh bun test src/scene/layout/town.test.ts tests/web050-counts.test.ts` - exit 0; 20 tests and 2,766,034 assertions in the earlier combined layout/history check.
- `bash ../../ops/remote_run.sh bun test src/scene/layout/town.test.ts` — exit 0; 19 tests, including 100-seed disjoint canopy/road/lot checks and four-edge/yard/creek/growth checks through 100 homes.

Initial layout tests caught rejected yard candidates beside wide roads and furniture. The implementation now plants on the narrow footpath side with alternate positions and a slender evergreen fallback. These failures were fixed before the passing runs. An initial count invocation lacked a test filename suffix and exited 1; it was renamed and rerun successfully. Two early queued measurement/browser wrapper invocations were deliberately canceled (exit 143) to allow the unit/build checks first; neither produced claimed browser evidence.

All 24 overview/street/model-offline images were captured. All four before/after overviews and all four restored street and fallback images were visually inspected: fuller mixed-species perimeter planting, pine trees between the east road and creek, trees in empty lawns, and small yard/plaza planting. Roads, patios and entrances remain visibly clear.

The initial moving-scene browser run completed with exit 1: 5/8 test cases passed. The three failures were performance assertions, not page errors or missing captures: seed 42 overview FPS -8.12%, seed 19 street FPS -6.28%, and seed 24109 street calls +5.80%. The latter two street comparisons also had a 47-call swing in opposite directions (858 -> 811 and 810 -> 857), despite the unchanged tree batches. Raw results remain in `*-performance.json` and `comparison.json`; they are not presented as passing.

To distinguish planting cost from changing actor visibility and short low-FPS samples, a second harness loads one scene per seed, freezes its movement clock, and alternates the exact main and restored tree matrices/colors/counts in the existing instanced meshes. It recovers each model-part normalization matrix from the rendered instance, preserving geometry and material. Background React updates cannot replace the controlled matrices during the measurement. Each view first warms both layouts for ten seconds each, then uses a balanced ABBA sequence of four 15-second windows (30 timed seconds per layout), unchanged camera, renderer, DPR and shadow state. It restores the live tree matrices and clock afterward. `InstancedTrees.tsx` adds only stable names for these diagnostic batches; rendering behavior is unchanged.

The first controlled-harness attempt exited 1 with four setup failures: fallback-only reconstruction did not match runtime instance counts. It collected no performance samples. The harness now imports the exact merged registry from the running app. An initial TypeScript sample-array inference error was fixed, followed by a passing build.

The first reconstructed controlled sample showed substantially slower first windows after camera changes: seed 1337 street measured -6.65% overall, with its first after window at 1.317 FPS and subsequent after windows at 1.694/1.728/1.718 FPS. This run was stopped (exit 143) to add explicit prewarming of both layouts after each camera change. Those raw samples are retained as `cold-1337-performance.json`; they are not silently replaced or counted as passing.

The next invocation exited 1 before tests because the canceled run left its Vite subprocess holding port 5350. Its PID, process group and working directory were verified as this worktree, then that owned group was stopped. No other worktree processes were touched.

On runner `<runner-2-ip>`, the final warmed run passed all four cases and all eight view comparisons: draw calls are unchanged in every view, and the largest FPS decrease is 4.01%, inside the 5% budget. All samples retained DPR 1 and disabled shadows on the same SwiftShader renderer. These are relative software-renderer measurements; positive differences should not be read as a hardware-speed improvement.

- `bash ../../ops/remote_run.sh bunx playwright test --config tests/web050-perf.config.ts` - exit 0, 4/4 passed, 13.7 minutes of browser work (988.15 seconds including queue/sync).
- `python tests/web050-perf-compare.py` - exit 0, 8/8 comparisons passed.

| Seed | View | Draw calls before -> after | FPS before -> after | FPS change |
| --- | --- | --- | --- | --- |
| 1337 | overview | 1276 -> 1276 | 1.553 -> 1.597 | +2.80% |
| 1337 | street | 865 -> 865 | 1.608 -> 1.778 | +10.55% |
| 42 | overview | 1276 -> 1276 | 1.601 -> 1.582 | -1.23% |
| 42 | street | 954 -> 954 | 1.659 -> 1.593 | -4.01% |
| 19 | overview | 1276 -> 1276 | 1.570 -> 1.600 | +1.90% |
| 19 | street | 811 -> 811 | 1.785 -> 1.858 | +4.10% |
| 24109 | overview | 1276 -> 1276 | 1.501 -> 1.672 | +11.38% |
| 24109 | street | 810 -> 810 | 1.749 -> 1.728 | -1.19% |

Temporary historical source snapshots were removed after validation. The final build also checks that a clean checkout typechecks without those disposable fixtures. Screenshots and raw measurements remain locally in the requested artifact directory; they are not committed.

[Restored overview, seed 1337](../artifacts/web050/after-1337-overview.png) | [main baseline](../artifacts/web050/before-1337-overview.png) | [street view](../artifacts/web050/after-1337-street.png) | [missing-model fallback](../artifacts/web050/after-1337-fallback.png).


## Reproduce

From `apps/web`:

```text
python tests/web050-baseline.py
bash ../../ops/remote_run.sh bun test tests/web050-counts.test.ts
bash ../../ops/remote_run.sh bunx playwright test --config tests/web050.config.ts
python tests/web050-compare.py  # original moving-scene diagnostic (records failures)
bash ../../ops/remote_run.sh bunx playwright test --config tests/web050-perf.config.ts
python tests/web050-perf-compare.py
```

The generator creates disposable `tests/web050-history/` and `tests/web050-baseline.json` from fixed Git revisions. Browser projects run `before`, restore the saved source, then run `after`, in one serialized runner job. Only `src/scene/layout/variety.ts` is temporarily substituted. Performance uses the WEB-043 overview/street cameras, 1440×1000 viewport, and a 15-second frame sample per view. Draw-call and FPS assertions enforce +5% / -5%, preserving renderer and shadow settings. Model-offline screenshots are captured too.

Artifacts: `apps/web/artifacts/web050/{before,after}-{1337,42,19,24109}-{overview,street,fallback}.png`, paired `*-performance.json`, `tree-counts.json`, `comparison.json`, `paired-*-performance.json`, and `paired-comparison.json`.

To try it manually, run the app with `VITE_MOCK=1 VITE_DEMO_AUTH=1 bun run dev`, reset the camera, then inspect the banks, empty lawns and home verges. The screenshot suite substitutes all four seeds without changing fixtures.

Files changed: `src/scene/InstancedTrees.tsx`, `src/scene/layout/variety.ts`, `src/scene/layout/town.test.ts`; verification scripts/configuration and this report under `tests/web050*` and `tests/WEB-050-REPORT.md`. Renderer changes are limited to diagnostic mesh names. No API, contract, secret or other app changes.

Blockers: none. Proposed contract changes: none. Limitations: live seed lookup unavailable; browser performance is a relative SwiftShader measurement, not a hardware FPS claim.
