---
id: ASSET-005
owner: codex (gpt-6-astra, medium)
branch: asset/ASSET-005
allowed_paths: [assets/**, apps/web/public/models/**, packages/catalog/**]
request: R-14 (Iraj) "The festival stage and mayor thing is too similar, make models different"
---
# ASSET-005 — Make the Mayor's spot unmistakably different from the festival stage

Today both read as "wooden stage with speakers + bunting" (`mayor_stage` vs the festival `stage_lights`/stage set).
Look at assets/previews/contact_sheet.png and the scene (apps/web/src/scene — read only) to see how each is placed.
Design a distinct **Mayor's Plaza** set, civic and cozy, not concert-like:
- `mayor_podium`: a small round civic gazebo/bandstand with a domed roof, a lectern with a scroll/gavel, a flagpole,
  a little bell, stone base + steps; palette: stone grey/white + deep green + brass (no speakers, no bunting, no truss).
- `mayor_statue`: a friendly whimsical statue of "the Mayor" (top hat, round belly, scroll) on a plinth — the AI Mayor's icon.
- `notice_board`: a village bulletin board (where the Gazette is "posted").
- Keep the festival set loud/concert-like (truss, speakers, neon) — optionally add `festival_main_stage` with a bigger arch +
  LED screen panel + crowd barriers so the contrast is obvious.
Same conventions/validator (≤6k tris each); update contact sheet, CATALOG.md, and add/adjust registry entries in
packages/catalog/catalog.json (with placement hints: `mayor_podium`+`mayor_statue`+`notice_board` in the central plaza district,
festival set in the festival district) and run `bun run validate`. Include a side-by-side render (Mayor plaza vs festival stage).
The integrator will switch the scene to the new models after merge. Final report per AGENTS.md.
