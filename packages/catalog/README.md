# Village content registry

ASSET-009 brings the registry to 218 entries covering 206 GLBs. Nature entries
have `nature` tags, optional `scatter` metadata (`surface`, `hint`, relative
`weight`, `clearance_m`) and three `asset.variants` with named material colors
and uniform scale. These additive fields are schema-validated and included in
generated types. See [nature integration](../../assets/NATURE_009.md) for weighted
selection, ground/water placement and batching. The 22-item shop and existing
building progression are preserved; layout consumers opt into the new metadata.

Edit `catalog.json`. Its 142 entries preserve the 22 existing shop items and cover
all 138 shipped GLBs, including the fallback villager. `catalog.schema.json` is the
shared JSON Schema 2020-12 contract. Neither generated TypeScript nor database
rows are authoring sources. Python reads JSON directly; no generated Python file.

ASSET-005 adds `mayor_podium`, `mayor_statue`, `notice_board`, and
`festival_main_stage` as scene-only decorations. Their descriptions and
`district_central_plaza` / `district_festival` tags are placement hints for the
integrator, not automatic layout instructions or new progression unlocks.
See `assets/README.md` for actual-scale assembly offsets and render commands.

```sh
cd packages/catalog
bun install --frozen-lockfile
bun run validate
bun test
```

Validation checks schema, IDs, acyclic/existing requirements, equipment slots,
level/building consistency, districts, local asset paths, missing GLBs and GLBs
without entries. Successful validation deterministically emits the committed
`dist/catalog.ts`, including types, `catalog` and `entriesById`. Import these from
the web when the integrator wires the scene. Validation performs no network or
provider calls. Installation downloads development dependencies once.

The Python adapter needs the existing API dependencies plus:

```sh
python -m pip install -r packages/catalog/requirements.txt
cd apps/api
python scripts/sync_catalog.py --dry-run
python scripts/sync_catalog.py
python -m pytest tests/test_catalog_registry.py -q
```

Use the API's Python 3.12 environment. `VILLAGE_ENV_FILE` points to the shared env;
the existing settings loader reads it only for an actual sync. Do not copy it.
An actual sync requires the existing contract schema and migrations through 007;
it applies additive migration 008 and synchronizes everything in one transaction.
`--dry-run` validates legacy compatibility without a database or credentials.

Only entries tagged `shop` are copied to `catalog_items`. Other entries stay in
`content_entries`; world definitions live in `content_progression`. Sync never
grants village unlocks, modifies inventory, removes old content, or spends XP.
Unchanged rows avoid writes. Slot changes for owned items are rejected.
Retiring content requires a separate reviewed migration; removing JSON alone
does not remove persisted definitions or shop rows.

`CatalogRegistry` provides `legacy_rows()`, `progression(xp)`,
`unlocked_buildings(level)`, `resolve_requires(id)` and
`missing_requirements(id, owned=..., unlocked=..., village_level=...)`.
Requires arrays mean **all** prerequisites, and resolution is transitive.
Buildings use village unlock state; other entries use ownership.

The API now consumes registry rows for seeds, registered levels and building order
for world growth/upcoming, and full transitive requirements for purchase/equip.
Runtime world and shop gates read the synced definitions, falling back to repository
content before the content store is seeded. House entries named `house_lvN` update
the owner's house level monotonically; other house items remain cosmetics. New
levels 4 and 5 need only catalog entries, prices and prerequisites.

Voice prompts and `VoiceStyle` come from repository entries whose
`voice_style.supported` is explicitly `true`; omitted/false excludes the style.
The three existing styles are marked supported. Restart the API after changing
supported styles. Database content and user text cannot introduce model instructions.

The legacy sync adapter accepts multiple item/building prerequisites, independent
level gates and unpurchasable prerequisites. Its nine-column projection includes
only the first purchasable item and first building; `content_entries` retains every
requirement and level gate for the consumers. Non-shop prerequisite IDs cannot
populate the legacy foreign key and are enforced from the full definition.

New voice IDs with `voice_style.supported: true` pass the loader and projection.
Unsupported shop voices are rejected. **Database publication of new voice IDs is
still blocked** by the integrator-owned `catalog_items_voice_style_check` in
`packages/contracts/schema.sql` and `apps/api/migrations/007_shop_equipment.sql`.
The integrator must replace that three-value allowlist with an extensible check
(e.g. identifier syntax), migrate existing databases, and update migration replay
so it cannot restore the old constraint. Registry support remains explicit and
API enums/prompts still come only from vetted repository content after restart.
ARCH-003 does not bypass or mutate this out-of-scope database contract. Its tests
prove both acceptance by the adapter and atomic rollback on the database blocker.

Verify the new-content workflow from `apps/api` with
`python -m pytest tests/test_arch002.py -q`. It writes a temporary catalog,
syncs into an isolated test database, buys/equips a new meshless hat, and verifies
multiple new buildings at a new unlock level without changing API code. It also
covers house levels 4/5, transitive and multiple prerequisites, village-level
gates, and supported/unsupported voice styles. See also
[content authoring and integration](../../docs/architecture/content.md) for asset
authoring; its remaining-consumer table predates this integration.

## ASSET-003 integration decisions

All 48 suggestions from `assets/catalog_additions.json` at main commit `8b55bd7`
are incorporated: 46 new entries plus meshes for the existing cowboy hat and
hoodie. Existing shop names, prices, slots and prerequisites are preserved.
New entries are scene-only because the asset producer calls prices/slots
suggestions, and `shop` is the registry's explicit publication switch. Houses
4/5 can become purchasable by adding `shop` and their desired prerequisites.
The integration test does exactly that without changing application code.

Unscheduled buildings remain scene decorations until an unlock level and
placement are chosen. Unsupported legs/feet/back/wrist equipment and custom
world/pet/house-upgrade slots are represented as scene decorations, with original
kind/slot retained in `source_kind_*` / `source_slot_*` tags. Bone/anchor attachment
data and tint materials remain intact. Hyphenated source rig tags use underscores
to meet the existing schema. No unsupported inventory slots are published.

This branch only imports registry metadata; merge ASSET-003's GLBs separately.
To validate against another checkout containing those assets, set
`VILLAGE_CATALOG_MODEL_DIR` to its `apps/web/public/models` directory before running
`bun run validate`, `bun test`, or the API tests. The default remains this checkout's
model directory; missing assets still fail authoring validation. API runtime
validation stays headless and requires no generated assets or GPU service.

Durable prerequisite building grants satisfy the corresponding redundant item
level gate, preserving older player unlocks even when their current XP is lower.
Independent or higher item level gates still require village progression.

Validation for ARCH-002 used an ignored `.validation-models/` snapshot of all
101 GLBs from commit `8b55bd7`, selected with `VILLAGE_CATALOG_MODEL_DIR`.
The shared main worktree gained newer ASSET-004 models while tests were running;
those are outside this import and correctly fail the uncataloged-asset check.
Use the ASSET-003 snapshot to reproduce this branch's asset validation, or merge
the newer asset catalog before validating a checkout containing the newer GLBs.

Final ARCH-002 verification (all exit 0):

- From `apps/api`, `python -m pytest -q`: **161 passed** (156 existing plus five new).
- From `packages/catalog`, `bun run validate`: **105 entries / 101 GLBs**;
  `bun test`: **14 passed**.
- From `apps/api`, `python scripts/sync_catalog.py --dry-run`: **105 definitions,
  22 shop rows**, no live publication.
- From root, `python -m ruff check apps/api/app/catalog.py apps/api/app/domain.py
  apps/api/app/models.py apps/api/app/styles.py apps/api/app/world.py
  apps/api/scripts/seed.py apps/api/scripts/demo_story.py apps/api/tests/test_arch002.py
  apps/api/tests/test_catalog_registry.py apps/api/tests/test_api008.py`: clean.
- `bun C:/Users/mourn/Downloads/hacklanta/apps/web/node_modules/typescript/bin/tsc
  --noEmit --skipLibCheck --target es2022 --module preserve packages/catalog/dist/catalog.ts`:
  generated types compile. `git diff --check`: clean.

Python was `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`.
`VILLAGE_ENV_FILE` pointed to the shared root env at runtime; no values were copied.
`VILLAGE_CATALOG_MODEL_DIR` pointed to this checkout's `packages/catalog/.validation-models`.
Database tests used isolated schemas in `village_test`, with mocked providers.
No UI files changed; no screenshot is applicable.

## ASSET-004 / ARCH-003 integration

All 33 suggestions in `assets/catalog_additions_004.json` are included, bringing
coverage to 138 entries / 134 GLBs. They remain scene-only, preserving the 22-item
shop. The party hat remains a decoration with its Head bone attachment intact;
its inconsistent suggested `head` slot is recorded as `source_slot_head`.

The optional top-level `event_packs` array defines `{id, name, pieces, weather?,
mood}`. Six packs ship: `festival_night`, `spooky`, `winter`, `birthday`,
`movie_night`, `game_night`. Pieces must resolve to decorations tagged `event_pack`;
IDs are unique, piece lists are nonempty and unique, unknown fields fail validation.
`mood` is an extensible identifier. Optional weather uses existing contract values
(`clear`, `rain`, `fog`, `festival_night`); winter deliberately omits weather because
snow is not supported. Missing weather means leave the current weather unchanged.
The five decorations tagged `weather_fx` retain their authored GLBs and attachment
metadata. Mood and pack definitions are content for future scene/Mayor selection;
this registry task does not add a trigger endpoint or change those consumers.

Python exposes `registry.event_packs` by ID; generated TypeScript exports the
`EventPack` type and `catalog.event_packs`. Sync stores packs alongside levels,
buildings and districts in `content_progression.definition`, transactionally and
idempotently. An old registry without packs is valid and publishes an empty pack
list. A pack never grants unlocks or creates free shop items.

To author new content, add scene decorations with `event_pack` tags and a pack
referencing their IDs; no pack-name allowlist or code edit is needed. Run:

```sh
cd packages/catalog
bun run validate
bun test
cd ../../apps/api
python scripts/sync_catalog.py --catalog /path/to/catalog.json --dry-run
python -m pytest tests/test_catalog_registry.py tests/test_arch003.py tests/test_arch002.py -q --tb=no
```

After review, omit `--dry-run` to publish to the configured database. Read secrets
from `VILLAGE_ENV_FILE` at runtime. `test_arch003.py` writes a new meshless piece and
pack to a temporary registry, validates through the CLI, syncs into an isolated
schema in `village_test`, reads back the exact definitions and checks idempotence.
It also covers richer prerequisite publication and the remaining voice DB blocker.

### ARCH-003 verification

Python: `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`.
No model-directory override was needed; this checkout contains all 134 GLBs.
DB tests loaded the shared env at runtime and used isolated `village_test` schemas.
No live content publication or paid provider generation was performed.

- `bun install --frozen-lockfile` (catalog): exit 0.
- `bun run validate` (catalog): exit 0, 138 entries, generated types deterministic.
- `bun test` (catalog): exit 0, 23 passed.
- `python -m pytest tests/test_catalog_registry.py tests/test_arch003.py tests/test_arch002.py -q --tb=no`
  (API): exit 0, 34 passed.
- `python scripts/sync_catalog.py --dry-run` (API): exit 0,
  138 entries / 22 shop items / six event packs.
- `python -m ruff check apps/api/app/catalog_registry.py apps/api/scripts/sync_catalog.py apps/api/tests/test_catalog_registry.py apps/api/tests/test_arch003.py`
  (root): exit 0.
- `bun C:/Users/mourn/Downloads/hacklanta/apps/web/node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target es2022 --module preserve packages/catalog/dist/catalog.ts`
  (root): exit 0.
- `git diff --check`: exit 0. An explicit comparison of registry paths with
  `git ls-tree -r --name-only main apps/web/public/models` found all 134 GLBs referenced.
- `python -m pytest -q --tb=no` (API): exit 1, 213 passed / six failed.
  The six failures also reproduce (exit 1) when loading the parent commit's
  `catalog_registry.py` into the test process in memory, without editing the worktree:
  `test_api004.py::test_scheduler_ignores_qa_and_no_human_activity` (two calls vs one),
  `test_api006.py::test_conversation_context_and_prayer` (Mayor fallback),
  `test_api009_http.py::test_temporary_http` (60 routes vs 54),
  `test_v2.py::test_event_awards_once_and_goal_status` (zero event XP),
  `test_v2.py::test_scheduler_limits_consent_roast_and_idle` (no outbox rows), and
  `test_v2.py::test_scheduler_event_cooldown_and_none` (no event row).
  These consumer/test files are outside ARCH-003's allowed paths.

No UI changed; screenshots are not applicable. The remaining contract proposal is
an extensible voice-style constraint and replay-safe migration, as described above.
