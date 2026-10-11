# Village procedural kit

FEAT-008 adds seven farm models, a contact sheet, and stricter per-model budgets.
See [FARM-008.md](FARM-008.md) for regeneration, triangle counts, runtime hooks,
placement guarantees, and economy choices. The full validator now checks 163 GLBs.
ASSET-009 adds [33 nature assets, 99 presets and distinct commercial/civic buildings](NATURE_009.md).
Its [nature sheet](previews/nature_pack.png) and [building comparison](previews/buildings_before_after.png)
render the shipped GLBs. The current full inventory is 206 GLBs; older task counts
below describe their original deliveries.

138 self-contained GLBs, generated locally with Blender 5.2.2; no textures,
external assets, credentials, paid services, or GPU worker required.
All geometry is original procedural geometry. The shared cream, terracotta,
teal, and sage palette lives in `blender/common.py`.

## Regenerate (PowerShell, repository root)

```powershell
$blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
& $blender --background --python-exit-code 1 --python assets/blender/village_kit.py
& $blender --background --python-exit-code 1 --python assets/blender/chibi_body.py
& $blender --background --python-exit-code 1 --python assets/blender/festival_kit.py
& $blender --background --python-exit-code 1 --python assets/blender/town_kit.py
& $blender --background --python-exit-code 1 --python assets/blender/event_kit.py
& $blender --background --python-exit-code 1 --python assets/blender/plaza_kit.py
python assets/check_glb.py
python assets/test_check_glb.py
python assets/catalog.py
& $blender --background --python-exit-code 1 --python assets/blender/preview.py
& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --events
& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --cosmetics
& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --wardrobe
& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --wardrobe --motion
& $blender --background --python-exit-code 1 --python assets/blender/town_preview.py
& $blender --background --python-exit-code 1 --python assets/blender/plaza_preview.py
```

The preview uses Cycles **CPU** and imports the exported files, including four
sample animation poses. Output: `assets/previews/contact_sheet.png`. The second
preview checks all five new wearables on the fallback villager and writes
`assets/previews/cosmetic_fit.png`. Cells are
individually scaled for readability, so the sheet does not compare real sizes.
Scripts resolve output paths relative to their own location. Blender is the only
generation dependency; the validator uses only Python's standard library.

## Coordinates and integration

- Meters, glTF +Y up, +Z forward. Blender source uses +Z up and -Y forward.
- Scene origin is the ground/base placement anchor. Decorative overhangs and
  asymmetric features need not have a bounding-box centroid at the origin.
- `house_lv1`, `house_lv2`, `house_lv3` share a 3 x 2.6 m foundation and
  3.3 x 2.9 m roof footprint. Height and details increase with level.
- `path_tile` is 1 x 1 m; `fence` is a 2 m module; `string_lights` spans exactly
  10 m along X. All delivered models are below 3,000 triangles including every
  mesh instance except `festival_main_stage` (3,725; ASSET-005 permits 6,000
  each). Landmarks permit up to 8,000; the wheel uses 2,296.
- Static kit: houses, `shop`, `mayor_stage` (speakers, microphone, bunting),
  `tree_a`, `tree_b`, `lantern`, `bench`, `fence`, `crater`, `path_tile`.
- Cosmetics: `hat_cap`, `hat_crown`, `hat_beanie`, `pet_dog`. Hats have their
  base at Y=0 and face +Z; position them on top of the head. For this villager,
  a starting attachment offset relative to `Head` is `(0, 0.68, 0)` in glTF
  coordinates; tune the offset for other heads. Dog is a standalone companion.
- `villager_base` is approximately 1.86 m tall and uses rigid vertex weights
  with seven joints, including exact joint name `Head`. This deliberately
  simple toy rig supports fallback avatars without any generated likeness.
- Exact clip names: `idle`, `walk`, `wave`, `cheer`; 24 fps, 49 sampled frames,
  2 seconds each, repeating endpoints. Walk is in place. Wave/cheer begin with
  raised arms; crossfade from idle in the application. Bind pose has arms down.
- Named materials: `wall`, `roof`, `trim`, `accent`, `wood`, `leaf`, `glass`,
  `stone`, `metal`, `light`, `soil`, `path`, `fur` as appropriate. Avatar has
  exactly `skin`, `hair`, `shirt`, `pants`, `shoes`. Clone materials per instance
  before tinting to avoid changing other villagers. `light` is a warm painted
  surface; the application can supply actual scene lighting if desired.

Serve through Vite's public directory and load `/models/house_lv1.glb` or
`/models/villager_base.glb` with Three.js GLTFLoader/useGLTF. Use SkeletonUtils
clone for independent animated instances and AnimationMixer for clip playback.
The application is not modified by this asset-only task.

## Validation

`python assets/check_glb.py [optional-model-directory]` requires all 138 files and
checks every GLB found there: container/buffer bounds, triangle primitive counts,
material names, embedded buffers, required avatar skin weights and Head joint,
and all four baked clips. It also checks dense accessor strides/bounds, finite
values, vertex indices, texture-free exports, required runtime nodes, new-asset
ground anchors, the flat lake, strand length, and alternate-house footprints.
Twenty-four regression checks exercise corrupt assets, Ferris wheel hierarchy,
town inventory, catalog suggestions, lot/tile sizes, and clothing bind matrices.
It exits nonzero on violations. It is a focused kit
validator, not a complete implementation of the glTF specification.

The initial validator run caught animation key reduction by the exporter;
animation optimization is now disabled to preserve per-frame baked samples.
No secrets were needed or read. No contract changes are proposed.

## Festival expansion (ASSET-002)

See [CATALOG.md](CATALOG.md) for all names, exact triangle/node counts, runtime
hooks, and intended uses. The 36 additions cover festival grounds, landmarks,
house variants, nature, five wearables, a corgi, and two ambient creatures.
New tint slots are `water`, `jacket`, `blossom`, `fire`, and `hay`. Surfaces are
opaque and flat shaded; light bulbs and fire are painted geometry, with no
dynamic lights, particle systems, or paid generation required. Single-sheet
surfaces are exported double-sided. Place the lake a few millimeters above
terrain to avoid coplanar surfaces.

All three alternate houses preserve their original X/Z bounds. The backyard
is a standalone 3 x 2.4 m module, open toward +Z; place its root at
`house.position + (0, 0, -2.75)`. No house geometry is included in that add-on.

### Runtime motion

Use `gltf.scene.getObjectByName(...)` on each loaded asset. Animate relative
to its rest transform; do not reset pivots to the asset origin.

| Asset | Hook | Suggested motion (glTF local axes) |
| --- | --- | --- |
| stage_lights | lamp_0 through lamp_3 | Rotate X for tilt and Y for pan; lenses face +Z |
| ferris_wheel | wheel | Set rotation.z to angle in radians; axle remains fixed |
| ferris_wheel | gondola_0 through gondola_9 | Set each rotation.z to negative wheel angle to keep seats upright |
| fountain | water | Tint basin surface; upper_water and jet use the same material |
| campfire | fire | Pulse scale around its low pivot; stones and logs stay fixed |
| bird / butterfly | wing_l, wing_r | Opposing rotation.z values for flapping |

These assets contain named movable nodes, not baked clips; application code
drives them. Each gondola is a child of `wheel`, with its own suspension pivot.
Clone shared materials before per-instance tinting.

### Wearables

Attach each imported wearable scene to the named bone with identity rotation,
unit scale, and the following local position. Offsets were visually checked on
the exported `villager_base` rest pose, not on generated heads.

| Model | Bone | Local position (X, Y, Z meters) |
| --- | --- | --- |
| hat_festival | Head | (0, 0.68, 0) |
| hat_headphones | Head | (0, 0.20, 0) |
| glasses_round | Head | (0, 0.25, 0.31) |
| jacket_denim | Spine | (0, -0.065, 0) |
| scarf | Head | (0, -0.165, 0) |

The jacket is an open-front, sleeveless denim overlay: it follows the torso
without needing arm skinning. The glasses are frames without transparent lenses.
Do not combine the bucket hat and headphones without adjusting their fit.
For a quick teammate trial, run the validator, open both preview PNGs, and load
`/models/ferris_wheel.glb` or `/models/hat_festival.glb` through GLTFLoader.
The asset-only task does not alter or test browser integration.

## Rectangular town and wardrobe (ASSET-003)

48 additions: 15 street/block modules, 13 buildings (including four high-level
house variants), 14 villager wearables, two dog decorations, and four house
upgrades. `town_spec.py` owns this inventory. `catalog.py` produces both the
complete CATALOG.md and `catalog_additions.json` from the actual GLBs. The latter
contains 48 `entries` for ARCH-001 to merge; `tint_materials` is nested under
`asset` as requested by that task. Suggested prices are 500 XP for buildings and
houses, 75 XP otherwise. Slots, prices, and custom anchors are integration
suggestions; the registry schema is not present in this worktree.

### Grid placement

Eight paving/road tiles span exactly [-2,2] in X and Z, with root at the ground
center. Snap centers 4 m apart. Road surface is Y=.11, curb top Y=.22, pedestrian
tile top Y=.10. Adjacent connected road edges share the same 3 m opening.
`road_straight` and `crosswalk` connect +/-Z; `road_corner` connects +Z/+X;
`road_t` connects +Z/+X/-X; `road_cross` connects all four sides. Rotate the
scene root about Y in quarter turns to select other connections. `curb_corner`
is a decorative rounded curb on a pedestrian tile, not a drivable road corner.
Small street props use ground origins, not full-tile footprints. `hedge_row`
is an exact 4 m X module; `streetlight` exposes a unique mesh node `lamp`.

Every new building fits within an 8 x 8 m centered lot and faces +Z. Lv4 houses
have two storeys, lv5 houses have three and a turret; `_b` uses teal walls and
corner detailing with the same footprint. Shops have distinct geometric signs
(cup, vinyl, loaf, dumbbell, palette, book, voxel mascot); Mayor HQ has a clock.
Raise buildings/props .10-.12 m when placing on paving. The exported
`town_grid.png` assembles six lots and roads into a 40 x 28 m rectangle at
actual scale. Painted light and neon surfaces do not emit scene lighting.

### Clothing and accessory attachment

The seven torso/leg/foot overlays contain the exact seven-joint bind skeleton
from exported `villager_base`. They have no duplicate avatar geometry and no
clips. Mount their scene at the avatar scene origin (`anchor: villager_base`),
identity rotation and unit scale. Rebind each clothing SkinnedMesh to the live
avatar bones **by name**, retaining the clothing skeleton's bone ordering,
inverse bind matrices, and mesh bind matrix. Do not parent the entire garment
under a single torso bone. Remove the unused imported garment rig after
rebinding. The base avatar's AnimationMixer then drives sleeves and legs.
Clone the avatar skeleton per instance before attaching clothes.

For Three.js, construct `new Skeleton(garment.skeleton.bones.map(b =>
avatarBonesByName[b.name]), garment.skeleton.boneInverses)` and pass it with
`garment.bindMatrix` to `garment.bind(...)` after placing the garment at the
matching avatar origin. These are rigid-weighted toy overlays, matching the
fallback rig's construction. They fit over the base outfit; shorts include
skin-colored calves covering the default trousers, so tint their `skin`
material together with the avatar. Equip one item per torso/legs/feet slot.
Choose either a necklace or scarf; combining overlapping accessories can clip.

Rigid accessories use the exact local transforms in `catalog_additions.json`:

| Model | Bone | Offset X,Y,Z | Rotation X,Y,Z (radians) |
| --- | --- | --- | --- |
| backpack | Spine | 0,.12,-.26 | 0,0,0 |
| hat_cowboy / hat_beret / hat_party | Head | 0,.68,0 | 0,0,0 |
| glasses_sun | Head | 0,.25,.31 | 0,0,0 |
| necklace_chain | Spine | 0,.37,.02 | 0,0,0 |
| wristband_festival | Arm_L | 0,.35,0 | pi,0,0 |

Arm_L points down in the bind pose, hence the positive local wrist offset and
half-turn rotation. Hats and glasses use the established fallback-head fit.
Pet collar/bandana geometry is already positioned relative to `pet_dog`'s root:
attach to that scene at zero offset, identity rotation, unit scale. Both require
the existing `pet_dog` catalog item. No pet skeleton is required.

### House upgrades

`house_ground` means the house scene root. Porch: offset (0,0,3.35); gnome:
(2.5,0,3.3); neon sign: (0,2.6,2.8). These defaults target lv4/lv5 houses; tune
for the smaller older cottages. `house_roof` is a host-supplied anchor on the
front roof plane: for lv4 use (0,4.11,1.1), for lv5 (0,5.76,1.1), relative to
the house root, with identity orientation. Solar panel rotation is (.306,0,0)
relative to that anchor, matching the gable slope; all upgrade scales are 1.
The ground of the host house may itself be raised above paving.

Visual QA: `previews/contact_sheet.png` (101 assets + four base clips),
`previews/wardrobe_fit.png` (all 16 additions on their hosts),
`previews/wardrobe_motion.png` (walk/wave plus dog fit), and
`previews/town_grid.png` (assembled rectangular town). Backpack is shown from
behind and dog decorations from an angle. Use the same regeneration commands
above; all rendering uses Cycles CPU. No credentials are needed.

## Mayor cosmetic events and weather (ASSET-004)

33 additions, each at most 2,000 triangles (largest: snowman, 1,008).
`event_spec.py` defines the six event packs: festival night, spooky, winter,
birthday (five pieces each), movie night and game night (four each). Five
weather props are grouped under `weather_fx`. All are original procedural
geometry using the existing palette; the block stack has no branded textures.

`catalog.py` also writes `catalog_additions_004.json`: exactly one suggestion
per new GLB, kind `decoration`, with tags `event_pack` and its pack identifier.
These are Mayor-controlled temporary cosmetics, with suggested `price_xp: 0`
and no `shop` tag. No registry or application files are changed. Most entries
use slot `decoration` and ground anchors. The task explicitly requires
`party_hat_villager` to use slot `head` while retaining kind `decoration`;
`packages/catalog/validate.ts` currently rejects that combination. The
integrator should allow head-slot event decorations or approve reclassifying
this one entry as clothing before merging suggestions. No HTTP/DB changes.

The hat attaches to `Head` at `(0, .68, 0)` with identity rotation/unit scale,
visually checked on `villager_base` in `previews/events.png`. Its cone sits on
the fallback hair. Other heads may need adjusted attachment offsets.

Every prop has its bottom at Y=0. Raise clouds to sky height, the bat garland
and icicle strand to their hanging height, and the web to the desired wall
corner. Flat signs, cards, and screens face +Z. Weather cards are fixed planes,
not automatic billboards; rotate their scene roots toward the viewer if desired.
The rainbow is a double-sided colored ribbon. Fog and sun cards are
double-sided alpha-blended silhouettes without textures. In Three.js, disabling
`depthWrite` on cloned transparent materials can reduce overlapping-card
artifacts; alpha sorting and billboarding remain application responsibilities.

`cloud_rain` contains one nonempty node named `drops`, parenting all 15 drops;
the cloud remains outside that hierarchy. Save its rest position and animate
`drops.position.y = restY - ((elapsedSeconds * 1.2) % 1.0)` for a simple rain
loop. Reset to rest on event teardown. No baked clips are included. Confetti
is a static burst. Neon, lights, candles, and glow sticks use painted colors,
not scene illumination or bloom. Clone materials before per-instance tinting.

Teammate trial: run the validator and regression commands above, inspect
`previews/events.png` (all 33 additions plus fitted hat) and the updated
`previews/contact_sheet.png` (134 assets plus four poses), then load
`/models/projector_screen.glb` or `/models/cloud_rain.glb` using GLTFLoader.
These are CPU renders of exported files; browser event orchestration is an
integration task. No credentials, network generation, or GPU worker is needed.

## Mayor's Plaza and festival contrast (ASSET-005)

Four new scene-only assets replace the civic use of a concert stage. The legacy
`mayor_stage` GLB stays available for existing consumers. The three civic pieces
use deep green, white stone and brass; there are no speakers, bunting or trusses
in the civic set. `festival_main_stage` includes its own arch, speakers, static
LED-style equalizer panel, front stairs and two crowd barriers. Neon is painted
geometry, consistent with the existing kit, and does not emit scene lighting.

| Model | Triangles | Dimensions X/Y/Z (m) | Placement hint |
| --- | ---: | --- | --- |
| mayor_podium | 2,108 | 4.92 / 4.05 / 4.76 | Central plaza civic anchor |
| mayor_statue | 985 | 1.51 / 2.81 / 1.10 | Front-left of podium |
| notice_board | 657 | 2.12 / 2.40 / 0.80 | Front-right of podium |
| festival_main_stage | 3,725 | 7.20 / 4.84 / 5.20 | Festival district |

All four use meters, +Y up, +Z forward, unit scale, ground root at Y=0, embedded
materials and no textures or clips. The podium root is the center of the round
base; the flag and front stairs make its bounds asymmetric. New tint slots are
`civic_white`, `civic_green`, `brass`, `paper`, `neon_cyan`, `neon_pink`.
`plaza_spec.py` records required feature nodes and the per-asset 6,000-triangle cap.

Registry placement hints are explicit `district_central_plaza` and
`district_festival` tags plus descriptions, since this schema reserves structured
placement for progression buildings. These decorations do not add a progression
district or unlock, and tags do not automatically position them. Existing concert
props (`mayor_stage`, `stage_lights`, `speaker_stack`, `dj_booth`, `light_tower`)
also carry the festival hint. The existing 22-item shop remains unchanged.

Integrator trial: serve the web app and load `/models/mayor_podium.glb`,
`/models/mayor_statue.glb`, `/models/notice_board.glb` and
`/models/festival_main_stage.glb` with GLTFLoader/useGLTF. For the civic assembly,
place the podium at local `(0,0,0)`, statue at `(-2.7,0,3.1)` and board at
`(2.75,0,2.7)`. All face +Z. Raise all roots by the paving height when needed.
Reserve roughly 9.3 x 8.3 m for the complete plaza. Keep the festival assembly
in its own district; its barriers already extend to Z=3.3. The separate
`stage_lights` can remain a festival accessory but is unnecessary for the new
stage silhouette. Scene code and runtime fallbacks are unchanged in this task;
the integrator switches model selection after merge.

`previews/mayor_vs_festival.png` compares the assemblies at the same meter scale;
`previews/contact_sheet.png` includes all 138 models and four avatar poses.
Both renders import the exported GLBs. Run the regeneration commands above,
`python assets/test_check_glb.py`, then `bun run validate` and `bun test` from
`packages/catalog`. No secrets or provider calls are needed.
