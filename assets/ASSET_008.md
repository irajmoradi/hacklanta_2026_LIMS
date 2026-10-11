# ASSET-008 — materials, house choices and rebuilt rewards

Branch: `asset/ASSET-008`. Asset milestone: `3662106`. The final commit adds the editor integration, regression coverage and review artifacts.

## Delivery

- Eleven shared surface recipes in `assets/materials/library.json`: wood, brick, stone, shingle, tile, metal, glass, fabric, leather, brass and ceramic. Eight deterministic, neutral 128 × 128 PNGs are embedded in the GLBs. Paint remains a separate glTF base-color factor. The runtime material picker uses the same patterns and PBR values without fetching textures.
- All 28 ASSET-006 houses now have PBR surfaces. Their original material channels, exterior details and legacy bounds remain intact. Decorations include wood benches/fences, ceramic flower details, stone fountains and metallic lamps; the cowboy hat uses leather.
- Sixty registered house variants: six styles × five levels × two new options, plus the existing Classic option. Level 1: porch/bay window; level 2: balcony/bay window; levels 3–5: tower/greenhouse. Upper-level variants fit the existing level 4/5 envelopes. Greenhouse thumbnails face the rear to show the annex.
- Hoodie and denim jacket rebuilt with sleeves and matching villager skins; hood, kangaroo pocket, drawstrings, ribbed cuffs, jacket collar, chest pockets, buttons and seams. Six earned rewards now have distinct GLBs: luminous halo, leafy laurels, ribbon medal, enamel auditor badge, pleated mantle and flame scarf. Both dogs have expressive eyes, ears, tails, tufts and tongues.
- The scene uses the catalog's model mapping even when an older API response supplies an obsolete reward alias. Skinned garments rebind to the live villager skeleton. Reward tinting preserves untargeted gold and enamel details. Auditor Badge now uses the torso slot and chest attachment.
- The house editor exposes architecture for the current progression level and material choices for wall, roof, trim, door and accent. Paint and materials remain independent; cached models are cloned before edits. Missing assets retain the procedural fallback and usable controls.

## Persistence boundary / proposed integrator changes

The allowed paths exclude API code and `packages/contracts/**`. Existing `house_style` and `house_colors` continue through the existing settings API. New choices save in local storage, keyed by user ID, with explicit UI wording that they are saved on this device. They do **not** sync to other browsers or other villagers' devices yet.

Propose optional, nullable fields on settings updates, stored membership settings and villager/profile responses:

```json
{
  "house_variant": {"1":"porch","2":"bay","3":"greenhouse"},
  "house_materials": {"wall":"brick","roof":"metal","trim":"wood","door":"wood","accent":"brass"}
}
```

`house_variant` is a per-level map, keys `1`–`5`; permit only that level's three choices, including `classic`. `house_materials` is a partial object: wall wood/brick/stone; roof shingle/tile/metal; trim wood/stone/metal; door wood/metal; accent ceramic/brass/wood. Missing properties use the style's authored surface. The scene already accepts these optional response fields; the integrator should add the API types, authorization, validation and persistence, then send the fields from the editor and remove the temporary local persistence. Do not silently drop unsupported keys into the current API.

Also refresh the backend catalog seed/projection for the six new reward model URLs and Auditor Badge's torso slot. No new purchasable item IDs, prices, generation jobs, paid calls, or database contract edits were made here. The previously unregistered striped shirt now has its existing rigged GLB linked in the catalog.

## Review and try

- `assets/previews/round2_before_after.png`: twelve same-camera before/after comparisons, including all ten rebuilt designs.
- `assets/previews/house_variants.png`: all sixty variants, labeled by style and level.
- `assets/previews/round2_house_editor.png`: actual editor screenshot.
- `apps/web/public/thumbs/`: all 29 shop/reward thumbnails regenerated, plus 60 variant thumbnails.

From the repository root, run `bun run --cwd apps/web dev` with `VITE_MOCK=1` and `VITE_DEMO_AUTH=1`. Select Iraj, open **My profile → House**, choose a style and architecture, select siding/roof materials, then save. Reload to verify device persistence. Open Shop/Wardrobe to inspect rebuilt items. Inspect other levels through fixture data or the labeled contact sheet; the editor does not grant progression levels.

Everything runs offline from committed GLBs and fixture data. No environment secrets were needed or read.

## Reproduce assets

With Python + Pillow, Bun, and Blender 5.2 installed:

```powershell
python assets/materials/generate.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/round2_008.py
python assets/repack_materials_008.py
python assets/register_008.py
bun run --cwd packages/catalog validate
python assets/catalog.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/shop_preview_007.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/shop_preview_007.py -- --variants
python assets/package_round2_008.py
```

`repack_materials_008.py` normalizes embedded image pixels and material factors without changing geometry/accessor data; it also repairs earlier Blender exports that bake tint into MixRGB textures. Baseline thumbnail inputs are retained in `assets/previews/round2_before/`.

## Validation

Completed commands from the repository root (all exit **0**):

| Command | Result |
| --- | --- |
| `python assets/check_glb.py` | 226 GLBs, zero failures |
| `python assets/test_check_glb.py` | 26 regression tests |
| `python assets/validate_houses_006.py` | 28 original house bounds/material contracts preserved |
| `python assets/validate_shop_007.py` | 16 retained or intentionally replaced model contracts; 29 thumbnails |
| `python assets/validate_round2_008.py` | 60 variants, 10 rebuilt designs, 89 thumbnails; zero failures |
| `bun run --cwd packages/catalog validate` | 228 entries validated; generated catalog refreshed |
| `bun test --cwd packages/catalog` | 23 tests |
| `bun run --cwd apps/web test` | 57 tests; 1,572 assertions, including roof attachment checks on all tower/greenhouse styles at levels 3–5 |
| `bun test --cwd apps/web src/scene/houseOptions.test.ts` | 2 tests; 187 assertions |
| `node apps/web/node_modules/@playwright/test/cli.js test --config assets/round2.playwright.config.ts` | 2 browser tests: actual skin deformation/bind bounds; texture rendering, device persistence and all-models-offline controls |
| `bun run --cwd apps/web build` | TypeScript and Vite production build |

The validator now permits only embedded PNG textures up to 256px, checks references, and retains the original 5,000-triangle house / 3,000-triangle accessory limits. Round-two coverage also checks neutral pixels, explicit garment features, skin weights, independent model mappings, file-size ceilings and all 89 thumbnails. The 007 validator preserves unchanged designs and checks the replacement feature contract for intentionally rebuilt designs.

Measured maxima: variants **3,828 triangles / 532,576 bytes**; rebuilt shop designs **2,500 triangles / 174,024 bytes**. All delivered tiled images are 128px. The complete changed-file inventory is `assets/ASSET_008_FILES.txt`.

Early checks caught triangle overruns, the jacket's transition from rigid accessory to skinned garment, and Blender's baked texture tint. These were corrected before delivery. The production build retains its existing large-chunk advisory.
