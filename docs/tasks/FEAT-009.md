---
id: FEAT-009
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-009 (parallel; integrator resolves conflicts)
allowed_paths: [assets/**, apps/web/public/models/**, packages/catalog/**, apps/web/**, apps/api/**, packages/contracts/api.md]
request: R-43 (Stefanny 14:13) "a little study area in the park … picnic tables … nice and cozy"
---
# FEAT-009 — Cozy study nook in the park

1. **Assets** (conventions + validator, contact sheet): `study_nook` set ≤8k tris total: 2–3 picnic tables with open books,
   laptops, mugs and a small lamp; a shade tree or pergola with string lights (emissive, warm); beanbags or cushions; a
   bookshelf/little free library box; a chalkboard sign "Study Spot"; potted plants and a rug patch. Warm wood plus sage/cream
   palette to match the village.
2. **Placement.** Add it to the registry with a park-district placement hint (always unlocked) and place it in an existing
   empty park lot via the layout (don't collide with the garden or fountain).
3. **Activity.** Add idle activity `studying` (📚 Studying): villagers sit at a free seat at the picnic tables with a
   page-turn/typing micro-motion; several friends who pick it sit together. API: extend the idle_activity CHECK with a new
   migration (suffix `_idle_studying`), update the picker, badge, schedule (WEB-017's destination()) and tests.
4. Ambience: soft light at night; optional quiet lo-fi/page-rustle loop near the nook that respects the sound toggle.
Tests: catalog validate, pytest, unit (seat assignment), e2e (mock: choose Studying → seated at nook), real screenshot
(day + night). Final report per AGENTS.md.
