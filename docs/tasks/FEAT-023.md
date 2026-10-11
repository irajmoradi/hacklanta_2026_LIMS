---
id: FEAT-023
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-023
allowed_paths: [apps/api/**, apps/web/src/scene/**, apps/web/src/components/Presence.tsx, apps/web/src/api/**, apps/web/tests/**, packages/contracts/api.md]
---
# FEAT-023 — Server-authoritative overworld: everyone sees the same village, BitCraft style (R-136, owner)

Owner: "it doesn't sync dancing on festival or positions, please try to sync everything about physical overworld, BitCraft
style." Today FEAT-021 (live) relays positions only while a player walks with WASD. Everything else is decided per
client: idle activity schedules (WEB-024), attraction rides and dancing (festival stage, ferris wheel, etc.), café/bench/
study seating (WEB-044), drag-and-drop of a villager onto an attraction, emotes, following. So two people see different
villages. Make the overworld one shared, server-authoritative state, the way BitCraft/SpacetimeDB does it: clients send
*intents* to reducers; the server owns state and broadcasts deltas; every client renders the same thing.
1. **State model (API):** per villager, `avatar_state {mode: idle|walking|attraction|seated|emote|following|home, x, z,
   heading, attraction_id?, slot?, seat_id?, emote?, target_user?, since, until?, seq}`. Keep it in memory in the API
   process, persisted to Postgres on change (new migration, next free number; the integrator renumbers if needed), loaded
   on start. Add a village `world_seq`.
2. **Reducers (validated, idempotent with client request ids):** `move(x,z,heading,moving)` (absorbs FEAT-021's relay),
   `join_attraction(attraction_id)` (picks a free slot server-side; capacity per attraction; rejects locked or closed
   ones), `leave_attraction`, `sit(seat_id)` (one per seat), `emote(kind)`, `follow(user)`, `drop(user, attraction_id)`
   (the drag-drop-onto-attraction action; only on yourself unless the existing rules allow otherwise). Rate limits, bounds,
   speed checks.
3. **Idle autopilot moves to the server:** when a member is idle or offline, a single server tick (≈1 Hz, cheap; only
   while a socket is connected to that village) advances their scheduled idle activity using the existing WEB-024 schedule
   logic, ported or shared, with the same seed, and emits state changes. So everyone sees Lance on the ferris wheel or
   dancing at the festival at the same time. Clients interpolate between states; animations are keyed off `mode` + `since`
   so dancing and rides look in phase on every screen.
4. **Transport:** extend the FEAT-021 village WebSocket: on connect send a full snapshot (`world_seq` + all avatar_state),
   then deltas with `seq`; the client re-syncs on a gap. Presence and Reconnecting behavior stay unchanged.
5. **Client:** VillageScene, Character, attractions, seating and drag-drop must render from the shared state and send
   intents instead of deciding locally. Keep the visuals, LOD and crowd behavior (SCALE-001), the close-up (WEB-044)
   and cinematics.
6. Scale: 100 villagers × a few clients must stay cheap (deltas only; coalesce). No paid calls.
Tests: API reducer tests (capacity, seat conflicts, idempotency, rate limits, tick determinism) and Playwright with two
contexts on two seats against a scratch API: A drops a villager on the festival stage, B sees them dancing in the same slot;
A sits at the café, B sees the same chair; the idle schedule matches on both (`ops/remote_run.sh --with-api`,
AGENTS.md). Never use the live village. Final report per AGENTS.md, with a two-window recording.
