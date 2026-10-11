---
id: FEAT-013
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-013 (parallel; integrator resolves conflicts)
allowed_paths: [assets/**, apps/web/public/models/**, apps/web/public/thumbs/**, packages/catalog/**, apps/web/**, apps/api/**, packages/contracts/api.md]
request: R-70 (Stefanny 17:22; sketches docs/refs/r70_farm_store_layout.jpg and docs/refs/r70_shop_layout.jpg — follow them)
---
# FEAT-013 — Walk-in shop interiors (Shop + Farm/Pet Store), more pets

1. **Fence** around the farm animals displayed outside the farm store (ASSET-006 paddock_fence style).
2. **Interiors:** opening the Shop or the Farm Store transitions (≤400 ms dolly through the door, same pre-warm trick as the
   colosseum) into a cozy 3D interior where YOUR villager stands at the counter; the shop UI overlays it. Buying plays your villager
   handing over coins at the checkout with a little bag/box pop and the purchase SFX. Esc/back returns to town.
   - **Clothing shop** (r70_shop_layout.jpg): back-wall shelves with folded tops/hats; a checkout counter with a register and a
     potted plant at the front-left; a hanging rack with outfits; a glass display case of accessories (glasses, scarves, headphones);
     a tall standing mirror on the right; a row of 4 mannequins on the right wearing current shop outfits (live from the catalog;
     rotate the featured set); a door at the front; plus anything that makes it feel like a real boutique: rug, pendant lights, price
     tags, a sale sign, a fitting-room curtain, hat stands, shoe boxes.
   - **Farm/Pet store** (r70_farm_store_layout.jpg): back-wall shelves (feed bags, toys, leashes); a "Pets and stuff" counter at the
     front-left; a pet bed with a cat and a food bowl near it; two pet houses (doghouse + cathouse) labelled "cute pets" / "pets for
     sale" with animals inside; two more "Pets" pens at the back right; hay bales, a duck bath/tub with ducklings, a feed trough,
     a barn-wood wall, a chalkboard price list, string lights.
3. **More pets** (assets ≤1.5k tris, idle anims or bob nodes, thumbnails): cats ×3 (tabby, black, calico), dogs ×2 new breeds
   (corgi exists? reuse/extend: pug, husky), bunny, hamster in a cage. Registry entries (kind pet; dogs + cats can follow you;
   farm animals stay in paddocks), priced in the shop currency on main (coins if INTEG-010 has landed; otherwise XP, and note it
   for the integrator). Pets for sale appear in the store pens and pet houses.
Perf: interiors ≤15k tris each, pre-warmed, 60 fps. Tests: e2e (open shop → interior → buy → checkout animation; farm store pens show
for-sale pets), validator, screenshots of both interiors for review. Final report per AGENTS.md.
