# ASSET-004 validation report

Branch: `asset/ASSET-004`. Asset/validator milestone: `bbff8a3`.

Delivered 33 GLBs: six event packs (5/5/5/5/4/4 pieces), plus five weather
props. The original 101 GLBs are unchanged. All writes stay in `assets/**`
and `apps/web/public/models/**`. The new files total 1,219,268 bytes; the
largest geometry is snowman at 1,008 triangles, under the 2,000 limit.

Commands below ran from the repository root. `$blender` means
`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`.

| Command | Exit | Result |
| --- | --- | --- |
| `& $blender --background --python-exit-code 1 --python assets/blender/event_kit.py` | 0 | All 33 original procedural models exported |
| `python assets/check_glb.py` | 0 | 134 GLBs; zero failures |
| `python assets/catalog.py` | 0 | Full catalog and 33 ASSET-004 suggestions generated |
| `python assets/test_check_glb.py` | 0 | All 21 tests passed |
| `& $blender --background --python-exit-code 1 --python assets/blender/preview.py -- --events` | 0 | 33 props and party hat fitted on fallback villager |
| `& $blender --background --python-exit-code 1 --python assets/blender/preview.py` | 0 | All 134 assets plus four animation poses rendered |
| `git diff --check` | 0 | No whitespace errors |

New regression checks cover exact inventory/tags/material references, hat
attachment, missing/empty drops node, per-instance 2k budget, ground anchor,
and transparent card export. Existing 15 regression checks remain passing.

Visual QA: `assets/previews/events.png` shows the reimported exported assets
and hat fit. `assets/previews/contact_sheet.png` is the complete kit contact
sheet. Both images were opened and visually inspected: no cropped rows,
recognizable event silhouettes, visible weather cards, and fitted party hat.
These are Blender Cycles CPU renders, not browser screenshots.

Assumptions: event cosmetics cost zero XP and are not shop entries; weather
uses the `weather_fx` grouping tag. All new entries retain kind decoration,
including the head-slot hat as explicitly requested. Lights/neon are painted,
confetti is static, and application code animates the named drops node. Fog
and sun are texture-free alpha-blended double-sided cards. README documents
placement, transparent-material handling, attachment, and rain animation.

Integration issue: registry semantic validation permits head slots only for
clothing. Proposed change: allow head-slot event decorations, or approve
changing party_hat_villager to clothing when importing suggestions. The
catalog registry also needs the new suggestions merged to satisfy its full
GLB coverage check. Registry/contracts are outside allowed paths and unchanged.
No HTTP/DB contract changes or asset-delivery blockers.

An optional Python JSON Schema dependency probe exited 1 because jsonschema
is not installed. No dependencies were installed, and no full registry
validation is claimed. Suggestions were checked by the asset regression
suite and reviewed against the present registry schema and validator.

Teammate trial: run `python assets/check_glb.py` and
`python assets/test_check_glb.py`, open both previews, and load
`/models/cloud_rain.glb` or `/models/projector_screen.glb` through GLTFLoader.
Use `scene.getObjectByName('drops')` for rain. No app code changed, no browser
tests run, no secrets read, and no paid services or GPU worker used.
