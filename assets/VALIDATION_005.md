# ASSET-005 delivery

Branch: `asset/ASSET-005`. Model/registry milestone: `6e8f33c`.
The subsequent preview/documentation commit contains this report; use
`git log -2 --oneline` for both milestone hashes.

## Result

Original procedural Mayor's Plaza: domed green gazebo with white columns,
stone stairs, brass bell, flagpole, lectern, scroll and gavel; a friendly top-hat
Mayor statue; and a roofed Gazette board. The optional festival stage is included
to make the contrast explicit: broad truss arch, screen, speakers, neon colors
and barriers. All are self-contained, texture-free GLBs, without clips.

| Asset | Triangles | Limit |
| --- | ---: | ---: |
| mayor_podium | 2,108 | 6,000 |
| mayor_statue | 985 | 6,000 |
| notice_board | 657 | 6,000 |
| festival_main_stage | 3,725 | 6,000 |

## Files changed

- `apps/web/public/models/{mayor_podium,mayor_statue,notice_board,festival_main_stage}.glb`
- `assets/blender/plaza_kit.py`, `assets/blender/plaza_preview.py`, `assets/plaza_spec.py`
- `assets/check_glb.py`, `assets/test_check_glb.py`, `assets/catalog.py`
- `assets/CATALOG.md`, `assets/README.md`, `assets/VALIDATION_005.md`
- `assets/previews/contact_sheet.png`, `assets/previews/mayor_vs_festival.png`
- `packages/catalog/catalog.json`, `packages/catalog/dist/catalog.ts`
- `packages/catalog/validate.test.ts`, `packages/catalog/README.md`

## Verification

Commands run from repository root unless otherwise stated:

| Command | Exit | Result |
| --- | ---: | --- |
| `python assets/check_glb.py` | 0 | 138 GLBs, zero failures; materials, required features, ground anchors, triangle budgets, existing animation contracts |
| `python assets/test_check_glb.py` | 0 | 24 tests; new corruption cases cover missing civic identity, elevated base and excessive mesh instances |
| `python assets/catalog.py` | 0 | Catalog regenerated from exported geometry, 138 models |
| `bun install --frozen-lockfile` in `packages/catalog` | 0 | Authoring dependencies installed, lockfile unchanged |
| `bun run validate` in `packages/catalog` | 0 | 142 entries; generated TypeScript updated |
| `bun test` in `packages/catalog` | 0 | 23 passed |
| `git diff --check` | 0 | No whitespace errors |

The first catalog test run exited 1 because its inventory assertion still
expected 138 entries. Updated it to 142 for the four additions; the rerun passed.
An early metadata read ran before Blender finished exporting and exited 1 on a
missing GLB; retried successfully after export completion. Neither issue remains.

Blender executable: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`.
Generation/render commands use `--background --python-exit-code 1 --python` with
the following scripts:

- `assets/blender/plaza_kit.py`: exit 0, four GLBs exported.
- `assets/blender/plaza_preview.py`: exit 0, side-by-side CPU render.
- `assets/blender/preview.py`: exit 0, full contact sheet (138 models plus four poses).

Visually inspected both exported-file renders. The side-by-side comparison shows
the distinct rounded civic silhouette, readable lectern and statue, Gazette
notices, and the wider angular concert stage. The updated contact sheet contains
the four new assets without clipping their display cells. Screenshot/render
paths: `assets/previews/mayor_vs_festival.png` and
`assets/previews/contact_sheet.png`.

## Teammate trial and integration

Open `assets/previews/mayor_vs_festival.png` for a same-scale comparison. Load
the four `/models/<name>.glb` URLs with GLTFLoader/useGLTF. Assets face +Z,
are authored in meters, and have ground roots at Y=0. Place the civic podium
at `(0,0,0)`, statue at `(-2.7,0,3.1)`, and board at `(2.75,0,2.7)`, relative to
the central plaza origin. Add paving height to Y. The festival stage belongs
in the separate festival district. Exact dimensions and regeneration commands
are in `assets/README.md`.

The catalog schema supports structured placement only for progression buildings.
Reasonable choice: preserve scene-only decorations and encode district hints in
descriptions and `district_central_plaza` / `district_festival` tags, rather than
invent progression unlocks or change the schema. These tags are hints for the
integrator, not automatic placement. Existing concert props get the festival tag.
The 22 shop entries and existing model files remain unchanged.

No blockers or proposed HTTP/DB contract changes. Scene source was read only;
switching the rendered scene to the new models is the integrator's assigned next
step. No browser integration test is claimed. No secrets, paid generation,
external imagery, likenesses, or GPU worker were needed. No push or merge.
