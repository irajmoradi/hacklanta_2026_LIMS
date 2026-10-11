# ASSET-006: houses with four finished sides

The ten `house_lv1..5` and `_b` files are replaced in place. Eighteen additional
GLBs provide cottage, modern box, A-frame, Tudor, beach shack, and brick townhouse
styles at levels 1–3. Everything is procedural, texture-free, local, and static;
there are no API calls, secrets, generated photos, or GPU-worker dependencies.

Every home has front and rear doors, steps and covered decks, rear planting,
an AC unit with grille, a downspout, and windows on both side walls. Roofs use
different silhouettes and chimney/vent locations. Higher levels gain taller
walls, upper windows and lintels. Beach houses stand on exposed posts; A-frame
side windows sit in dormers. Cottage roofs use raised courses suggesting thatch;
Tudors have exposed framing; townhouses have brick joints and stepped gables.

## Integration

`catalog_additions_006.json` contains 18 entries using the earlier additions
format. Its separate `palette_presets` and `selection_suggestion` sections are
integration proposals, not changes to the runtime catalog. Each style has three
explicit palettes targeting `wall`, `roof`, `trim`, `door`, and `accent`.
Clone materials before tinting each member's house. Stable UTF-8 FNV-1a hashing
selects style and palette; clamp house level to 1–3 for the new styles.
Original filenames still support all five existing progression levels.
The four legacy town-house records in `catalog_additions.json` also have their
material inventories refreshed so the existing inventory tests remain accurate.

The new models face glTF +Z with ground at Y=0, meters, origin at the lot center.
The ten replacement GLBs preserve their exact pre-task world-space bounds
(including height) to 0.1 mm; the immutable measurements are in
`house_baseline_006.json`. Their material sets are supersets of the originals,
so existing tint names remain usable. Door surfaces now also have the requested
independent `door` channel. Architecture is fitted to each original envelope;
individual window positions and roof shapes intentionally change. Existing
roof/porch upgrades that assume the old roof slope may need per-style placement.

Reasonable choices: palettes are runtime presets rather than 54 duplicate GLBs;
new style levels 4–5 currently select level 3. Legacy names receive different
style/palette combinations. Zero suggested prices are demo defaults for the
integrator to review. `house_backyard.glb` is a separate fence/doghouse attachment
and is not replaced by this task.

## Reproduce and try

From the repository root (replace `blender` with your executable path):

```powershell
blender --background --python-exit-code 1 --python assets/blender/houses_006.py
python assets/check_glb.py
python assets/validate_houses_006.py
python -m unittest discover -s assets -p test_check_glb.py
blender --background --python-exit-code 1 --python assets/blender/houses_preview_006.py
python assets/package_houses_006.py
```

Run the house generator after any older kit generators, which still author the
old houses. The dedicated validator checks all 28 files, the triangle ceiling,
all required material channels and exterior features, window placement, ground
alignment, and legacy bounds/material compatibility. The repository validator
also checks every other asset. `package_houses_006.py` refreshes only this pack's
catalog rows and writes its separate additions file and contact sheets.

Open `previews/houses_006_contact.png`: each group has a front row and a back row,
four labeled houses per row. Opposite camera corners expose all four sides.
Open `previews/houses_006_palettes.png` for six styles × three palette choices.
Individual full-size views are under `previews/houses_006/`.
The existing web scene picks up replacement files under unchanged URLs; new
style assignment requires the integrator to consume the suggestions. A teammate
can also load any `/models/house_<style>_lv<n>.glb` in their local GLB viewer.
