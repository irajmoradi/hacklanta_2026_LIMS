# ASSET-013

19 original procedural wearables: six bottoms, six shoes, seven glasses.
The meshes and rendered thumbnails in this pack are dedicated to **CC0-1.0**.
No external artwork, photos, model providers, paid calls, or secret values are used.

From `apps/web`, generate on the runner:

```
bash ../../ops/remote_run.sh bun test ../../tools/asset013/generate.test.ts
```

The integration test pins Blender 4.3 / NumPy 1.26 and verifies every generated file. It uses no ports or databases.

The wrapper retrieves `tools/asset013/artifacts/{models,thumbs}`. From the root:

```
python tools/asset013/install.py
```

Regenerate and validate the catalog from `apps/web`:

```
bash ../../ops/remote_run.sh bun test ../../tools/asset013/catalog.test.ts
```

Copy the returned `tools/asset013/artifacts/catalog.ts` to
`packages/catalog/dist/catalog.ts`. The preset skeleton is imported from
`villager_base.glb`; no avatar geometry or animations are changed. Each item is
batched into one mesh, with primary/secondary/accent materials (plus undyed skin
for exposed calves or feet). Geometries are cached across avatars; independent
skeletons and materials retain per-avatar animation and palette selection.

Open **Shop > My wardrobe** for owned items and color editing. Bottoms and shoes are independent inventory slots. Overalls, boots and heart
glasses require village level 2 / Fitness Corner (500 collective XP). These use
the existing building dependency and level gate, including mock mode.

`055_lower_body_slots.sql` extends the catalog slot check without changing
existing inventory. Apply ordinary API migrations and catalog synchronization
before using these items against a non-mock API.

The allowed paths exclude the integrator-owned `apps/web/src/api/types.ts` and
profile showcase data. `legacyClientCatalog.ts` is an explicitly temporary
compile-time boundary for that frozen union; it does not transform runtime slots.
The full type remains available through `catalogData` and `entriesById`.
Upstream should add `bottoms | shoes` to `EquipmentSlot`, add those slots to the
profile showcase labels/list, and then remove this adapter. Wardrobe tabs, shop,
equip, coloring, previews and village rendering work within this task's scope.

Validation commands from `apps/web`:

```
bash ../../ops/remote_run.sh bun test src/scene/asset013.test.ts
bash ../../ops/remote_run.sh bun run test
bash ../../ops/remote_run.sh bun run build
bash ../../ops/remote_run.sh bunx playwright test --config tests/asset013.config.ts
```

From `apps/api`:

```
bash ../../ops/remote_run.sh python -m uv run pytest -q tests/test_asset013.py tests/test_catalog_registry.py tests/test_item_colors.py
```

Browser tests force mock mode and write wardrobe screenshots at 1440 and 390 px,
plus idle/walk/sit fit contact sheets, to `apps/web/artifacts/asset013/`.
