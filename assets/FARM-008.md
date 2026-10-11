# Farm kit — FEAT-008

Original, locally authored procedural geometry. No generated likenesses, textures,
external models, credentials, or paid services. Coordinates follow `assets/README.md`:
metres, glTF +Y up, +Z forward, ground anchor at Y=0.

| Model | Triangles | Limit | Runtime hook |
| --- | ---: | ---: | --- |
| farm_store | 2,310 | 8,000 | Static barn, siding, trim, sign, hay, milk cans |
| goat_kid | 264 | 1,500 | body_bob, head_peck |
| duckling | 150 | 1,500 | body_bob, head_peck, wing_flutter |
| calf | 248 | 1,500 | body_bob, head_peck |
| chicken | 210 | 1,500 | body_bob, head_peck, wing_flutter |
| paddock_fence | 48 | 1,500 | 2-metre rail module |
| pigeon | 150 | 400 | body_bob, head_peck, wing_flutter |

No baked clips: procedural movement uses the named head pivot plus root bob/yaw.
The fountain renderer merges pigeon body geometry once and instances eight bodies
and sixteen small wing meshes in two draw calls, with no shadows. Villager positions
are transformed into fountain-local space for proximity checks. Flight decays back
to walking after visitors leave. Reduced-motion preferences freeze ambient motion.

Regenerate from the repository root in PowerShell:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/farm_kit.py
python assets/register_farm.py
bun run --cwd packages/catalog validate
python assets/check_glb.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python-exit-code 1 --python assets/blender/farm_preview.py
```

Contact sheet: [farm_contact_sheet.png](previews/farm_contact_sheet.png).
Contact-sheet cells normalize models to 2.6m for legibility; browser close-ups are
in `apps/web/test-results/farm-*.png`.

## Placement and economy choices

- Commercial district, level 4 / 2,500 earned village XP, alongside Pet Shelter.
- Paddock: 80 XP, independent permanent `house_addon` slot.
- Chicken 30 XP, duckling 25, goat kid 60, calf 75. Each species has a second
  `_friend` catalog ID using the same original model. Unique item ownership follows
  the existing inventory schema; six total animals per member/village are allowed.
- Farm animals use a multi-item `farm_animal` slot. Dogs retain the exclusive
  following-pet slot. Unequipped farm animals still reserve capacity.
- Paddocks occupy the right side of the existing lot. The house shifts left and
  uses 70% of its ordinary display scale. All six styles and five tiers are checked
  against actual exported GLB bounds. The beach paddock shifts back slightly.
  Fence and house remain inside the +/-5.2m pavement boundary; roads and neighboring
  lots are untouched. Six animals wander within a 2.2 x 7.6m fenced yard.
- The first-animal offer explicitly prices the paddock plus animal before buying.
  Acceptance uses two existing API calls. If the animal purchase fails, the paddock
  remains owned, the offer closes, and balance/inventory reload for a normal retry.
- All new scene objects have procedural fallbacks when GLBs or the GPU worker are
  unavailable. No provider calls are needed to buy or render farm items.
