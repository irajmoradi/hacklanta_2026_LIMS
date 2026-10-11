# Adding Village content

DOCS-003 snapshot note (`77b382b`): the registry now has **105 entries / 101 GLB references**, while `apps/web/public/models` contains **134 GLBs**. The 33 additional event-pack models are not yet cataloged. API catalog/progression/requirements consumers are wired; the current round scene retains hardcoded adapters after the rectangular scene revert. The ARCH-001 counts, tests and remaining-consumer table below are **historical handoff evidence**, not the current integration status. See [overview](overview.md) for current boundaries. The authoring workflow below remains the intended workflow; full model-coverage validation can fail until the uncataloged additions are integrated.

`packages/catalog/catalog.json` owns item names, prices, prerequisites, meshes,
attachments, voice prompts, village thresholds and district hints. It contains
59 entries: all 22 existing shop items plus scene content covering all 53 GLBs.
The three legacy meshless clothes remain valid and use procedural fallbacks.
No generated photos, voice, GPU worker or paid providers are needed.

## Add a hat in three steps

1. Generate a GLB using `assets/blender/festival_kit.py` / `village_kit.py`, or
   drop an original GLB into `apps/web/public/models/hat_sun.glb`. Use glTF meters,
   +Y up, +Z forward; fit to `villager_base` with `assets/blender/preview.py`.
2. Add this entry to the catalog's `entries` array:

   ```json
   {
     "id": "hat_sun", "kind": "clothing", "slot": "head",
     "name": "Sun Hat", "description": "A light hat for garden days.",
     "price_xp": 45, "tags": ["shop"],
     "asset": {
       "glb": "/models/hat_sun.glb",
       "attach": {"bone": "Head", "offset": [0, 0.68, 0],
                  "rotation": [0, 0, 0], "scale": 1}
     }
   }
   ```

3. From the repository root (API Python environment active), validate and sync:

   ```sh
   cd packages/catalog
   bun run validate && cd ../../apps/api && python scripts/sync_catalog.py
   ```

   In Windows PowerShell 5, run these as separate commands and only sync if
   `$LASTEXITCODE` from validation is zero. Commit JSON and generated TypeScript.

## Add a building in three steps

1. Generate or drop in a building GLB, using the same coordinates and local
   original-asset workflow. Keep a procedural scene fallback available.
2. Add an entry with `kind: "building"`, no equipment slot, `price_xp: 0`,
   `tags: ["scene", "unlock"]`, its asset, and `unlock: {"village_level": 7}`.
   In the same JSON file, add its ID and placement to `buildings` (for example
   `{"id":"library","placement":{"district":"park","offset":[2,0,4],"size":3}}`)
   and append `{"level":7,"xp":12000,"buildings":["library"]}` to `levels`.
   New districts also need an origin and jitter in `districts`.
3. Run `bun run validate && python scripts/sync_catalog.py` using the directory
   transitions above. This publishes definitions, never player unlocks. The
   integrator wires the registry's progression and scene adapters below.

## Add an upgrade in three steps

1. Create/drop its GLB, or omit `asset` for a logical upgrade with a fallback.
2. Add a catalog entry with the appropriate kind/slot and `tags: ["shop"]`.
   For example `house_lv4` can use kind/slot `house`, price 600 and
   `requires: ["house_lv3"]`. All prerequisites must exist; cycles are invalid.
   `unlock.village_level` is optional. Voice styles use `voice_style.prompt`.
3. Validate and sync as above. A new house level also needs the integrator to
   remove the existing level-2/3 special case in `domain.purchase`; sync alone
   cannot change that behavior. For now, sync rejects multiple item/building
   prerequisites, unsupported voice enums and level-only shop gates instead of
   silently weakening them. Wire `missing_requirements` to enable those features.

## Coordinate and content choices

- Bone attachments are raw GLB local coordinates: hats `(0,.68,0)`, glasses
  `(0,.25,.31)`, headphones `(0,.20,0)`, scarf `(0,-.165,0)` relative to `Head`;
  denim `(0,-.065,0)` relative to `Spine`. Rotation is XYZ radians; scale is a
  positive scalar. `bone` and `anchor` are mutually exclusive.
- Ground anchors place standalone meshes; the backyard uses a `house` anchor.
  Its offset is `(0,0,-2.3)` from the current scene, versus the asset guide's
  suggested `-2.75`. Scene building `size` is maximum bounding-box extent in
  meters, matching `OptionalModel`; it is distinct from raw attachment scale.
- Existing scene hats are normalized to `.85` at avatar Y `1.65`; the crown is
  `.72` at Y `1.72`. These are procedural-avatar presentation choices, not bone
  offsets. Do not apply them on top of the catalog's raw-rig attachments.
- District origins preserve `worldTypes.ts` and `TownDistricts.tsx`: festival
  `(10,.06,6)`, park `(-7,.06,9)`, lake `(1,.08,13)`, shelter `(-13,.06,3)`.
  Jitter 1.2 is the full X/Z range; seeded placement adds `[-.6,.6)` per axis.
- Building IDs preserve API unlock names: `garden` maps to `garden_plot`,
  `festival_lights` to `string_lights`, `lake_bridge` to `bridge`. Other IDs keep
  existing shop names (such as `decor_flowers` mapping to `flowers_a`).
- All tint names were read from actual GLB materials. Clone materials before
  per-avatar tinting. The fallback `villager_base` uses kind `decoration` with
  `scene`/`avatar` tags because the requested kind enum has no avatar category.
- Alternate houses and environmental props are scene-only, with no invented
  shop prices. `tags: ["shop"]` is the explicit publication switch. Building
  entries cannot use that tag. Rarity is optional; none is invented for old items.

## API and integrator handoff

`catalog_registry.py` validates against the same JSON Schema as Bun. Python asset
checks are opt-in (`load_catalog(model_directory=...)`); a deployed API can work
without the web asset directory. Bun checks all model files at authoring time.
Both sides validate slots, references, cycles, progression and district IDs.
TypeScript types are generated from the schema, not hand-maintained interfaces.

Migration 008 adds `content_entries(id, definition jsonb)` for complete entries
and `content_progression(id, definition jsonb)` for levels/buildings/districts.
The existing `catalog_items` table stays compatible, with its original kind and
slot constraints. The separate definition table avoids exposing free scenery
through `main.py`'s unfiltered shop query. Existing `village_unlocks` rows are
earned player state and must not be seeded by this command.

The synchronous psycopg adapter atomically upserts definitions and shop rows,
inserts IDs before foreign keys, skips unchanged rows, preserves external rows
and ownership, and rejects owned-item slot changes. Caller controls commit.
CLI applies only migration 008, then syncs. Run normal existing migrations first
on a fresh database. The command loads credentials with `Settings.from_env()`
and reports only exception types on failure, never connection strings.

Remaining hardcoded consumers (outside ARCH-001 allowed paths):

| Location | Integrator action |
| --- | --- |
| `apps/api/app/catalog.py`, `scripts/seed.py`, `scripts/demo_story.py` | Replace seed tuples with `load_catalog().legacy_rows()` or call sync after seeding. |
| `apps/api/app/world.py` | Replace thresholds, ordered building slice and upcoming enumeration with registry levels and `unlocked_buildings`. |
| `apps/api/app/domain.py` | Use `missing_requirements`; generalize `house_lv2`/`house_lv3` effects. |
| `apps/api/app/styles.py`, `app/models.py` | Wire vetted registry prompts and extend voice enum only when a style is intentionally supported. |
| `apps/web/src/scene/VillageScene.tsx`, `OptionalModel.tsx` | Consume generated entries and attachments; keep procedural fallback behavior and clone semantics. |
| `apps/web/src/scene/TownDistricts.tsx`, `worldTypes.ts` | Consume district hints and building IDs. Garden/lights/bridge currently render without their API unlock gates. |
| `packages/contracts/schema.sql` | Replayed legacy seed rows remain hardcoded; run sync after migration replay. Integrator may incorporate the two additive content tables. |

Install `packages/catalog/requirements.txt` in the API environment. Adding
`jsonschema>=4.23,<5` to `apps/api/pyproject.toml` and refreshing its lock is an
integrator follow-up because neither is writable in ARCH-001. No HTTP contract
was changed. A future catalog response can join full definitions by ID; do not
expose scene entries as purchasable items. Existing modules were not rewired.

## Verification

From `packages/catalog`: `bun run validate`, `bun test`. From `apps/api` with the
extra requirement installed: `python -m pytest tests/test_catalog_registry.py -q`.
Database tests use the existing fixture's unique schema in `village_test`,
including migration replay, actual upserts, unchanged-row checks, price changes,
ownership preservation, external rows and rollback on database failure.
No UI changed, so there is no new screenshot artifact.

ARCH-001 verification on Windows used the existing Python 3.12 interpreter at
`C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`, with
`PYTHONPATH=C:/Users/mourn/Downloads/hl-arch/packages/catalog/.python-deps` for the
extra dependency and `VILLAGE_ENV_FILE=/c/Users/mourn/Downloads/hacklanta/.env`.
No secret values were printed or copied. Commands and results:

- `bun run validate`: exit 0; 59 entries, 53 model paths; repeated output hashes match.
- `bun test`: exit 0; 14 passed.
- `<api-python> -m pytest tests/test_catalog_registry.py tests/test_api008.py tests/test_api007.py -q`
  from `apps/api`: exit 0; 41 passed.
- `<api-python> scripts/sync_catalog.py --dry-run`: exit 0; 59 definitions, 22 shop rows.
- Final focused rerun: `<api-python> -m pytest tests/test_catalog_registry.py -q`:
  exit 0; 15 passed.
- `bun C:/Users/mourn/Downloads/hacklanta/apps/web/node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target es2022 --module preserve packages/catalog/dist/catalog.ts`:
  exit 0; generated types compile.
- `<api-python> -m ruff check apps/api/app/catalog_registry.py apps/api/scripts/sync_catalog.py apps/api/tests/test_catalog_registry.py`
  from root: exit 0.

Live application data was not synchronized; actual database writes were verified
in isolated test schemas. Run the documented sync command to publish definitions
to a teammate's configured database.
