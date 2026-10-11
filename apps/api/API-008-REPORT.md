# API-008 final report

Branch: `api/API-008` (assigned current branch).
Implementation: `00d6540`. This report is a subsequent documentation commit.
No push or merge. All changes are under the allowed `apps/api/**` path.

## Delivered

- Idempotent, UTF-8 without BOM migration `007_shop_equipment.sql`: slot and validated
  voice-style metadata, all 22 catalog entries, legacy equipment reconciliation,
  a partial unique index enforcing one equipped item per member/village/slot, and
  triggers deriving inventory slots from catalog metadata. Older migrations/seeds
  that omit slot remain replayable. Ownership, acquisition dates and XP survive.
- New cosmetics with matching GLB stems: hat_cap 25 XP, hat_festival 45,
  hat_headphones 120, glasses_round 35, jacket_denim 90, scarf 30. Existing beanie,
  crown, both dogs, houses and decorations have real asset keys where available.
  Pirate costs 80, Hype coach 150, Shakespearean 500 (aspirational relative to
  demo balances 220–915). No cats/fish or unvetted runtime-generated items.
- Both dogs require the pet_shelter unlock AND backyard ownership on purchase/equip.
  Purchase auto-equips and replaces only the same slot; equip/unequip cost no XP.
  Ownership is retained. All routes operate on the authenticated member only.
- Speaker-specific vetted writing prompts for nudges and explicit voice-line requests.
  SQL checks and a Python enum reject arbitrary styles. No change to TTS models or
  cloning. Unequipped style means no rewrite call. Failed rewrite preserves the
  original text; existing nudge fallback remains available.
- Once-only offline demo outfit upgrade: Lance festival hat + dog; Stefanny earned
  crown + scarf; Iraj glasses + headphones + Hype coach; Maya denim; Dev cap.
  Added outfits are fixture gifts; Stefanny's crown represents the prior finalized
  weekly win. No crown purchase debit. Existing balances/progress are preserved;
  reruns preserve manual outfit changes. Reset remains fixed-demo-village scoped.

## Exact payloads / proposed shared-contract changes

Shared contracts and web files were not edited (outside allowed paths). Integrator
should adopt these HTTP shapes and migration additions in the shared contracts.

`POST /api/villages/{vid}/inventory/equip` and
`POST /api/villages/{vid}/inventory/unequip` both accept exactly:

```json
{"item_id":"hat_festival"}
```

Response is the complete current equipment projection (example after equipping):

```json
{
  "equipped": [
    {"item_id":"hat_festival","slot":"head","asset_key":"hat_festival"}
  ],
  "equipped_ids": ["hat_festival"]
}
```

Unequipping the only item returns `{"equipped":[],"equipped_ids":[]}`. Repeated calls
are safe; no activity or XP is awarded. Missing/unowned item: 404; nonmember: 403;
missing prerequisite: 409; invalid body/extra fields: 422. Equipping replaces the
existing item in that slot atomically; unrelated slots remain equipped.

Every Villager payload now includes these exact `equipped` and `equipped_ids` fields
alongside the existing profile fields. Entries sort by item ID. `slot` is one of
`head|face|torso|neck|pet|house|voice_style|decoration`; `asset_key` is a GLB stem or null.
The old string-list representation is available as `equipped_ids`; consumers that
assume `equipped` is strings must update. This is the task-requested payload change,
not transparent compatibility for clients using the old property name.

`GET /api/villages/{vid}/shop` still returns `items` and `balance`. Exact item example:

```json
{
  "items": [{
    "id":"pet_dog_b",
    "kind":"pet",
    "name":"Shelter Dog",
    "price_xp":100,
    "asset_key":"pet_dog_b",
    "slot":"pet",
    "voice_style":null,
    "requires":"pet_shelter",
    "requires_item":"house_backyard",
    "requires_building":"pet_shelter",
    "owned":false
  }],
  "balance":300
}
```

The real list contains all 22 items. Legacy `requires` continues preferring the
building requirement; clients must use BOTH `requires_item` and `requires_building`.
Voice-style item IDs/enum values are `voice_pirate`/`pirate`,
`voice_shakespearean`/`shakespearean`, `voice_hype_coach`/`hype_coach`;
these have `slot:"voice_style"` and `asset_key:null`.
Buy response stays `{"balance":275,"inventory":[{"item_id":"hat_cap","equipped":true}]}`.

`POST /api/voice/lines` adds an optional village selector:

```json
{
  "user_id":"13370000-0000-4000-8000-000000000001",
  "village_id":"13370000-0000-4000-8000-000000000000",
  "text":"One small win today."
}
```

Response is unchanged: `{id,audio_url,expr_url,job_id}` (UUID strings/nulls and asset
URLs). Both requester and speaker must belong to the selected village. If omitted,
a single shared village is inferred; multiple shared villages retain plain speech
unless the caller selects one. Style follows the speaking villager, not the recipient.
No caller-supplied style or prompt is accepted. Calls remain explicit user actions or
existing authorized scheduler jobs; tests use mocks and demo seeding calls no providers.

## Files changed

Under `apps/api/`:

- `app/catalog.py`, `app/styles.py` (new).
- `app/domain.py`, `app/main.py`, `app/mayor.py`, `app/models.py`, `app/scheduler.py`.
- `migrations/007_shop_equipment.sql` (new).
- `scripts/seed.py`, `scripts/demo_story.py`, `scripts/demo_check.py`.
- `scripts/smoke_api008_http.py` (new); `scripts/smoke_api007_http.py` now permits
  additive route growth while checking its original routes.
- `tests/test_api008.py` (new); `tests/test_api.py`, `tests/test_api007.py`,
  `tests/test_demo_story.py` updated for the intentional contract/prerequisite changes.
- `README.md`, `demo/README.md`, `API-008-REPORT.md`.

## Verification

Commands ran from repository root. Database commands used runtime-only
`$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'`;
existing config loads and normalizes that path. No secrets were copied or printed.

| Command | Exit | Result |
| --- | --- | --- |
| `python -m uv run --directory apps/api pytest -q` | 0 | 141 passed in 67.20s |
| `python -m uv run --directory apps/api ruff check app scripts tests` | 0 | All checks passed |
| `python -m uv run --directory apps/api ruff format --check app scripts tests` | 0 | 46 files formatted |
| `python -m uv run --directory apps/api python scripts/smoke_api008_http.py` | 0 | HTTP health/OpenAPI, DB up, API-008, 49 paths, ephemeral port 58820 |
| `git diff --check` | 0 | Clean |
| `git diff --cached --check` | 0 | Clean before implementation commit |

The full suite includes 133 existing tests and eight new API-008 cases. New coverage:
concurrent equipment changes, slot replacement, ownership/membership/body validation,
database uniqueness, both pet gates on both dogs, prerequisite ownership vs equipment,
style in actual nudge and voice prompts, no-roast preservation, enum rejection,
provider failure with inferred village, all demo outfits, earned crown, existing-story
upgrade, replay after user unequip, migration BOM/replay/collision repair and exact
seed/migration catalog agreement. Existing tests cover transaction rollback, balances,
full-row demo replay, village-scoped reset and global avatar preservation.

Earlier runs exposed a mistaken test seed-number replacement and an incorrect test
assumption about default roast consent; corrected before the final passing suite.
Initial lint findings were fixed. The HTTP smoke is read-only; feature integration
uses ASGI against the isolated test schema in `village_test`. No live development
migration/reset, paid provider, GPU, messaging or transaction call was performed.

Screenshot: not applicable (API-only).

## Teammate trial

1. Set `VILLAGE_ENV_FILE` to the existing external environment and select the intended
   development DB. From repository root run
   `python -m uv run --directory apps/api python scripts/migrate.py`.
2. Run `python -m uv run --directory apps/api python scripts/demo_story.py` to upgrade
   an existing story. Use `--reset` to rebuild only the fixed demo village.
3. Set `DEMO_AUTH=1`, `MAYOR_SCHEDULER=0`, `UVICORN_LOOP=app.runtime:selector_loop` and run
   `python -m uv run --directory apps/api uvicorn app.main:app --host 127.0.0.1 --port 8018`
   on an available port. Header:
   `X-Demo-User: 13370000-0000-4000-8000-000000000001`.
4. Read `/api/villages/13370000-0000-4000-8000-000000000000` and its `/shop` route.
   POST `{"item_id":"hat_headphones"}` to `/inventory/unequip`, then `/inventory/equip`.
   Verify face and voice-style slots survive the head change.
5. Run `python -m uv run --directory apps/api pytest -q tests/test_api008.py` for
   provider-mocked style, migration, requirements and replay examples. Sending a real
   voice request is optional and explicitly invokes configured paid providers.

## Choices and remaining integration work

No implementation blocker. Deployment must apply migration 007 before starting this
API. Web consumers must adopt the payload above; contracts/web updates are outside
this task's allowed paths. Legacy cowboy/hoodie/striped-shirt items retain ownership
and null mesh keys because the asset catalog contains no corresponding GLBs.

The migration resolves old slot collisions by newest acquisition, then descending
item ID on ties. House upgrades continue affecting persistent house_level;
unequipping changes equipment only, not earned progression or backyard ownership.
Both dogs now use the shelter gate per the task's pet-unlock intent. Existing dog
ownership is retained rather than revoked. Demo gifts are intentionally XP-neutral.
