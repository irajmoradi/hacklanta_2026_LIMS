---
id: ARCH-003
owner: codex (gpt-6-astra, medium)
branch: arch/ARCH-003
allowed_paths: [apps/api/app/catalog_registry.py, apps/api/scripts/sync_catalog.py, apps/api/tests/test_catalog_registry.py, apps/api/tests/test_arch003.py, packages/catalog/**]
---
# ARCH-003 — Finish the registry: loader limits + ASSET-004 event packs

Read packages/catalog/README.md (ARCH-002 "remaining limitation"), assets/catalog_additions_004.json (ASSET-004: event
packs festival_night/spooky/winter/birthday/movie_night/game_night + weather FX), assets/CATALOG.md.
FIX-001 runs in parallel and may also touch tests/test_catalog_registry.py — keep your changes there minimal and additive.
1. `catalog_registry.py` + sync: accept new voice-style ids, multiple prerequisites, and level-only shop gates (the consumers
   already support them); keep validation strict otherwise.
2. Merge ASSET-004 suggestions into catalog.json: decorations with `event_pack` tags, a new top-level `event_packs` section
   ({id, name, pieces:[ids], weather?, mood}) the Mayor/scene can trigger, weather FX entries. Regenerate dist/catalog.ts,
   `bun run validate` (all GLBs on main must be referenced), `bun test`, API tests for the registry.
3. Prove it: test that a brand-new event pack added to a temp registry copy validates and syncs with zero code changes.
Final report per AGENTS.md.
