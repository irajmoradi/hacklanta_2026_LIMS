# ASSET-010 — Hero Colosseum

Branch: `asset/ASSET-010`. Implementation milestone: `0ffa4ee`.
The follow-up evidence commit contains this report, reproducible QA, and renders.

## Delivered

`apps/web/public/models/colosseum.glb`: 23,610 rendered-instance triangles,
2.16 MB with embedded shared-library textures and no external resources. Original meter scale, ground origin,
+Y up / +Z entry and podium centers/heights are retained. The facade remains
inside a 22 m envelope. Two rounded arcade tiers, pilasters/cornices, five seating
rings, fifteen stair aisles, VIP loggia/canopy, portcullis, numbered podium,
raked sand, weapon rack/shields, training dummy and hay bales are included.

Animation nodes: `gate` (15 child bars), `banner_*`, `flag_*`, `torch_flame`,
`flicker_*`, 105 `crowd_*` instances and `confetti_emitter` at [0, 4.7, 0].
`podium_1..3`, `sand_floor`, `entry_lintel` and legacy gate-bar names remain.
The emitter is an attachment point for a future celebration trigger; this task
adds no automatic confetti burst or paid generation.

The scene merges immutable geometry by material, including all 70 seating
segments, preserving vertex weathering. Crowd silhouettes use one InstancedMesh
with five colors and a subtle idle bob. Cloth vertices sway; top-edge pivots
unfurl on entry. The portcullis lifts on entering Current and lowers for Open,
preserving the existing invitation/gate-closed semantics. Reduced motion skips
the lift/unfurl and freezes cloth, crowd and flame variation. Emissive braziers,
string lights, dust, soft fog, warm key/cool rim, arch ray cards and a competition
podium spotlight complete the dusk scene. Exactly one light casts shadows.

INTEG-006 replaces the branch-local stand-ins with ASSET-008's shared recipes:
stone for wall/worn/mortar/stone, fabric for accent banners, and the standard
wood, metal, shingle and brass recipes. UVs and vertex weathering survive batching.
The canonical Blender generator exports neutral embedded maps and tint factors.
No secrets, real photos, external services or paid generation were needed.

## Validation (all final commands exited 0)

From repository root unless a working directory is specified:

- Blender 5.2: `blender.exe --background --python-exit-code 1 --python assets/blender/colosseum.py` — rebuilt exported artifact. The initial 26,238-triangle draft failed its budget; flat sand ribbons reduced it to 23,610.
- `python assets/check_glb.py` — **206 GLBs, 0 failures**. Colosseum budget updated from the old 12k limit to the task's 25k limit.
- `python assets/test_check_glb.py` — **28 passed**.
- `python assets/validate_010.py` — anchors, 15-bar gate, 70 stands, 105 unique crowd placements sharing one mesh, cloth, vertex colors and bounds passed.
- In `apps/web`: `bun run build` — green; existing large-chunk advisory remains.
- In `apps/web`: `bun run test` — **69 passed, 0 failed**, 914 assertions.
- `node assets/qa_010.mjs` — desktop/mobile captures, gate lift/closure, 105 instanced spectators, one shadow light, participant evidence and all-GLBs-404 fallback passed; zero page errors.
- In `assets`: `node ../apps/web/node_modules/@playwright/test/cli.js test --config playwright_010.config.ts` — existing Colosseum suite **3 passed, 1 intentionally skipped** (real API test; only mock server is needed).
- `node assets/capture_intro_010.mjs` — 5.5-second entry clip encoded; reduced-motion gate/cloth assertions passed.
- Blender: `blender.exe --background --python-exit-code 1 --python assets/blender/preview_010.py`; `python assets/sheets_010.py` — matched-camera exported-GLB renders and contact sheet. Visually inspected desktop, mobile, comparison and intro frames.

Hardware browser capture: Chromium / ANGLE D3D11 / **RTX 5090**, 1440×1000,
DPR 1. Median **16.7 ms**, p95 **16.8 ms** over 120 frames (~60 fps).
Full arena including four participant avatars: 153 reported render calls,
25,716 reported rendered triangles. Raw metrics are in
`previews/colosseum_browser_qa.json`. Default headless Chromium chose SwiftShader
and measured 83.3 ms; the QA scripts explicitly select D3D11 on this Windows host.
**Laptop GPU performance remains unverified**; the available GPU is desktop-class.
No server/API behavior was changed or live API data mutated.

## Review artifacts

- `assets/previews/colosseum_before_after.png` — matched camera and lighting.
- `assets/previews/colosseum_intro.webm` — 5.5-second warm-cache re-entry intro.
- `assets/previews/colosseum_desktop.png`, `colosseum_mobile.png`, `colosseum_fallback.png`.
- `assets/previews/colosseum_before.png`, `colosseum_after.png` — individual renders.
- `assets/previews/colosseum_browser_qa.json`, `colosseum_motion_qa.json` — observations.

## Try it

In `apps/web`, install with `bun install --frozen-lockfile`, then in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
$env:VITE_DEMO_USER='00000000-0000-4000-8000-000000000001'
bun run dev --port 5184
```

Open http://localhost:5184, choose Iraj if prompted, then **Compete → The
seven-day sprint**. Watch the gate and banners, select a participant, and switch
Open/Current. The GPU worker and API can remain offline. For scripted QA run
`node assets/qa_010.mjs` from root while that server is running. The intro script
uses Playwright's FFmpeg cache on Windows, overridable with `FFMPEG_PATH`.
Python preview composition requires Pillow; render generation requires Blender.

## Changed files / integration

- `apps/web/public/models/colosseum.glb`
- `apps/web/src/scene/ColosseumScene.tsx`
- `apps/web/src/components/Colosseum.tsx` (passes competition-selected spotlight state)
- `assets/blender/colosseum.py`, `assets/blender/preview_010.py`
- `assets/check_glb.py`, `assets/validate_010.py`
- `assets/qa_010.mjs`, `assets/capture_intro_010.mjs`, `assets/playwright_010.config.ts`, `assets/sheets_010.py`
- `assets/COLOSSEUM.md`, `assets/.gitignore`, and the review artifacts listed above.

No proposed contract changes. No implementation blockers. Integration notes:
INTEG-006 has applied the shared material library;
WEB-028 should retain the optional `competitionSelected` prop for the spotlight.
The user-provided untracked `docs/tasks/ASSET-010.md` was left untouched and uncommitted
because it is outside allowed paths. No merge, push, root/config or contract edits.
