---
id: ASSET-010
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-010 (BASED ON asset/ASSET-009, which INTEG-005 is merging; the integrator merges 010 after)
allowed_paths: [assets/**, apps/web/public/models/**, apps/web/src/scene/ColosseumScene.tsx, apps/web/src/components/Colosseum*.tsx, apps/web/src/styles.css]
request: R-64 (Iraj 15:37) "make the colosseum look better and more polished"
---
# ASSET-010 — Hero-quality Colosseum

The colosseum is the Compete screen (WEB-028 makes it the whole experience), so it's a hero asset. Rebuild `colosseum.glb`
(≤25k tris, with stands instanced/merged; same origin/scale/anchors/node names the scene uses — check ColosseumScene.tsx):
- **Architecture:** two-tier arcade façade with proper rounded arches, pilasters and a cornice; weathered sandstone (ASSET-008
  material library: stone with subtle variation, worn edges); tiered seating rings with aisles and stairs; a VIP box with a
  canopy and banners; a grand entry gate with a portcullis (node `gate` animatable); a sand floor with rake marks and a few
  props (weapon rack, shields, a training dummy, hay bales); a central podium (1/2/3 steps, nodes `podium_1..3`).
- **Life:** village-colored banners and flags with cloth sway (vertex animation or bone), braziers with emissive fire plus
  flicker nodes, string lights for night, crowd-silhouette cards in the stands (instanced, varied colors, idle bob), confetti
  emitter node.
- **Lighting/ambience in the scene:** warm dusk key light, rim light, soft fog, light dust motes, a god-ray card through the
  arches; a short "doors open" intro (portcullis lifts, banners unfurl) on entering; podium spotlight when a competition is
  selected. Keep 60 fps on a laptop GPU (instancing, no shadow-casting lights except one).
Before/after render `assets/previews/colosseum_before_after.png` + a short webm of the intro. Validator 0 failures, web build
green. Final report per AGENTS.md.
