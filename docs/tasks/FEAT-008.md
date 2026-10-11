---
id: FEAT-008
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-008 (parallel; integrator resolves conflicts)
allowed_paths: [assets/**, apps/web/public/models/**, packages/catalog/**, apps/web/**, apps/api/**, packages/contracts/api.md]
request: R-41 (Stefanny 14:10 farm-animal store + house paddock), R-42 (pigeons at the fountain)
---
# FEAT-008 — Farm store, house paddocks, fountain pigeons

1. **Assets** (assets/ conventions, validator 0 failures, contact sheet): `farm_store` building (farmhouse vibe: red barn
   siding, white trim, hay bales, milk cans, a wooden sign, ≤8k tris); baby animals ≤1.5k tris each with simple idle clips
   or nodes for procedural bob: `goat_kid`, `duckling` (or `duck`), `calf`, `chicken`, plus `paddock_fence` (modular) and
   `pigeon` (≤400 tris).
2. **Registry + economy.** New pet kind `farm_animal` (not followable; only dogs follow). Each animal costs coins/XP
   (whatever the shop currency is at merge time) and requires the `farm_store` building unlocked plus a new house add-on
   `house_paddock` (auto-offered: buying the first farm animal prompts "Add a paddock to your house (X)"). Place `farm_store`
   in a sensible district via placement hints; unlock via village building XP like the pet shelter. API: owning several
   animals is allowed (cap 6); pytest + api.md.
3. **Scene.** Houses with `house_paddock` get a fenced side yard (style-aware placement next to the house lot, not overlapping
   roads or neighbors) where the owned animals wander, peck and graze with gentle idle motion. The farm store gets a few display
   animals. Pigeons: 6–10 instanced pigeons walk, peck and flutter around the fountain plaza, scatter briefly when a villager
   walks through, then return. Cheap: instancing, no shadows.
4. Shop: a **Farm Store** tab/section with farmhouse styling. The lock reasons (WEB-021) explain the paddock and unlock
   requirements.
Tests: catalog validate, pytest, web unit (paddock placement no-overlap), e2e (mock buy chicken → paddock appears), real
screenshots. Final report per AGENTS.md.
