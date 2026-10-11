---
id: FEAT-015
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-015 (parallel; integrator resolves conflicts)
allowed_paths: [apps/api/**, apps/web/**, assets/**, apps/web/public/models/**, apps/web/public/thumbs/**, packages/catalog/**, packages/contracts/api.md]
request: R-83 (Iraj 18:04) "integrate TigerData; view inside our own houses; move furniture + fun decorations; positions tracked via Tiger, BitCraft-inspired, fast updates for others in the house"
---
# FEAT-015 — House interiors with live, shared furniture (Tiger Cloud real-time)

**Tiger Cloud:** a dedicated service `village-realtime` (free shared tier, TimescaleDB) exists. Its connection string is in the root `.env` as
`TIGER_DATABASE_URL` (do NOT print or copy it anywhere; load via env like other secrets). The main app DB stays the local Postgres. Tiger
holds the real-time house state + movement history. If `TIGER_DATABASE_URL` is unset (tests/CI), fall back to the local DB with the same schema.
1. **Interiors:** opening your house (house click → "Go inside", or drag your villager onto your door) dollies into a cozy interior shell per
   house style (ASSET-006/008 styles; walls/floor use your exterior palette + materials), with windows that show the time of day. Furniture
   kit (assets ≤1.5k tris each, thumbnails): sofa, armchair, coffee table, bed, desk + chair, bookshelf, floor lamp, rug ×2, plant ×3,
   wall art ×3, TV/console, kitchen counter, fridge, dining table + chairs, record player, pet bed, plus "fun" decor: disco ball, arcade
   cabinet, fish tank (animated fish), lava lamp, neon sign, trophy shelf (shows your earned rewards), photo frame (shows your photo items).
   Starter set free; extras in the shop (coins).
2. **Edit mode:** a floor grid with snapping (0.25 m), drag to move, R/scroll to rotate (15° steps), wall items snap to walls, collision
   prevents overlaps, a ghost preview while dragging, undo/redo (Ctrl+Z/Y), an inventory tray to place/stash items. Only the owner (and
   members the owner invites to "co-decorate") can edit; everyone in the village can visit and watch.
3. **BitCraft/SpacetimeDB-inspired real-time sync:** server-authoritative "reducers" (`move_item`, `rotate_item`, `place_item`,
   `stash_item`) validate and apply edits in one transaction on Tiger, then publish. Clients **subscribe** to a house over a WebSocket
   (`/api/houses/{uid}/live`): an initial snapshot, then deltas. Delivery = Postgres `LISTEN/NOTIFY` on Tiger (channel per house) fanned out by the
   API to subscribers. While dragging, the client sends coalesced moves at ~20 Hz (interpolated on the receivers), with optimistic local
   application and reconciliation on server acks (seq numbers, last-writer-wins per item with server ordering). Presence: avatars of
   visitors in the room (their villager stands inside) and a colored "X is moving the sofa" cursor.
4. **Timescale:** `house_item_moves` is a **hypertable** (time, house_id, item_id, user_id, x, z, rot, action) with a compression policy
   (≥7 days) and a continuous aggregate `house_activity_hourly` (moves per house per hour) for a "busy houses" widget; current positions live
   in `house_items` (regular table). A "history scrubber" in edit mode replays the last 10 minutes of moves.
5. API endpoints + api.md; migrations applied to BOTH the local DB and Tiger (a small `apps/api/scripts/tiger_migrate.py` using the env URL).
Tests: pytest (reducers, auth, ordering, notify fan-out with two websocket clients, hypertable exists), web unit (snapping, collisions,
interpolation), e2e (two browser contexts in the same house: A drags the sofa → B sees it move within 250 ms). Measure p50/p95 end-to-end
move latency through the Cloudflare tunnel and report it. Screenshots + a webm of two people decorating. Final report per AGENTS.md.
