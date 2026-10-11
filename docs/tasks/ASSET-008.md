---
id: ASSET-008
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-008 (BASED ON asset/ASSET-007, not main; INTEG-003 is merging 007 now, and the integrator will merge 008 after it)
allowed_paths: [assets/**, apps/web/public/models/**, apps/web/public/thumbs/**, packages/catalog/**, apps/web/src/scene/**, apps/web/src/components/HouseEditor*.tsx]
request: R-47 round 2 + R-56 (Iraj 14:51) "all pastel coloring and no other materials? different options for each house level?"
---
# ASSET-008 — Real materials + per-level house options + rebuild the weak shop items

1. **Materials, not just pastel flat colors.** Build a small shared material library (assets/materials): painted wood with grain
   (procedural vertex-color streaks or a tiny tiling texture ≤256px, embedded), brick, stone, shingles, metal (metalness 0.6–0.9),
   glass (transmission/low roughness), fabric/knit (normal-ish via geometry ribs), leather, gold/brass, ceramic. Apply them across
   houses (ASSET-006 styles), shop items and decorations, so wood looks like wood, metal shines and glass reflects. Keep
   tintable material names (wall/roof/trim/door/accent; primary/secondary/accent) working with the color editors.
2. **Per-level house options (R-56):** for each style × level, offer 2–3 variants (e.g. lv2: porch vs balcony vs bay window;
   lv3: tower vs dormers vs greenhouse annex) plus a material choice per part (siding: wood/brick/stone; roof: shingle/tile/metal).
   Registry entries + `house_variant` and `house_materials` options that the House editor (WEB-020) exposes as picks per level.
   Coordinate field names with the existing house_style/house_colors API: add the new fields only if needed (propose them in
   the report; integrator-owned contracts).
3. **Rebuild the weak shop items from scratch:** hoodie (sleeves, hood, kangaroo pocket, drawstrings), denim jacket (collar,
   sleeves, buttons, stitching), halo (thin glowing ring, emissive), laurel wreath (leaves), Mayor's medal (ribbon + gold disc),
   auditor badge, champion mantle (cape with clasp), streak flame scarf (flame trim). Pets with more character (ears, tails,
   expressive eyes, fur tufts).
Validator 0 failures, budgets respected; before/after sheet `assets/previews/round2_before_after.png` plus a house variants sheet
`assets/previews/house_variants.png`; regenerate thumbnails. Tests + final report per AGENTS.md.
