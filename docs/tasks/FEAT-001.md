---
id: FEAT-001
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-001 (parallel with WEB-017/WEB-018; integrator resolves conflicts)
allowed_paths: [apps/api/**, apps/web/**, packages/contracts/api.md]
request: R-21 (Stefanny, Discord #ui 13:15) "does it show if someone has achieved a goal? ... see other people's accomplishments and react with emojis"
---
# FEAT-001 — Accomplishments wall + emoji reactions

Today goals can be marked done (`POST /goals/{gid}/status`) and the feed lists activity, but finished goals aren't celebrated
and nothing can be reacted to.
1. **API.** Migration `apps/api/migrations/0xx_reactions.sql` (pick the next free number AFTER checking; WEB-017 may also add
   one — use a distinct filename suffix `_reactions`): table `reactions(id, village_id, target_kind CHECK in
   ('activity','goal','check_in'), target_id, user_id, emoji, created_at, UNIQUE(target_kind,target_id,user_id,emoji))`.
   Emoji: allow a fixed palette (🎉 🔥 👏 💪 ❤️ 😂 🤯 👑) — reject anything else. Endpoints (members only):
   `POST/DELETE /villages/{vid}/reactions` `{target_kind,target_id,emoji}` (toggle semantics OK), and include
   `reactions: [{emoji,count,mine}]` on feed items and on goals in `/users/{uid}`. Add
   `GET /villages/{vid}/accomplishments?limit=` → completed goals (done) + competition wins + level-ups/badges, newest first,
   with who/what/when + reactions. Goal completion must emit an activity event if it doesn't already. pytest for all of it.
   Document in packages/contracts/api.md (v2 additions).
2. **Web.** An **Accomplishments** view (tab/panel next to the feed) showing everyone's achievements as cards with the
   person's Portrait, the goal title, the date, and a reaction bar (palette above; counts, your own highlighted; optimistic
   toggle). Reaction bars also on feed items and on the goal section of each profile. When a goal is completed, show a
   small celebratory burst over that villager in the 3D scene (brief, non-blocking). Mock mode must support all of it.
Tests: pytest, web unit + e2e (mock), real-mode screenshots. All green. Final report per AGENTS.md.
