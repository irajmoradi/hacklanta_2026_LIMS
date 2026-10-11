# ASSET-003 validation report

Branch: `asset/ASSET-003`. Geometry/validator milestone: `8676eed`.

Delivered all 48 requested additions, bringing the kit to 101 GLBs. Original
53 GLBs are unchanged from the starting commit. All changes stay in `assets/**`
and `apps/web/public/models/**`. New content includes 15 street modules,
13 buildings, 14 villager wearables, two dog decorations, and four upgrades.
The largest new asset is `house_lv5_b`, 914 triangles, below the 6,000 building
budget; all other additions are also below 3,000. See CATALOG.md for exact
counts and catalog_additions.json for all 48 registry suggestions.

Commands run from the repository root in PowerShell; `$blender` means
`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`:

| Command | Exit | Result |
| --- | --- | --- |
| `& $blender --background --python-exit-code 1 --python assets/blender/town_kit.py` | 0 | 48 GLBs exported, no generation warnings/errors |
| `python assets/check_glb.py` | 0 | All 101 GLBs checked, zero failures |
| `python assets/test_check_glb.py` | 0 | All 15 regression tests passed |
| `python assets/catalog.py` | 0 | Catalog and 48 suggestions generated from exported GLBs |
| `& $blender --background --python-exit-code 1 --python assets/blender/preview.py` | 0 | All 101 exported assets plus four original animation poses rendered |
| `& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --wardrobe` | 0 | All 16 new wearables/pet decorations rendered on their hosts |
| `& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --wardrobe --motion` | 0 | Clothing rebound to live villager rig; walk/wave poses rendered |
| `& $blender --background --python-exit-code 1 --python assets/blender/town_preview.py` | 0 | Six lots with connected roads rendered at actual scale |
| `git diff --check` | 0 | No whitespace errors |

QA artifacts: `assets/previews/contact_sheet.png`, `wardrobe_fit.png`,
`wardrobe_motion.png`, and `town_grid.png` (all in `assets/previews/`). These
are Blender CPU renders of reimported exports, not browser screenshots.
Contact-sheet models scale independently for readability; the town uses
actual meters. The older cosmetic_fit.png remains available for ASSET-002.

Validator now requires all requested filenames; enforces 4 m tile bounds,
8 m building lot bounds, ground anchors, 6k building/3k other budgets,
streetlight lamp node, required tint materials, clothing skins, finite
normalized weights, and valid joint indices. New regression coverage also
compares every clothing inverse bind matrix against the original villager,
checks the 48 catalog suggestions against real files/materials, and rejects
broken tile sizes, oversized buildings, missing lamps, and unskinned garments.

Iterations: fixed intersecting road curbs before rendering; changed arm-local
wristband offset to account for the downward-pointing Arm_L joint; changed
flannel stripes to follow the torso surface; raised long sleeves to fully
cover the original sleeve caps; moved shop signs in front of the roof edge.
An initial wardrobe preview exited 1 because it removed a Blender object
before removing the object's set reference; fixed deletion ordering and
reran successfully. A later preview rotation used stale object matrices;
explicit dependency-graph update fixes rotated display placement.

Choices: original procedural texture-free geometry, shared cozy palette,
opaque painted glass/light/neon, geometric shop emblems, rigid-weighted
clothing using the existing seven-bone skeleton. Shorts include tintable
skin calves over the default trousers. Clothing and accessory fit is for
villager_base, not arbitrary generated heads/bodies. No secrets were read,
no paid calls or GPU worker used. No app code changed or browser tests run.

Teammate trial: run `python assets/check_glb.py` and
`python assets/test_check_glb.py`, open the four PNGs, then use GLTFLoader
with `/models/road_cross.glb` or `/models/house_lv4.glb`. README documents
all regeneration commands, road orientations, bone offsets, house anchors,
and the clothing skeleton rebind procedure. Clone tint materials per instance.

No asset-delivery blockers or proposed HTTP/DB contract changes. Integration
handoff: merge catalog_additions.json into ARCH-001's registry and resolve
its suggested slot vocabulary/prices/custom anchors against the final schema
(not present here). Implement garment skeleton rebinding as documented;
ordinary single-bone attachment is insufficient for sleeve/leg animations.
Do not run independent AnimationMixers for the garments.

---

# ASSET-002 validation report (historical)

Branch: `asset/ASSET-002`. Geometry/validator milestone: `29ba7b6`.

Delivered all 36 requested additions, bringing the kit to 53 GLBs. All edits
are in `assets/**` and `apps/web/public/models/**`. Original 17 GLBs remain
unchanged. Exact counts and intended uses are in [CATALOG.md](CATALOG.md).
The largest addition is the Ferris wheel at 2,296 triangles; every file is
under 3,000 despite the permitted 8,000-triangle landmark budget.

Commands run from the repository root (PowerShell); `$blender` below is
`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`:

| Command | Exit | Result |
| --- | --- | --- |
| `& $blender --background --python-exit-code 1 --python assets/blender/festival_kit.py` | 0 | 36 GLBs exported, final generation without mesh warnings |
| `python assets/check_glb.py` | 0 | 53 GLBs checked, zero failures |
| `python assets/test_check_glb.py` | 0 | Nine regression tests passed |
| `python assets/catalog.py` | 0 | Catalog generated from all 53 validated exports |
| `& $blender --background --python-exit-code 1 --python assets/blender/preview.py` | 0 | Exported files and four original clips reimported and CPU-rendered |
| `& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --cosmetics` | 0 | Five wearables rendered on the exported fallback avatar |
| `git diff --check` | 0 | No whitespace errors |

Visual QA: `assets/previews/contact_sheet.png` and
`assets/previews/cosmetic_fit.png`. Both PNGs opened and inspected. Preview
plinths are display aids, not part of the GLBs; models are independently scaled.
An initial contact sheet put the flat lake coplanar with its plinth; the preview
now lifts all assets 2.5 cm and uses even sunlight. Source GLB ground anchors
remain Y=0. Duplicate back-facing polygons in the initial new sheets caused
export warnings; single polygons plus double-sided materials removed them.
The first regression run had one incorrect test mutation (local cross-section
scale did not lengthen a rotated cord); moving strand nodes along world X
correctly exercises the length check. The final nine-test run exits 0.

Validator additions: all new filenames/materials, runtime node uniqueness and
nonempty geometry, per-category budgets, dense accessor bounds/strides, finite
data, index ranges, ground anchors, exact 10 m strand, planar lake, and matching
alternate-house footprints. Wheel regression confirms ten child gondolas at
2.5 m radius and a 3.25 m axle pivot, separate from fixed supports.

Choices: cozy original procedural geometry; painted opaque water/fire/lights;
teal alternate cottages; corgi companion; sleeveless open-front denim overlay;
round glasses without lenses. All five new cosmetics have verified rest-pose
attachment offsets in README. The wheel rotates about glTF local Z and requires
opposite local Z rotation on each gondola to keep seats upright. New movable
nodes are application-driven, with no baked clips added. Browser integration
and arbitrary generated-head fit are outside this task and are not tested.

Teammate trial: run `python assets/check_glb.py`, inspect both PNGs, then load
`/models/ferris_wheel.glb` using GLTFLoader and animate its `wheel` node. Use
README for gondola counter-rotation, tint slots, wearable attachment positions,
backyard placement, and regeneration commands.

No blockers or proposed contract changes. No credentials, external assets,
paid calls, generated likenesses, or GPU worker were required.

---

# ASSET-001 validation report (historical)

Branch: `asset/ASSET-001`. Geometry/rig milestone: `80669f5`.

Delivered 16 static assets and one rigged villager under
`apps/web/public/models/`, four Blender scripts under `assets/blender/`,
`assets/check_glb.py`, README, and `assets/previews/contact_sheet.png`.
All edits are inside the task's allowed paths.

Commands actually run from the repository root (PowerShell):

| Command | Exit | Result |
| --- | --- | --- |
| `& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python assets/blender/village_kit.py` | 0 | 16 GLBs exported |
| `& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/chibi_body.py` | 0 | Skinned avatar and four clips exported |
| `python assets/check_glb.py` | 0 | Final run: 17 GLBs, zero failures |
| `& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/preview.py` | 0 | All GLBs reimported; CPU contact sheet rendered |
| `git diff --check` | 0 | No whitespace errors |

An earlier validator run exited 1 because Blender optimized constant animation
channels down to fewer samples. Disabling animation-size optimization fixed it;
the final output retains baked samples. The first preview included Blender's
internal bone-display helper mesh; excluding the importer's `glTF_not_exported`
collection fixed the preview. Final PNG was opened and visually inspected.

| Model | Triangles |
| --- | ---: |
| house_lv1 | 148 |
| house_lv2 | 244 |
| house_lv3 | 414 |
| shop | 276 |
| mayor_stage | 373 |
| tree_a | 88 |
| tree_b | 70 |
| lantern | 122 |
| bench | 132 |
| fence | 60 |
| crater | 270 |
| path_tile | 12 |
| hat_cap | 56 |
| hat_crown | 100 |
| hat_beanie | 108 |
| pet_dog | 248 |
| villager_base | 368 |

Teammate trial: open the contact sheet, run `python assets/check_glb.py`, then
load `/models/villager_base.glb` from the web app's public directory using
GLTFLoader and play `idle`, `walk`, `wave`, or `cheer`. See README for full
regeneration commands and placement/tint conventions.

Choices: original procedural flat geometry; cream/terracotta/teal palette;
rigidly weighted toy limbs; 2-second in-place clips; CPU-only preview. No secrets
or model services were needed. Browser integration was outside allowed paths
and has not been tested. No blockers or proposed contract changes.
