---
id: FEAT-022
owner: codex (gpt-6-astra, high)
branch: feat/FEAT-022
allowed_paths: [apps/api/app/houses.py, apps/api/tests/**, apps/web/src/components/HouseInterior*.tsx, apps/web/src/components/HouseInterior.css, apps/web/src/components/interior*/**, apps/web/src/scene/interior*.ts, apps/web/src/scene/InteriorAvatars*.tsx, apps/web/tests/**, packages/contracts/api.md]
---
# FEAT-022 — See and walk avatars inside interiors, with stairs (R-131, owner)

Owner: "in interiors have it be so I can see other people's avatars and my own and maybe even be able to move and go upstairs."
House interiors (FEAT-015/019) already have a live WebSocket `/api/houses/{uid}/live` (Tiger LISTEN/NOTIFY), presence and peers
(name, held item, floor), the Community Hall, and floors 0–2. Add people:
1. **Your avatar in the room:** when you go inside (any house you can visit, or the Community Hall), your villager appears at
   the door on the current floor. Walk with WASD/arrows or click-to-move on the floor (simple grid A*; furniture items are
   obstacles). Camera framing stays as today. Keyboard focus must not fight the Decorate editor: walking is off while
   dragging furniture.
2. **Others' avatars:** each peer inside shows as their avatar (existing avatar models; fixture fallback) at their live
   position on their floor, with smooth interpolation, name tag and walk animation. Send position over the existing house
   WebSocket (extend the message with `{x, z, heading, moving, floor}`, at most 10 Hz). Use the same message shape as
   FEAT-021's town sync if it has landed in `api.md`; otherwise define it and note it.
3. **Stairs:** a staircase object per floor (from FEAT-019's floors). Walking onto it (or pressing E near it) moves you to the
   floor above or below with a short fade. The floor tabs follow your avatar's floor, and others see you change floor.
4. Owner-only editing stays as is: visitors can walk but not decorate.
Keep diffs focused. WEB-049 (house undo) and INTEG-017 (WEB-047 pinned previews) are editing HouseInterior.tsx right now, so
put new logic in new files (`InteriorAvatars.tsx`, `interiorWalk.ts`) and keep HouseInterior edits to wiring. Tests: unit
tests (pathing, obstacles, stairs) and Playwright with two contexts (A walks upstairs; B sees A move and change floor) via
`ops/remote_run.sh --with-api` (AGENTS.md); scratch DB only, no live village, and no live Tiger writes (use a scratch schema as
FEAT-019 did). Final report per AGENTS.md, with screenshots and a short recording.
