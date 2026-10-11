# ASSET-006 validation

Validated on 2026-10-10 with Python 3.13 and Blender 5.2.2 LTS.

| Command | Exit | Result |
| --- | ---: | --- |
| `blender --background --python assets/blender/houses_006.py` | 0 | Built 28 houses; follow-up townhouse/A-frame fixes regenerated with `--python-exit-code 1` and `-- --townhouse-only` / `-- --aframe-only`, both exit 0 |
| `python assets/check_glb.py` | 0 | 152 GLBs checked, 0 failures |
| `python assets/validate_houses_006.py` | 0 | 28 houses; all original bounds/materials preserved; all required exterior features present; 6 styles × 3 palettes |
| `python -m unittest discover -s assets -p test_check_glb.py` | 0 | 21 tests passed |
| `blender --background --python-exit-code 1 --python assets/blender/houses_preview_006.py` | 0 | 56 front/back views plus 18 palette views; final A-frame views refreshed with `-- --aframe-only`, exit 0 |
| `python assets/package_houses_006.py` | 0 | Catalog, registry suggestions, contact sheets assembled |
| `git diff --check` | 0 | No whitespace errors |

The dedicated house validator measures world-space geometry rather than assuming
unbaked node transforms. Replacements match the original six bounding extents to
0.1 mm, preserve all prior material names, and introduce the independent `door`
tint. House triangle counts range from 1,030 to 3,088 (limit 5,000).
The general validator now knows the entire 28-house inventory, five required
tint channels, and the task's explicit 5,000-triangle ceiling.

Visual QA: inspected `previews/houses_006_contact.png` and
`previews/houses_006_palettes.png`, plus full-resolution rear views. Opposite
camera corners show front/right and back/left. Fixed an occluded A-frame dormer
window, protruding interior wall, and downspout that extended above the slope.
Re-rendered and inspected the corrected A-frame. All rear entrances, planting,
steps, AC units and side glazing are visible. These are renders of exported
GLBs, not generator-only geometry. They are asset QA images, not browser UI
screenshots; application source is outside the task's allowed paths.

No blockers or contract changes. Runtime catalog and member-style assignment
remain the integrator's responsibility; the requested proposal is in
`catalog_additions_006.json`. Palette presets avoid duplicate GLBs; levels 4–5
map to style level 3. Existing geometry-specific roof upgrades need review for
new slopes. Full usage and regeneration instructions: `HOUSES_006.md`.
