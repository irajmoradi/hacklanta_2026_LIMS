# ASSET-007 — shop art and thumbnails

Branch: `asset/ASSET-007`. Baseline milestone: `fdf000e`.

## Audit and result

The current shop shows 22 non-consumable purchases and seven earned rewards.
The latter reuse five existing meshes with runtime tints. All 29 now have a
transparent 512 x 512 PNG named by **item id**, including the `decor_*` aliases.
Thumbnails use the exported GLBs, orthographic three-quarter cameras, soft key
and rim lights, and transparent shadow catchers. No credentials, paid generation,
real likenesses, or GPU worker are needed.

Worst offenders in the original assets:

| Item | Before | Treatment |
| --- | --- | --- |
| Village Cap | Rectangular slab visor, flat single color | Rounded elliptical visor, sewn crest, neutral vertex shading |
| Dogs | Angular heads/muzzles, box paws, tiny unlit eyes | Smooth rounded heads, soft biscuit palette, beveled paws, eye glints and collar tag |
| Headphones | Raw rectangular cups | Cushioned bevels and earcup grooves; original headband/anchor retained |
| Beanie / cowboy / festival hat | Flat surfaces, little textile detail | Ribbing, stitching, bands, softened edges |
| Crown | Hard triangular points | Beveled edges and attached pearl tips |
| Scarf | Tail appeared disconnected from wrap | Connecting fold and woven stripes |
| Hoodie / denim | Raw pocket/lapel blocks | Rounded pocket edges and subtle seams; existing bind skeleton retained |
| Striped shirt | No registered model; runtime box fallback | New rigged `shirt_stripes.glb` and matching thumbnail; catalog integration below |
| Voice styles | No model or individual art | Sculpted wheel, quill/book, and megaphone cards; display-only GLBs |
| Backyard / lamp / flowers / fountain | Thin angular shapes and hard edges | Rounded fencing/lantern, carrying loop, soft petals, beveled basin |
| ASSET-006 houses | Already detailed and cohesive | Preserved byte-for-byte; included in thumbnail and audit coverage |

The original UI used generic icons for every item. `shop_before.png` is a
model audit at card size, not a screenshot of that icon-only UI. Missing shirt
and voice geometry is explicitly represented by plain proxy blocks in that sheet.
Original GLBs used by the before render are retained in
`previews/shop_baseline_models/`, so the comparison can be reproduced after rebuilding.

16 existing GLBs retain their exact named material sets and all original node
names. Existing authored attachment offsets are unchanged. The largest rebuilt
model is under 3,000 triangles. Neutral `COLOR_0` shading multiplies the original
material colors and remains compatible with runtime tinting. Four additional
GLBs cover the striped shirt and three voice cards. No FEAT-006 ids were added.

Shop and Wardrobe share `ItemThumbnail`; showcase tiles use it too, while custom
photo items keep their photo previews. PNG failure mounts the live GLB through
the existing `OptionalModel`; GLB failure retains simple fallback geometry and
all controls. Cards use the catalog rarity's pastel backdrop. Static images do
not allocate per-card WebGL contexts.

## Review artifacts

- [Before](previews/shop_before.png), [after](previews/shop_after.png), [side by side](previews/shop_before_after.png).
- [All eleven garments/accessories on villager_base](previews/shop_fit.png).
- [Shop UI](previews/shop_ui.png), [Wardrobe UI](previews/shop_wardrobe_ui.png), [live fallback UI](previews/shop_fallback_ui.png).

Fit was inspected on the exported fallback body: hats sit on the hair, glasses
span the eyes, scarf wraps the neck, and garments retain the seven-joint bind rig.
Generated heads still use the existing runtime fitting behavior.

## Reproduce and try

From the repository root, with Blender 5.2 and Python + Pillow:

```powershell
$blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
& $blender --background --python-exit-code 1 --python assets/blender/shop_preview_007.py -- --before
& $blender --background --python-exit-code 1 --python assets/blender/shop_007.py
& $blender --background --python-exit-code 1 --python assets/blender/shop_preview_007.py
& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --shop-fit
python assets/shop_sheet_007.py
python assets/catalog.py
python assets/check_glb.py
python assets/validate_shop_007.py
node apps/web/node_modules/@playwright/test/cli.js test --config assets/shop007.playwright.config.ts
```

The browser test starts its own offline fixture server on port 5187 and saves
the UI screenshots above. For manual use, run `bun run dev` in `apps/web` with
`VITE_MOCK=1` and `VITE_DEMO_AUTH=1`, choose Iraj, then open Shop or My profile →
Wardrobe. Block `/thumbs/hat_cap.png` to try the live-model fallback.

## Validation

All final commands below exited **0**:

| Command | Result |
| --- | --- |
| `python assets/check_glb.py` | 160 GLBs, zero failures |
| `python assets/test_check_glb.py` | 24 regression tests passed |
| `python assets/validate_houses_006.py` | 28 houses; original bounds/materials preserved; zero failures |
| `python assets/validate_shop_007.py` | 16 preserved node/material contracts, neutral vertex colors, 29 RGBA 512px thumbnails |
| `bun run test` (apps/web) | 57 tests passed |
| `bun test src/components/ItemThumbnail.test.tsx` (apps/web) | 1 test, 6 assertions passed; fallback is lazy and a changed URL retries |
| `node apps/web/node_modules/@playwright/test/cli.js test --config assets/shop007.playwright.config.ts` | 2 browser tests passed: all three card surfaces, actual loaded fallback mesh, and purchases with all assets offline |
| `bun run build` (apps/web) | TypeScript + production build passed; existing large-chunk advisory remains |

Initial checks caught and corrected two triangle-budget overruns, a Blender
vertex-color export issue, and hidden imported geometry affecting thumbnail
framing. Browser QA required the project's demo-seat fixture and waiting for image
decoding before screenshots. Use the local Playwright CLI with Node: invoking
`bunx` at the root selected a different Playwright version, and Bun's test worker
stalled; neither is needed by the final command.

## Integration limitation / proposed catalog change

`shirt_stripes` currently has no `asset` in the integrator-owned catalog. This task
cannot edit `packages/catalog/**` or the scene loader. The new thumbnail and live
card fallback work, but equipping it in the village still uses the existing torso
fallback until the integrator links `/models/shirt_stripes.glb`, with
`anchor: villager_base`, zero offset/rotation, scale 1, tint materials `shirt` and
`wall`, and the same skinned/rebind tags as `shirt_hoodie`. No API or DB contract
change is needed. Voice-card GLBs are presentation artifacts and should not be
registered as avatar attachments. No other blockers or contract proposals.
