# ASSET-009: nature variety and distinct buildings

33 original procedural nature GLBs: 12 trees, 6 bushes/hedges, 8 garden beds and
7 ground/water details. Each is one mesh with 1–3 named materials (`leaf`, `bark`,
`flower`), and three registry presets. Trees use 44–676 triangles; other nature
assets use 15–1,332. No texture, external asset, credential, model provider or GPU
worker is required. `nature_pack.png` shows all models; `nature_variants.png`
shows all 99 presets. These are renders of the exported GLBs, not concept art.

## Teammate integration

Load `/models/nature_oak.glb` or any `nature_*` path from the registry using the
existing GLTFLoader. Filter entries by `tags.includes('nature')`; filter again
by `scatter.surface` for ground versus water. `scatter.hint` suggests a placement
zone, `weight` is a relative selection weight among eligible entries, and
`clearance_m` is the exclusion radius at scale 1. Multiply clearance by the
selected preset's scale. Reserve building/road collision bounds separately.
Pick a preset from `asset.variants`, multiply the root scale by its `scale`, and
apply each hex color to the matching material name. Clone materials before
tinting an independent object. For instancing, batch by GLB + preset + primitive
(one draw per material primitive), then write instance matrices. One glTF mesh
with three materials is up to three draw calls, not one.

Coordinates follow the existing kit: meters, glTF +Y up / +Z front, bottom at
Y=0. Put lily pads at pond surface height; all other roots at terrain height.
Presets are data for layout consumers; this asset-only task does not change the
web scatter algorithm or make new shop items. Offline fixture behavior remains.

## Building scope and choices

Nine storefront/civic meshes were rebuilt, together with the pet shelter.
`library` is the bookshop ID; `shop` is the general store. All retain exact old
horizontal bounds, registry IDs, prices, progression and attachment metadata.
Residential apartments/houses and open-air props (gardens, wheel, bridge,
festival lights, podium/stage) are outside the commercial/civic building scope.
The already unique colosseum retains seating and gameplay hooks while its main
entrance gains twin towers, banners and a signed marquee. This preserves its
competition layout. Before snapshots and footprint/registry baselines are
committed under `baseline_009/` and `buildings_baseline_009.json` for reproducible
comparisons.

| ID | Distinct architecture and signage |
| --- | --- |
| shop | Tall false front, cornice, GENERAL STORE sign and produce crates |
| storefront_cafe | Round pavilion roof, pergola, coffee sign and outdoor tables |
| storefront_records | Slanted roof, rooftop vinyl disc and record bins |
| storefront_bakery | Steep roof, striped awning, bread display and chimney |
| library | Asymmetric upper storey, projecting bay window and stacked books |
| arcade | Flat roof, neon marquee, emissive cabinet screens and checkerboard floor |
| gym | Barrel vault, GYM lettering and visible barbell racks |
| studio_art | Sawtooth roof, clerestory glazing, easels and ART STUDIO lettering |
| town_hall | Clock tower, columned portico and TOWN HALL lettering |
| pet_shelter | Gabled roof, paired kennels, paw emblem and PET SHELTER sign |
| colosseum | Twin entrance towers, banners and VILLAGE ARENA marquee |

`chimney_smoke` is a nonempty mesh node with static stylized smoke. Animate its
position/scale relative to rest if desired. Arcade `neon_cyan` and `neon_pink`
are emissive glTF materials; bloom or actual scene lighting remains the host's
choice. The CPU Workbench sheet displays their base colors, not bloom.

## Regeneration (repository root, PowerShell)

```powershell
$blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
& $blender --background --python-exit-code 1 --python assets/blender/nature_009.py
& $blender --background --python-exit-code 1 --python assets/blender/buildings_009.py
python assets/package_009.py
python assets/catalog.py
bun run --cwd packages/catalog validate
& $blender --background --python-exit-code 1 --python assets/blender/preview_009.py
python assets/sheets_009.py
python assets/check_glb.py
python assets/test_check_glb.py
python assets/validate_009.py
bun test --cwd packages/catalog
```

Pillow is needed only for sheet assembly; Blender performs geometry and GLB
rendering. The schema additions (`scatter`, `asset.variants`) are optional and
generated TypeScript includes them. No HTTP or database contract changes are
proposed. Older generators overwrite building files, so run `buildings_009.py`
after the older kit generators when rebuilding everything.
