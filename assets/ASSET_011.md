# ASSET-011 delivery

Branch: `asset/ASSET-011`. Palette milestone: `bf66c89`. The follow-up commit
contains the full-kit material-name repair and this handoff. No push or merge.

Eleven commercial/civic GLBs now have distinct authored palettes and embedded
ASSET-008 surface maps. All original geometry/accessor bytes, node graphs,
transforms, anchors, full bounds, material names, IDs and progression settings
are preserved. Added UVs and embedded 128px maps require no external requests.

| Building | Identity |
| --- | --- |
| Arcade | Deep navy, emissive magenta/cyan, dark metal roof |
| Bakery | Cream stucco, six pink/six white awning stripes, terracotta tile |
| Vinyl shop | Mustard walls, black metal roof, checker posts and bins |
| Cafe | Sage walls, white woodwork, copper-colored metal roof |
| Town hall | Pale stone, slate shingles, brass clock and lettering |
| Gym | Concrete, transmissive glass, orange doors/equipment/sign |
| Art studio | White brick, colorful paint-splash posts and door |
| Library | Deep green, dark wood shelves, gold lettering |
| Pet shelter | Warm yellow, blue doors, muted blue shingles |
| Farm store | Retained red barn identity, white wood trim |
| General store | Teal siding, cream cornice and lettering |

Choices: the library's existing `stone` recipe supplies rough stucco/concrete,
and its `metal` recipe supplies copper via a copper base color. No geometry was
added for surface details. New independent channels `awning_pink`, `checker_trim`
and `paint_splash_trim` preserve existing runtime tint names. Registry and legacy
authoring tint lists include these; farm-store tint names are now listed too.

## Review and try

Open `assets/previews/buildings_palette_before_after.png`: all eleven buildings
in matched before/after pairs, rendered from the actual GLBs with Cycles PBR
lighting. This sheet was visually inspected. Eleven corresponding 420px-wide
thumbnails are in `apps/web/public/thumbs/`. No application UI code changed.

Serve the existing web app or open any of the eleven GLBs in a glTF viewer.
Existing `/models/<id>.glb` URLs automatically use these materials; refresh any
cached models. Fixtures and the GPU-offline path need no changes. No secrets,
provider calls, generated photos, live services or database publication needed.

From the repository root, with Python/Pillow, Bun and Blender installed:

```powershell
python assets/palette_011.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/preview_011.py
python assets/sheets_011.py
python assets/validate_011.py
bun run --cwd packages/catalog validate
```

`assets/baseline_011/` contains the exact input GLBs and catalog placement
contracts. Migration always starts from those inputs and is byte-idempotent.
Run this migration after older geometry exporters, which otherwise restore
their older palettes. To intentionally accept upstream geometry changes, refresh
the baseline inputs and placement snapshot in a separate reviewed asset update.

## Validation

Completed commands and actual exit codes:

| Command | Exit | Result |
| --- | ---: | --- |
| `python assets/palette_011.py` | 0 | Eleven migrations; byte-idempotence verified by SHA-256 of GLBs and both catalogs before/after a second run |
| Blender command above (via Python subprocess) | 0 | 22 matched Cycles renders, 24 samples each |
| `python assets/sheets_011.py` | 0 | Comparison sheet and eleven thumbnails |
| `python assets/validate_011.py` | 0 | Eleven palettes; exact geometry/nodes/bounds/anchors and catalog contracts; texture, stripe, trim, emission and thumbnail checks; zero failures |
| `python assets/repair_fitness_material_names_011.py` | 0 | Existing unnamed fitness materials given names; binary data and all other JSON fields verified unchanged |
| `python assets/check_glb.py` | 0 | **285 GLBs, zero failures** |
| `python assets/test_check_glb.py` | 0 | **30 passed** |
| `bun install --frozen-lockfile` (packages/catalog) | 0 | Dependencies installed without lockfile changes |
| `bun run validate` (packages/catalog) | 0 | **293 entries**, generated catalog refreshed |
| `bun test` (packages/catalog) | 0 | **36 passed**, 169 assertions |
| `git diff --check` | 0 | Clean |
| `python assets/validate_009.py` | 1 | Existing historical snapshot expects `price_xp`; current catalog uses `price_coins`, raising `KeyError: 'price_xp'` |

The initial full-kit validator exposed four pre-existing unnamed materials in
`fitness_corner.glb`. The small repair script gives them descriptive names
without changing colors, geometry, nodes or data. Legacy authoring inventory
`assets/catalog_additions.json` was refreshed for the three added tint channels,
restoring its regression test. An initial preview attempt lacked Pillow inside
Blender; moving that import into the texture-generation function fixed it.

The historical ASSET-009 check remains unchanged: its currency snapshot predates
this task. ASSET-011 instead checks the exact current catalog contract captured
before this change. This is not a delivery blocker; the full GLB validator,
current catalog suite and task acceptance validator all pass. No proposed API
or database contract changes.

Full changed-file inventory: `assets/ASSET_011_FILES.txt`. Changes are restricted
to `assets/**`, `apps/web/public/models/**`, `apps/web/public/thumbs/**` and
`packages/catalog/**`.
