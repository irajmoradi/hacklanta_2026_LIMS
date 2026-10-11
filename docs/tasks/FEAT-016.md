---
id: FEAT-016
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-016 (parallel; integrator resolves conflicts)
allowed_paths: [apps/web/**, apps/api/**, packages/contracts/api.md, assets/**, apps/web/public/models/**]
request: R-86 (Iraj 18:11, sketches docs/refs/r86_checkin_sketch.png + docs/refs/r86_mayor_sketch.png)
---
# FEAT-016 — Cinematic Check-in and Mayor scenes

1. **Check-in = a little scene, not a form first.** Pressing Check in (or C) smoothly zooms the camera to YOUR villager (if they're at home,
   cut to them standing in front of their house, or inside if FEAT-015 interiors exist), soft vignette, town UI fades. Your villager (talking
   pose + voice line in their cloned voice if available, else a soft blip) says in a speech bubble: **"What did I do today?"**. Below it, chunky
   choice buttons: **📝 Daily note**, **🎯 Goal progress** (disabled with a reason if no active goal), **📸 Add proof**, **✕ Not now**. Picking one
   slides in the existing check-in form (kept as is) beside the character. On submit, the character does a cheer emote (FIX-010), XP/coins
   pop above their head, and the camera eases back to town.
2. **Mayor = zoom to the Mayor's pedestal.** Pressing Mayor zooms to the Mayor statue/podium (ASSET-005 Mayor's Plaza). The Mayor (statue
   animates: tips hat, bounce) says **"Mayor I am! What do you want to know?"** (Mayor TTS voice if available), with a dialogue menu like a
   cozy RPG: **🗞️ What's new?** (Gazette headline + this week's story), **🎯 How's the village doing?** (week progress / leaderboard summary),
   **🙏 Make a prayer** (existing prayer flow), **🎲 Play** (the Mayor's game/challenge flow), **💰 Bribe** (existing bribe flow, with its cost in
   coins), **🤫 Rumours** (the Mayor whispers 1–2 playful, non-mean rumours generated from recent village activity via the existing
   Gazette/gossip LLM path, cached per hour; no new paid loop). Choosing an option shows the answer in the Mayor's speech bubble with a
   typewriter effect; sub-flows open their existing panels anchored beside the Mayor. "← Back" returns to the menu; Esc exits to town.
3. Both scenes reuse the colosseum pre-warm + transition pattern (≤350 ms, no frame >50 ms), work on mobile (bubble above, choices
   bottom-sheet), respect reduced motion, and keep keyboard shortcuts (1–6 for choices).
Do NOT trigger disasters or other world events on the live demo village while testing; use mock mode or a test village.
Tests: e2e (check-in scene → daily note submit → back to town; Mayor scene → each option opens the right content), screenshots + webm.
Final report per AGENTS.md.
