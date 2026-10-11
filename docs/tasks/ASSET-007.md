---
id: ASSET-007
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-007 (parallel; FEAT-006 adds new outfits in INTEG-002, so don't touch those ids)
allowed_paths: [assets/**, apps/web/public/models/**, apps/web/src/components/**, apps/web/src/styles.css, apps/web/public/thumbs/**]
request: R-47 (Iraj 14:32) "shop models are ugly, make them better"
---
# ASSET-007 — Art pass on shop items + beautiful shop thumbnails

1. **Audit:** render every shop-visible item (kinds clothing, pet, decoration, house add-ons, voice style cards) at shop-card size
   into `assets/previews/shop_before.png`. List the worst offenders (box fallbacks, flat colors, wrong scale, floating parts,
   missing models).
2. **Rebuild** (same ids, file names, attach anchors and material names, so nothing else breaks): give each item a cohesive
   cozy stylized look matching the village and the ASSET-006 houses. Rounded bevels instead of raw boxes; 2–3 tone palettes
   with a subtle gradient/vertex-color AO; a little secondary detail (stitching lines, rims, handles, leaves); correct real-world
   proportions on the villager_base body (hats sit on the head, glasses span the eyes, scarves wrap the neck). Pets: friendlier
   faces (eyes, ears, tails), soft colors. Budgets as before (validator 0 failures).
3. **Thumbnails:** render each item to `apps/web/public/thumbs/<id>.png` (512px, transparent, 3/4 view, soft key light plus rim
   light and a gentle shadow) and make the Shop/Wardrobe/showcase cards use them (fall back to the live model if missing). Cards
   get a soft pastel backdrop by rarity.
4. **After:** `assets/previews/shop_after.png` plus a side-by-side `shop_before_after.png` for owner approval. CATALOG.md updated.
Tests: validator, web unit/e2e for thumbs fallback, build. Final report per AGENTS.md.
