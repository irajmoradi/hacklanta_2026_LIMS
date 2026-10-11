---
id: ARCH-002
owner: codex (gpt-6-astra, medium)
branch: arch/ARCH-002
allowed_paths: [apps/api/app/catalog.py, apps/api/app/world.py, apps/api/app/domain.py, apps/api/app/styles.py, apps/api/app/models.py, apps/api/scripts/seed.py, apps/api/scripts/demo_story.py, apps/api/tests/**, packages/catalog/**]
---
# ARCH-002 — Make the API consume the registry everywhere (no hardcoded content left)

Read docs/architecture/content.md ("Remaining hardcoded consumers" table), packages/catalog/README.md,
apps/api/app/catalog_registry.py. The registry is merged; `scripts/sync_catalog.py` now runs at every API start.
API-009 (mayor.py/scheduler.py/newspaper/memory/events_table) and API-010 (social/presence/account/bribes) are running in
parallel — don't edit their files; if you must touch main.py, don't (not in your allowed paths) — report needed changes.

Wire every API row of that table: catalog.py/seed/demo_story use the registry (no duplicate tuples); world.py levels,
thresholds, building order and `upcoming` come from registry `levels`/`buildings`; domain.py uses `missing_requirements` and
generic house-level effects (house_lv1..5 from registry, not just lv2/3); styles.py/models.py voice styles from registry
(enum only for styles the registry marks `supported`). Also merge `assets/catalog_additions.json` from ASSET-003 into
catalog.json when that file exists on main (it may not yet — check `git log main -- assets/catalog_additions.json`).
Prove the promise: add a test that adds a brand-new hat entry to a temp copy of the registry → sync → it's purchasable and
equippable with zero code changes; same for a new building with an unlock level → appears in world.upcoming.
All existing tests must stay green (currently 156). Final report per AGENTS.md.
