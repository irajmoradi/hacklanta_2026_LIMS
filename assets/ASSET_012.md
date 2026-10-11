# ASSET-012 delivery: cafe patio

Branch: `asset/ASSET-012`. Implementation milestone: `03c1814`. Routing and visual
QA milestone: `80d2ff8`. This report is committed separately. No push or merge.

Original deterministic Blender geometry produces `cafe_patio.glb`: **5,831
triangles**, three round bistro tables, six chairs, three sage/cream striped
parasols, two wooden flower/herb planters, a lettered A-frame menu, six coffee
cups, three pastry plates, a leaning bicycle, and 17 emissive bulbs on three
posts. ASSET-008 wood, fabric, ceramic, stone and metal recipes have embedded
textures; the sage, cream and copper palette complements ASSET-011's cafe.

The scene mounts the patio as a child of `unlocked:storefront_cafe`, at local
`[0,0,4.6]`. The storefront is normalized to size 7 and moved back 1.5 metres
within its existing lot. The patio's full footprint is x +/-4.775 and z
2.75..6.45 in lot metres. No town grid, street generation, district allocation,
building GLB or contract changed. Road-clearance tests cover six curved-layout
seeds and equivalent 21-metre rectangular lots for WEB-033 integration.

Drag the owned villager onto the cafe highlight to sit and sip for the existing
120-second interaction duration. Six shared seat anchors align geometry,
drop targets, facing and navigation; walking paths avoid table tops and planter
borders. The avatar uses the existing sit pose, a moving cup and sipping arm.
WASD and the existing timeout resume normal control. Closed or unavailable
cafes do not accept visits. Missing assets retain procedural seating and cups.

The existing ten-minute idle cycle reserves 60 seconds for cafe visits, grouped
by six consecutive house slots so up to 60 addresses have distinct scheduled
seats within a cycle. Mayor gatherings and festival events retain precedence;
normal idle preferences resume afterward. This is a scene hangout, not a new
API `IdleActivity` setting. Travel and event overrides can reduce actual seated
time below the scheduled 10%. The six-seat patio is intended for the friend-group
scale; more than 60 addresses or a manual visitor can share a scheduled seat.

The registry entry is a decoration with no independent lot placement, no shop
tag and `source: earned:village_progression`; it is not sold. No provider calls,
secrets, generated people, API services or GPU worker were needed.

## Review and try

- `assets/previews/cafe_patio_contact.png`: four views rendered from the actual GLB.
- `assets/previews/cafe_patio_day.png`: actual web scene after dragging Iraj onto the cafe.
- `assets/previews/cafe_patio_night.png`: same scene with night bulbs and warm local light.
- `assets/previews/cafe_patio_fallback.png`: all `/models/**` requests return 404; drag-to-sip still works.
- `assets/previews/cafe_patio_browser_qa.json`: attachment, pose, emission and browser-error evidence.
- `apps/web/public/thumbs/cafe_patio.png`: catalog thumbnail.

All four screenshot/contact artifacts were visually inspected. From `apps/web`,
install with `bun install --frozen-lockfile`, then run
`$env:VITE_MOCK='1'; bun run dev --port 5197`. Choose a demo seat, find the sage
cafe, hold your villager and drag onto **Sit and sip at cafe**. Zoom in to inspect
the seating. Use Debug menu, enter a reason, and **Toggle festival night** to
inspect the lights. No external service credentials are required for this demo.

## Validation

Commands below were actually run; final results have exit code **0** unless noted.

| Command (root unless cwd noted) | Result |
| --- | --- |
| Blender 5.2 `--background --python-exit-code 1 --python assets/blender/cafe_patio_012.py` | GLB exported; 5,831 triangles |
| Blender 5.2 `--background --python-exit-code 1 --python assets/blender/preview_012.py` | Four Cycles renders |
| `python assets/sheets_012.py` | Contact sheet and thumbnail |
| `python assets/validate_012.py` | Geometry, PBR, embedded textures, registry and browser artifacts; zero failures |
| `python assets/check_glb.py` | 293 GLBs; zero failures |
| `python assets/test_check_glb.py` | 30 passed |
| `bun run validate` (packages/catalog) | 301 entries; generated catalog refreshed |
| `bun test` (packages/catalog) | 46 passed, 263 assertions |
| `bun run typecheck` (apps/web) | Passed |
| `bun run build` (apps/web) | Production build passed; existing large-chunk advisory |
| `bun run test` (apps/web) | 142 passed across 35 files |
| `bun test src/scene/layout/cafeSeats.test.ts src/scene/playerControl.test.ts src/scene/layout/town.test.ts` (apps/web) | Final routing change: 25 passed, 156,342 assertions |
| `node assets/qa_012.mjs` | Actual browser drag-to-sip, cafe child attachment, night emission and all-GLB-404 fallback; zero page errors |
| `git diff --check` | Clean |

The default web test script predates this task's new test file; run the explicit
cafe test command as well. Browser QA uses synthetic mock state and software
WebGL, with camera framing only in the QA script. Set `PATIO_QA_URL` to use a
different local Vite port. Blender executable used:
`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`.

Intermediate checks caught and resolved an 8,031-triangle first export, a
Windows text-encoding round trip in the catalog, and the obsolete all-day-home
schedule assertion. An initial typecheck required installing the web app's
existing nested pot dependencies; `npm ci --prefix src/components/pot
--install-links --no-audit --no-fund` completed successfully with no manifest
changes. One heavily loaded test run timed out in the existing paddock test;
its focused rerun and the final full suite passed. The acceptance validator's
material comparison now tolerates glTF float32 rounding. Port 5186 was occupied,
so browser QA used 5197. These are resolved local issues, not delivery blockers.

Full file inventory: `assets/ASSET_012_FILES.txt`. All committed changes stay in
the task's allowed paths. **Blockers: none. Proposed contract changes: none.**
