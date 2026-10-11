---
id: FEAT-021
owner: codex (gpt-6-astra, high)
branch: feat/FEAT-021
allowed_paths: [apps/api/app/presence.py, apps/api/app/realtime*.py, apps/api/app/main.py, apps/api/tests/**, apps/api/migrations/**, apps/web/src/scene/**, apps/web/src/components/Presence.tsx, apps/web/src/api/**, apps/web/tests/**, packages/contracts/api.md]
---
# FEAT-021 — Live multiplayer movement in town (R-130, owner)

Owner: "Get the things synced of movement and position, so I can see other people walking their character."
Today, town presence is a heartbeat plus `GET /api/villages/{vid}/presence/stream` (presence.py), which carries activity only.
The player can walk their own villager (playerControl: WASD, Shift to run, emotes), but nobody else sees it. Build real-time sync:
1. **Transport:** a village WebSocket `GET /api/villages/{vid}/live` (member-only; demo-seat auth and Auth0 like the other
   endpoints; same handshake style as `/api/houses/{uid}/live`). The client sends `{x, z, heading, moving, running, emote?}`
   at most 10 Hz, only while it changes; the server fans out to the other members of that village. In-memory fan-out per
   API process is fine (one API process in production). No DB write per tick; optionally persist the last position every
   ~5 s for late joiners. Rate-limit and validate (clamp to town bounds, max speed; never trust the client for anything that
   awards XP).
2. **Rendering:** other villagers who are actively walking move to the received positions with smooth interpolation and
   extrapolation (~100 ms buffer) and play the walk/run/emote animation. When they stop or disconnect (>5 s silent) they
   fade back to their normal idle/activity behavior. Their name tags show "walking", and they reuse the existing avatar
   models, crowd LOD and labels (SCALE-001: works with 100 people).
3. **Production path:** Caddy on the VM proxies WebSockets natively to `village-prod-web` → API. Make sure the web server
   config in `ops/deploy` (if needed) forwards `/api/villages/*/live` upgrades; describe any ops change in your report and
   don't edit live servers.
4. Reconnect with backoff; works through the Reconnecting pill; zero cost when nobody is walking.
Tests: API (auth, membership, fan-out, rate limits), web unit tests (interpolation), and a Playwright test with TWO browser
contexts on two seats where seat A walks and seat B sees A move (scratch API + DB via `ops/remote_run.sh --with-api`,
AGENTS.md). Never use the live village. Final report per AGENTS.md, with a short two-window recording.
Coordinate: FEAT-022 (interiors) runs in parallel and reuses your message shape, so put it in `api.md` early and keep it small.
