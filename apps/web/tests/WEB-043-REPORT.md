# WEB-043 — rectangular town variety

Branch: `web/WEB-043`. Implementation milestones: `c40ee26`, `fcd8132`; browser harness: `a8a264b`.

The rectangular street network and legacy slot-to-address formula remain intact. Civic buildings shuffle within their districts, with a center preference; homes retain their assigned parcels. API seed `1337` and mock seed `24109` retain exact home centers and rotations. Other seeds get small, address-stable setbacks and rotations. Yard sizes vary without changing ownership.

Three existing tree assets now have independent yaw, lean, dimensions and tint. Smooth density bands create perimeter groves and clearings, with small trees along selected footpath verges. Buildings, cafe patios, paddocks and parcel interiors are reserved even when locked or unoccupied. Conservative rotated canopy bounds and street bounds reject conflicting placements.

The roads have wider avenues, narrower side lanes, seeded dirt/stone/brick sections, crossings, one or two flush intersection squares, and a connected dead-end edge alley. Hedges vary in height and gaps; other parcels have picket or stone fences or open boundaries. Gateposts leave the entrance open. Benches, signs, flowers and fence pieces share one colored cube instance batch. Road details merge into the existing road draw call, and trees/hedges/lamps use existing model batching. No TownRenderer, VillageScene, OptionalModel, contract, API or secret files changed.

Files changed (all under `apps/web`):

- `src/scene/GridTown.tsx`, `InstancedTrees.tsx`, `TownSurfaces.tsx` — batched rendering and colored surfaces.
- `src/scene/layout/town.ts`, `streets.ts`, `variety.ts`, `roadDetails.ts` — seeded placement, clearance and road geometry.
- `src/scene/layout/town.test.ts` — layout and ownership regression coverage.
- `tests/web043.config.ts`, `web043.spec.ts`, `web043-baseline.py`, `web043-compare.py`, `WEB-043-REPORT.md` — remote visual/performance checks and handoff.

## Validation

Run from `apps/web`:

- `bash ../../ops/remote_run.sh bun run build` — exit 0, including `tsc -b`; Vite built 2,452 modules. Existing large-chunk advisory remains.
- `bash ../../ops/remote_run.sh bun run test` — exit 0: 182 tests, 0 failures, 404,002 assertions. Includes 100-seed full-footprint clearance/determinism, legacy address ownership, sparse membership, growth, graph connectivity, paddocks, player navigation and offline model tests.
- `$env:WEB043_STAGE='after'; bash ../../ops/remote_run.sh --env WEB043_STAGE bunx playwright test --config tests/web043.config.ts` — exit 0, 3/3 passed. Seed IDs are verified through the mock API. Overview, street and all-models-missing images for seeds 1337/42/19 were downloaded and inspected. No page errors.
- `$env:WEB043_STAGE='before'; bash ../../ops/remote_run.sh --env WEB043_STAGE bunx playwright test --config tests/web043.config.ts` - exit 0, 3/3 passed against original source `fae2ae8`. The final `after` suite also passed 3/3 on the same runner, including every draw-call/FPS assertion.
- `python tests/web043-compare.py` - exit 0, all six paired views passed; raw measurements and the comparison are in `artifacts/web043/`.

The first browser baseline attempt failed in its test setup because PowerShell serialized source strings as extended objects. The snapshot generator now reads the original source directly from Git using Python. Two obsolete queued attempts were canceled (remote exit 143); a third waiting baseline was resubmitted because its queue time left less than the suite's measured runtime before the wrapper's 30-minute limit. No screenshots from these canceled attempts are used as evidence. Infrastructure changed the configured runner during capture, so the changed-town suite was repeated on the new host. Final before/after measurements both use runner `<runner-2-ip>`; earlier changed-town measurements were superseded. All browser runs use mock mode; no live API mutations or paid generation calls are involved.

## Paired performance and screenshots

Same runner, viewport, cameras and SwiftShader renderer; shadows disabled by the existing governor. Every view stays within the regression budget: no draw-call increase, and the largest FPS decrease is 3.58%. An FPS improvement is allowed rather than treated as a failure of the upper side of +/-10%.

| Seed | View | Draw calls before -> after | FPS before -> after | FPS change |
| --- | --- | --- | --- | --- |
| 1337 | overview | 1287 -> 1279 | 3.03 -> 2.92 | -3.58% |
| 1337 | street | 884 -> 862 | 3.40 -> 3.38 | -0.67% |
| 42 | overview | 1287 -> 1279 | 2.99 -> 3.35 | +12.25% |
| 42 | street | 1051 -> 957 | 3.11 -> 3.07 | -1.19% |
| 19 | overview | 1287 -> 1279 | 3.10 -> 3.15 | +1.87% |
| 19 | street | 830 -> 808 | 3.08 -> 3.08 | -0.17% |

Screenshots are under `apps/web/artifacts/web043/`: `before-{1337,42,19}-{overview,street,fallback}.png` and matching `after-*.png` (18 images).

- [Before overview](../artifacts/web043/before-1337-overview.png) / [after overview](../artifacts/web043/after-1337-overview.png).
- [Before street](../artifacts/web043/before-1337-street.png) / [after street](../artifacts/web043/after-1337-street.png).
- [Seed 42](../artifacts/web043/after-42-overview.png), [seed 19](../artifacts/web043/after-19-overview.png), [missing-model fallback](../artifacts/web043/after-19-fallback.png).

## Reproduce

From `apps/web`, run `python tests/web043-baseline.py` to prepare the original `fae2ae8` source snapshot. Then run the browser command with `WEB043_STAGE=before`, followed by `WEB043_STAGE=after` (PowerShell: `$env:WEB043_STAGE='before'` / `'after'`):

```text
bash ../../ops/remote_run.sh --env WEB043_STAGE bunx playwright test --config tests/web043.config.ts
python tests/web043-compare.py
```

The baseline harness temporarily substitutes only the five allowed scene source files and restores them after the suite. The remote wrapper serializes each worktree. The generated `tests/web043-baseline.json` is temporary and should not be committed. Artifacts are downloaded into `apps/web/artifacts/web043/`.

To try interactively, start the web app in mock mode (`VITE_MOCK=1`, `VITE_DEMO_AUTH=1`) and inspect the avenues, intersection paving, planting and parcel edges. The browser suite substitutes seeds 1337, 42 and 19 without changing production fixtures and captures both camera distances plus all-models-missing fallbacks.

Visual review: all six normal views show rectangular roads, recognizable mixed tree silhouettes/colors, distinct civic arrangements and parcel boundaries, without obvious building/path intersections. The missing-model view retains the same layout, paving and foliage variation. The runner uses SwiftShader software rendering (roughly 3 FPS); paired measurements assess relative cost there and are not a claim of hardware FPS.

Proposed contract changes: none. Blockers: none. The INTEG-015 performance changes had not landed on main at the final check, so no rebase was needed. Generated screenshots/measurement JSON remain in the requested artifact directory and are not committed.
