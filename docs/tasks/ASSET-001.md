---
id: ASSET-001
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-001
allowed_paths: [assets/**, apps/web/public/models/**]
---
# ASSET-001 — Modular low-poly village kit via headless Blender

Blender 5.2: `"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python <script>`.
Write reproducible bpy scripts in `assets/blender/` that generate and export GLBs to `apps/web/public/models/`:
house_lv1, house_lv2, house_lv3 (same footprint, progressively bigger/fancier), shop, mayor_stage (music-festival
stage with speakers + bunting — the hackathon theme), tree_a, tree_b, lantern, bench, fence, crater, path_tile, and
cosmetics hat_cap, hat_crown, hat_beanie, pet_dog.
Conventions: meters; glTF +Y up; origin at base center; forward +Z; named materials (roof, wall, trim, accent, ...)
so the web can tint them; each asset under 3k triangles; flat low-poly cozy style with one consistent palette.
Also `assets/blender/chibi_body.py` -> `villager_base.glb`: chibi body with an armature and baked clips idle, walk,
wave, cheer; separately named materials skin, hair, shirt, pants, shoes; head bone named `Head`.
Add `assets/README.md` (conventions + regenerate command) and `assets/check_glb.py` (validate every GLB: triangle count,
material names, animation clips) — run it and report results. Render a preview contact sheet PNG to `assets/previews/`.
Final report per AGENTS.md.
