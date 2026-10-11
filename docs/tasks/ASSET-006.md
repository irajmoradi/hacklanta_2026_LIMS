---
id: ASSET-006
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-006
allowed_paths: [assets/**, apps/web/public/models/**]
request: R-15 (Iraj) "the houses look too similar and their backs aren't detailed, they are boring in the back"
---
# ASSET-006 — Distinct houses with real backs

The camera orbits, so every house side is seen. Current house_lv1..5 (+ _b variants) share one silhouette/palette and have
blank back walls. ASSET-005 is editing packages/catalog/catalog.json in parallel — do NOT edit it; write registry
suggestions to `assets/catalog_additions_006.json` (same fields as earlier additions files).
1. **All four sides detailed** on every house GLB (rebuild house_lv1..5 and _b variants in place, same footprint, origin,
   scale and material names so the scene keeps working): back door + small steps, back windows, a back porch/deck or
   garden bed, downspout, AC unit or woodpile, chimney/vent placement varying; side windows too.
2. **Variety**: 6 distinct architectural styles × levels where sensible — cottage (thatch-ish roof), modern box (flat roof,
   big windows), A-frame cabin, tudor (beams), beach shack (stilts/shutters), brick townhouse — each with 3 tintable palettes
   (named materials `wall`, `roof`, `trim`, `door`, `accent`). Name them `house_<style>_lv<n>.glb`, lv1–3 minimum per style.
   Each ≤5k tris.
3. Suggest in the additions JSON how the scene should pick a style per member (e.g. hash of user id → style, palette;
   level → lv model) so houses look personal and varied.
Validator 0 failures; contact sheet with a front + back render row for every house; CATALOG.md updated. Final report per AGENTS.md.
