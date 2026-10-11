---
id: FEAT-005
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-005 (parallel; integrator resolves conflicts)
allowed_paths: [apps/web/**, assets/**, apps/web/public/models/**, packages/catalog/**]
request: R-35 (Iraj, Discord 13:43; hand sketch at docs/refs/colosseum_sketch.jpg — read it)
---
# FEAT-005 — Competitions become a Colosseum

Iraj's sketch (docs/refs/colosseum_sketch.jpg): a "View competitions" panel lists Comp 1, Comp 2…; choosing one takes you
**fast** (≤400 ms transition) to a separate 3D map, a stylized colosseum with ambience. Only people in that competition stand
in the stands/arena. Clicking a person zooms the camera in on them and shows their progress: evidence items with ✓ verified /
✗ rejected / pending, plus team % of team (team mode) or current ranking (ordinal mode).
Data comes from the existing API (apps/api/app/competitions.py: list, get /{cid}, join, entries, decision, settle;
see packages/contracts/api.md and CompetitionsPanel.tsx). Read only; no API changes. Propose any missing fields in the report.
1. **Asset.** `colosseum` GLB (≤12k tris, assets/ conventions + validator): stylized low-poly arena, tiered stone stands,
   arches, banners in village colors, torches/braziers (emissive), sand floor, a central podium with 3 steps (1/2/3), entry gate.
   Add it to the registry (kind building, not placed in town) + contact-sheet render.
2. **Two entry views** (buttons in the colosseum HUD):
   - **View open:** competitions you can still join. The arena gate is closed, and the people who joined stand outside it as
     avatars. Terms card (rules, dates, mode, auditor, fee/stake in XP, devnet SOL pot if any). An ominous **Join** button with
     cost: dark-red glow, drum-hit SFX via the existing SFX system, a confirm that states the cost, then the existing join endpoint.
   - **View current:** active competitions. Participants are on the arena floor or podium, placed by rank (top 3 on podium steps),
     with floating rank badges; leaderboard rail on the side.
3. **Click a person:** the camera dollies in, and a side card shows Portrait, name, rank or team %, an evidence list (thumbnail,
   date, ✓ verified / ✗ rejected / ⏳ pending, auditor note). Owners/auditors see Approve/Reject on pending entries, wired to the
   existing decision endpoint. Esc/back zooms out; "Back to village" returns to town with the camera restored.
4. **Ambience:** dusk lighting, torch flicker, light dust particles, crowd-murmur loop (respect the sound toggle).
   Must run at 60 fps on a laptop: instance the stands, no shadows on torches.
Mock-mode fixtures for open and current competitions (ordinal + team). Tests: unit (rank placement, team %),
e2e (open → join confirm; current → click person → evidence card), real-mode screenshots. Final report per AGENTS.md.
