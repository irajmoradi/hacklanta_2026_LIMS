---
id: ASSET-002
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-002
allowed_paths: [assets/**, apps/web/public/models/**]
---
# ASSET-002 — Grow the kit: festival grounds, landmarks, outfits (headless Blender)

Read assets/README.md, assets/VALIDATION.md and the existing scripts (ASSET-001). Same conventions (meters, +Y up,
origin base-center, forward +Z, named tintable materials, flat low-poly cozy palette, validator must pass).
Hackathon theme is **Music Festival** — lean into it while staying cozy.

New GLBs (≤3k tris each unless noted, ≤8k for landmarks):
- Festival: `stage_lights` (truss + 4 lamp heads as separate named nodes `lamp_0..3` for animation), `food_truck`,
  `ferris_wheel` (wheel as separate node `wheel` for rotation, ≤8k), `tent_merch`, `speaker_stack`, `string_lights`
  (a straight 10 m segment), `banner_flag`, `picnic_table`, `hay_bale`.
- Landmarks/unlocks: `pet_shelter`, `fountain` (node `water`), `lake_patch` (flat organic water mesh, material `water`),
  `bridge`, `well`, `garden_plot`, `campfire` (node `fire`), `mailbox`, `signpost`.
- Houses: `house_lv1_b`, `house_lv2_b`, `house_lv3_b` alternates (same footprint as lv1..3), `house_backyard`
  (fence + doghouse add-on that sits behind a house).
- Nature: `rock_a`, `rock_b`, `bush_a`, `flowers_a`, `tree_c` (blossom), `mushroom_cluster`.
- Cosmetics (fit villager_base Head/torso): `hat_festival` (bucket hat), `hat_headphones`, `glasses_round`,
  `jacket_denim` (torso overlay, material `jacket`), `scarf`; pets: `pet_dog_b` (another breed). (No cats/fish — product rule.)
- Ambient: `bird` (node `wing_l`/`wing_r`), `butterfly`.
Update the contact sheet + validator (all files, 0 failures) and a `assets/CATALOG.md` table (name, tris, nodes, intended use).
Final report per AGENTS.md.
