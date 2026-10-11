---
id: INTEG-010
owner: codex (gpt-6-astra, medium)
branch: integ/INTEG-010 (from main)
allowed_paths: [apps/**, packages/**, docs/**]
---
# INTEG-010 — Land INTEG-009 (coins + organic map) and WEB-019 (WASD + drag-to-ride)

**Step 0:** first `git merge --no-ff integ/INTEG-009` (coins/SOL/XP + organic map + perf, already reconciled with WEB-031). It now
conflicts with main's WEB-024 (working out + gaming activities: FitnessCorner in GridTown, `gaming` window glow on House,
`gamers`/`onGaming` state in World, goal-progress hint in Modals.tsx) in package.json (union the test file lists), Modals.tsx
(keep WEB-024's hint/aria-describedby AND INTEG-009's `<Reward>` currency amounts), GridTown.tsx (FitnessCorner + batchStatic),
VillageScene.tsx (House gets BOTH `gaming` + `yaw`, gaming animate + batchStatic must coexist; World gets gamers/onGaming +
onReducedQuality). Then step 1 below.

`git merge --no-ff web/WEB-019` onto main (which will include WEB-031 dashboard/fullscreen + WEB-024 activities + INTEG-009
coins/organic map). Conflicts expected in package.json, App.tsx, GridTown.tsx, TownCamera.tsx, VillageScene.tsx. Keep ALL behavior:
the WASD controls and camera follow (C toggles follow) must coexist with WEB-031's F = fullscreen and its zoom-collapse, plus the
INTEG-009 organic map's walkable/routing data (collisions must use the curved roads). Drag-to-ride targets include the new study nook,
farm store and fitness corner. Run all checks + the map perf gate (≥55 fps on the 5090). Don't merge to main. Final report.


## Completed

Implemented on `integ/INTEG-010` with merge milestones `02b9116` and `c7df7df`,
follow-up fixes `b98ddc4` and `ec16766`. No merge/push to main.

API: 418 passed, 3 opt-in skips. Web: 122 unit tests; typecheck/build passed.
Catalog: 293 entries validated, 36 tests passed. All 31 integrated browser
scenarios passed across the full run and focused rerun (one full-run localhost
connection failure is recorded explicitly). Real-API map regression passed.
Final RTX 5090 gate: 128.66 FPS at 1440x1000, zero browser errors; SwiftShader
fallback: 6.13 FPS with reduced shadows (no software FPS gate).

See [the full report](../INTEG-010-REPORT.md) for exact commands/exits, integration
choices, try-it instructions, screenshots, video, traces, and file inventory.
No blockers or additional proposed contract changes.
