---
id: FEAT-019
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-019 (START AFTER INTEG-014 lands FEAT-015 on main)
allowed_paths: [apps/api/**, apps/web/**, assets/**, apps/web/public/models/**, apps/web/public/thumbs/**, packages/catalog/**, packages/contracts/api.md]
request: R-105 (Iraj 19:01) "only the owner edits their house interior; a community building everyone can decorate and add custom SAM objects to; multiple floors; the UI is childish and unpolished"
---
# FEAT-019 — Owner-only homes, a shared Community Hall, multiple floors, grown-up interior UI

Builds on FEAT-015 (Tiger-backed interiors + live sync).
1. **Owner-only editing:** remove co-decorate invites; only the house owner can edit their interior (API enforces it). Visitors watch live.
2. **Community Hall:** a new civic building on the plaza (asset ≤12k tris, ASSET-008 materials: warm timber hall, big windows, a stage nook, a gallery
   wall, plants) that **every member can decorate** with the same live editor: furniture, decor, and **custom objects from "Make it real"**
   (the SAM 3 photo → 3D decoration items, CV-006/WEB-025: anyone can place their own photo-made objects here, with the creator shown on hover).
   Per-item ownership: you can move anything, but only the creator (or the village owner) can remove an item. An activity feed line when something
   is added. Rate-limit spammy edits.
3. **Multiple floors:** houses get floors by house level (lv1: 1 floor, lv2–3: 2, lv4–5: 3) and the Hall has 2. A floor switcher (tabs + stairs you
   can click; the camera glides between floors, upper floors fade/cut away), furniture is per floor (`floor` column + migration with suffix `_floors`),
   live sync per floor.
4. **Polish the interior UI (it reads childish now):** a calmer, refined look: natural materials, soft global lighting, wall art, a proper skirting/
   trim, a muted palette matching the house; the editor UI becomes a slim side inventory with categorized thumbnails (custom icon set), a contextual
   mini-toolbar on the selected item (rotate, duplicate, stash), subtle snapping guides, no cartoon emoji, no oversized rounded buttons;
   typography consistent with WEB-026/035. Screenshot review against the town style.
Tests: pytest (owner-only enforcement, hall permissions, creator-only delete, floors), e2e (owner edits; visitor can't; two users decorate the Hall live;
floor switching), latency still ≤250 ms p95 through the public URL. Screenshots + webm. Final report.
