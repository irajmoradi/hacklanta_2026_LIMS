---
id: ARCH-001
owner: codex (gpt-6-astra, medium)
branch: arch/ARCH-001
allowed_paths: [packages/catalog/**, apps/api/app/catalog_registry.py, apps/api/scripts/sync_catalog.py, apps/api/tests/test_catalog_registry.py, apps/api/migrations/008_*.sql, docs/architecture/content.md]
---
# ARCH-001 — One data-driven content registry (items, outfits, buildings, unlocks)

Owner requirement: "modular architecture so adding more upgrades, items and clothes is easy". Today content is spread
across API seed code (catalog rows, unlock thresholds in apps/api/app/world.py / demo), web code (attachment offsets,
which GLB to use) and assets. Make ONE source of truth.

1. `packages/catalog/catalog.json` + `catalog.schema.json` (JSON Schema) + `packages/catalog/README.md`:
   entries `{id, kind: clothing|pet|house|decoration|voice_style|building, slot?, name, description, price_xp,
   requires?: [ids], unlock?: {village_level}, asset?: {glb, attach: {bone|anchor, offset:[x,y,z], rotation:[x,y,z],
   scale}, tint_materials?: [names]}, voice_style?: {prompt}, rarity?, tags?}`; also `buildings`/`levels` sections
   (level thresholds + which buildings unlock, district placement hints for the scene).
   Populate it from everything that exists today (read apps/api/app/*.py catalog/unlock data, assets/CATALOG.md,
   apps/web/src/scene/* attachment numbers). Include every GLB in apps/web/public/models with a sensible entry.
2. `packages/catalog/validate.ts` (bun): validates schema, unique ids, `requires` targets exist, referenced GLBs exist,
   slot rules; `bun run validate` must pass. Also emits `packages/catalog/dist/catalog.ts` (typed, for the web) and
   `dist/catalog.py`? — no: Python reads the JSON directly.
3. API side: `apps/api/app/catalog_registry.py` loads/validates the JSON; `scripts/sync_catalog.py` upserts
   `catalog_items` (+ any unlock table) from it idempotently (additive migration 008 if new columns are needed, e.g.
   slot/attach jsonb/description/rarity). Do NOT rewrite existing API modules beyond what the loader needs — if
   world.py/shop code hardcodes values, add a small adapter and list the remaining hardcoded spots in your report
   (the integrator will wire them). Tests: registry validation, idempotent sync, requires resolution.
4. `docs/architecture/content.md`: "How to add a hat / a building / an upgrade in 3 steps" (GLB via assets/blender
   script or drop-in → one catalog entry → `bun run validate && python scripts/sync_catalog.py`).
Do not touch apps/web (another agent is editing it). Final report per AGENTS.md.
