---
id: INTEG-016
owner: codex (gpt-6-astra, high)
branch: integ/INTEG-016
allowed_paths: [apps/web/**, apps/api/**, packages/contracts/api.md]
---
# INTEG-016 — Merge WEB-044 (sitting + location close-up) onto current main

`web/WEB-044` (real seated poses on café, study and bench seats; double-click or tap a location to get a camera close-up with
an overlay of who's there; see `apps/web/tests/WEB-044-REPORT.md` on that branch) conflicts with main in App.tsx,
scene/GridTown.tsx and scene/VillageScene.tsx. Main has since gained:
- WEB-045: walking focus and label avatar-overlap;
- SCALE-001: `crowded` prop, CrowdDetail, `data-dense-labels`;
- WEB-043: tree_/detail batching in GridTown;
- FEAT-019: town hall opens the Community Hall ("Enter Community Hall" label);
- FEAT-020: Library opens the reading list (`onReading` prop through VillageScene/GridTown).

In this worktree, `git merge --no-ff web/WEB-044` and resolve every conflict so that ALL behaviors from both sides survive:
- keep main's batching, crowd and walk-focus code, the Community Hall/library handlers and `onReading`;
- add WEB-044's location click (`useLocationClick`), `LocationContext.Provider`, LocationCloseup/LocationPresence, the
  cafe/bench seat assignment and hip-height seating, the `onLocationOpen` prop, and the plaza hit mesh.
Where both sides changed one JSX element or prop list, combine the props. Don't drop features to make it compile.
Owner feedback to address while you're there: the close-up must really zoom in (a framed close shot of the location, much
closer than the overview) and raise quality (full-res textures and the best avatar LOD for people present). WEB-044's
screenshot barely zooms; fix that.
Run typecheck, the full web unit suite, WEB-044's, WEB-045's and FEAT-019's Playwright specs, and a production build via
`ops/remote_run.sh` (AGENTS.md); mock mode only. Commit the merge on `integ/INTEG-016`. Final report per AGENTS.md, with
close-up screenshots before and after the zoom fix.
