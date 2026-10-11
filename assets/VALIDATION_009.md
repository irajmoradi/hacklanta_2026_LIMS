# ASSET-009 validation and handoff

Branch: `asset/ASSET-009`. Geometry/registry milestone: `f8dfc3c`.
The following commit contains the reviewed previews, palette refinement,
catalog documentation and this report.

Delivered: 33 single-mesh nature GLBs with 99 tint/size presets; 10 rebuilt
commercial/civic buildings and a rebuilt colosseum entrance. All 11 building
IDs, horizontal envelopes, anchors and progression records are preserved.
Nature caps: trees <=2,500 triangles (actual maximum 676), others <=1,500
(actual maximum 1,332), at most three materials. Full registry: 218 entries,
206 GLBs. No secrets read, providers called, or browser/application code changed.

## Verification executed

All final commands below exited **0**:

| Command (repository root unless noted) | Result |
| --- | --- |
| Blender 5.2.2 `--background --python-exit-code 1 --python assets/blender/nature_009.py` | 33 GLBs exported |
| Blender 5.2.2 `--background --python-exit-code 1 --python assets/blender/buildings_009.py` | 11 GLBs exported |
| `python assets/package_009.py` | Registry entries and optional schema fields authored |
| `python assets/catalog.py` | 206-model catalog generated |
| `python assets/check_glb.py` | 206 checked, 0 failures |
| `python assets/test_check_glb.py` | 28 passed |
| `python assets/validate_009.py` | 33 nature assets, 99 presets, 11 preserved building records, 0 failures |
| `bun install --frozen-lockfile --cwd packages/catalog` | Dependencies installed |
| `bun run validate` in `packages/catalog` | 218 entries; TypeScript generated |
| `bun test` in `packages/catalog` | 32 passed, 0 failed |
| Blender 5.2.2 `--background --python-exit-code 1 --python assets/blender/preview_009.py` | 121 GLB/preset review renders |
| `python assets/sheets_009.py` | Three labeled contact sheets |
| `git diff --check` | Clean |

During development the existing building-lot regression referenced the removed
`walls` node. It now corrupts the preserved `foundation` node and continues to
test rejection of out-of-lot geometry. Earlier generation and footprint issues
were fixed before the passing runs above. New negative tests cover nature mesh
count, polygon cap, grounding, tint names, scatter fields and variant metadata.

## Visual QA and teammate trial

Reviewed `assets/previews/nature_pack.png`, `nature_variants.png`, and
`buildings_before_after.png`. Fixed a partially obscured general-store sign and
moved the arena's new towers to its visible entrance. Presets keep species color
identity while varying size and shade. The sheets are CPU renders, not browser
screenshots. No browser integration is claimed.

Open the sheets, run the validation commands, then load `/models/nature_oak.glb`
and `/models/arcade.glb` through the existing GLTFLoader. Follow `NATURE_009.md`
to consume scatter weights and presets. New nature placement is opt-in; no
layout code is in this task's allowed paths.

Changed paths: `apps/web/public/models/` (33 additions, 11 replacements),
`assets/` (procedural specs/generators, before snapshots, validators, catalog,
previews, integration instructions), and `packages/catalog/` (JSON, schema,
generated TypeScript, validation/tests, README). The pre-existing user change
to `docs/tasks/ASSET-009.md` is untouched and uncommitted.

Blockers: none. Proposed HTTP/DB contract changes: none. Registry additions are
implemented within the authorized catalog paths. Scope choices are recorded in
`NATURE_009.md`; residential buildings and open-air civic/event props retain their
existing assets. No pushes or merges were performed.
