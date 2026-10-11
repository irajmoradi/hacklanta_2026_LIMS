---
id: FEAT-025
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-025
allowed_paths: [apps/web/src/components/HouseInterior*.tsx, apps/web/src/components/HouseInterior.css, apps/web/src/components/InteriorAvatars*.tsx, apps/web/src/components/interior*/**, apps/web/src/scene/interior*.ts, apps/web/src/scene/**/*.test.ts, apps/web/tests/**]
---
# FEAT-025 — One connected multi-floor house: stacked floors, real stairs (R-147, owner)

Owner (frustrated): "Can you not just connect the two floors together in one space? Also how is it 'Downstairs' when it
clearly is an upstairs model?" Screenshot: on Floor 2 the room renders alone, with an up-stairs model labelled
"Downstairs". Today each floor is a separate room swapped by floor tabs (FEAT-019/022).
Make the house ONE 3D space:
1. **Stacked floors in one scene (dollhouse cutaway):** render every floor of the house/Community Hall at its real height
   (e.g. 3.2 m apart) in one scene: floor slabs, walls (front/side walls cut away as today so you can see in), furniture
   and avatars on every floor at once. The floor you're on is fully opaque; the floors above it fade or ghost (~25%
   opacity, no pointer hits) so they don't block the view; the floors below stay visible.
2. **One continuous staircase:** a single stair model that physically rises from floor N to floor N+1 through an opening
   cut in the upper slab (the stairwell), the same object seen from both floors. On the lower floor it reads "Upstairs ↑"; on
   the upper floor the top of the same stairs reads "Downstairs ↓", visibly descending through the opening. Never show a
   rising stair labelled "Downstairs".
3. **Walking connects them:** walking onto the stairs climbs smoothly (interpolate y along the steps) and arrives on the
   next floor with no fade or teleport; E near the stairs still works. Others see you climb (positions now carry y/floor;
   reuse the FEAT-022 position message, adding y if needed). The camera eases its target height to your floor.
4. **Floor tabs** remain as shortcuts that move the camera focus (and your avatar to that floor's stair landing).
   Decorating edits the floor in focus; pinned preview, undo and redo (WEB-049/047) keep working.
Keep the FEAT-019 permissions (owner-only home edits; anyone decorates the Hall). Perf: still one canvas, instanced where
possible. Tests: unit tests (stair path y, opening placement, label direction) plus a Playwright two-floor walk with two
contexts (A climbs, B sees A rise), with screenshots of each floor plus a 3/4 cutaway view, via `ops/remote_run.sh`
(AGENTS.md); mock mode only; no live Tiger writes. Final report per AGENTS.md.
