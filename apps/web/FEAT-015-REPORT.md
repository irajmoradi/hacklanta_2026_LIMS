# FEAT-015 — shared house interiors

Branch: `feat/FEAT-015`.

Implementation commits:
- `6ae1818` — Tiger transactions, migrations, authenticated reducers, WebSockets, API contracts/tests.
- `5362145` — room editor, procedural furniture/thumbnails, entry integration, reconciliation fixes, reviewed QA artifacts.

## Delivered

House profile → **Go inside**, or drop your own villager at home. The room opens with a camera dolly, exterior colors/material recipes, style details, and day/night windows. The village renderer pauses behind the room. The 29-piece procedural kit includes the requested basic and fun categories, animated fish/disco fixtures, a reward-count display and a frame for an equipped photo item's preview. Furniture meshes use simple primitives: the record player has 124 triangles before optional labels; all pieces are below the 1,500-triangle budget. Thumbnails are deterministic SVGs, regenerated with `python scripts/furniture_thumbnails.py` from `apps/web`.

The embedded furniture shop/inventory supplies free starters, coin purchases, placement and stashing. Editing includes quarter-meter snapping, 15-degree rotation, wall snapping, conservative collision checks, drag previews, keyboard/button undo/redo, co-decorator invitations/revocation and a ten-minute history preview. Visiting is allowed for village members; only the owner and invited editors can mutate the room. Presence includes the visitors' names/portraits and colored movement labels.

Tiger stores room revisions, current furniture, movements, editor grants and expiring presence. Main Postgres remains authoritative for membership, coins and purchased inventory. Row locks serialize edits; transaction-committed LISTEN/NOTIFY drives independent WebSocket subscribers. Snapshots and per-item revisions reconcile optimistic movement. Socket-assigned client IDs prevent acknowledgement confusion between tabs signed into the same account. Drag sends are coalesced at approximately 20 Hz; receivers interpolate positions/rotation. Animation rendering uses demand frames at 25 Hz to avoid an unnecessary continuous background render loop.

Both local and Tiger migrations were applied successfully. Tiger's compressed `house_item_moves` hypertable and `house_activity_hourly` continuous aggregate were verified against the service. Compression starts after seven days. The busy-house endpoint uses the real-time hourly aggregate, with a regular-table query for minimally migrated local test schemas. An unset Tiger URL uses the local pool; a configured Tiger outage does not silently split state between databases.

## Choices and practical limits

- One 8×8-meter cutaway room per owner, with one placed/stashed instance per catalog kind. The chair design serves desk/dining placement; arbitrary duplicate copies are not implemented.
- The furniture shop lives in the interior tray. Purchases are owner-only and idempotent; purchased entitlement commits on main Postgres before a separate Tiger placement transaction.
- Procedural meshes replace downloadable GLBs, keeping the entire kit independent of generated assets and the GPU worker.
- Collision checks use conservative rotated bounding boxes and separate floor/rug/wall/ceiling layers. Some visually close arrangements can be rejected.
- The photo frame selects the first equipped custom item's available preview. Missing previews retain the frame's neutral artwork.
- Undo/redo emits ordinary validated edits; concurrent changes can cause a reversal to be rejected. History is a read-only replay anchored to a server timestamp.
- Presence uses a 60-second lease renewed by a 20-second heartbeat. Reconnection obtains a fresh snapshot; disconnected edits are not queued.

## Validation

API commands ran in `apps/api`, using the existing Python 3.12 executable at `C:/Users/mourn/Downloads/hacklanta/apps/api/.venv/Scripts/python.exe`, with `VILLAGE_ENV_FILE` pointing to the supplied external `.env`. No secret values were printed or copied into source/artifacts.

| Command | Result |
|---|---|
| `python scripts/tiger_migrate.py` | Exit 0; applied local and Tiger schemas/aggregate. |
| `python -m pytest tests/test_feat015.py tests/test_house_colors.py tests/test_house_options.py tests/test_feat007.py -q` | Exit 0; 41 passed. |
| `python -m pytest tests/test_feat015.py -q` after final auth/reconciliation/history changes | Exit 0; 6 passed. Covers reducer permissions, rollback/collisions, ordering, purchases, history, busy houses, two WebSocket clients/client IDs and actual Tiger hypertable/aggregate existence. |
| `python -m ruff check app/houses.py scripts/tiger_migrate.py scripts/feat015_preview.py scripts/measure_house_latency.py tests/test_feat015.py` | Exit 0. |
| `bun run test --timeout 20000` in `apps/web` | Exit 0; 146 passed across 36 files. |
| `bun test src/scene/interior.test.ts` | Exit 0; 4 passed, covering snapping, collision layers/bounds, interpolation and reverse history. |
| `bun run typecheck` | Exit 0. |
| `bun run build` | Exit 0; existing large-chunk warning remains. |
| `bunx playwright test --config playwright.feat015.config.ts` | Exit 0; real pointer drag, owner/neighbor editing, synchronized final positions and mobile overflow checks. |
| Same Playwright command with `FEAT015_BASE_URL` set to the temporary Cloudflare tunnel | Exit 0 on final code; real editor-action-to-observer-animation-frame timing described below. |
| `python scripts/measure_house_latency.py <tunnel URL> <output JSON>` | Exit 0; independent two-WebSocket transport benchmark. |
| `git diff --check` / staged equivalent | Exit 0. |

The first full web run at the default timeout had two timing failures (`retry` and the existing exhaustive paddock geometry test). The full rerun with a 20-second test timeout passed. Early browser iterations exposed a transient-position assertion, background rendering work, mobile sizing and inconsistent latency; fixes and the final runs are recorded above. Pytest reports one existing Starlette/httpx deprecation warning.

## Latency and visual evidence

The final Cloudflare test uses exactly two room sockets. After a real pointer drag and a co-decorator edit, it samples 20 alternating move/undo UI actions, from the sender's button handler through the observer's DOM update and next animation frame. All 20 samples were below 250 ms:

- **Final Cloudflare UI p50: 137 ms; p95: 159 ms.** [Raw samples](artifacts/feat015/latency-tunnel.json).
- Local browser WebSocket-delivery run: p50 89 ms; p95 92 ms. [Samples](artifacts/feat015/latency-local.json). This older probe measures receipt, not the final paint-oriented metric.
- Independent Cloudflare transport: p50 107.29 ms; p95 156.63 ms, 30 samples. [Samples](artifacts/feat015/latency-tunnel-transport-final.json).

Earlier browser runs exceeded the threshold (including p95 358 ms and 1,103 ms). These are retained in [loaded-run samples](artifacts/feat015/latency-tunnel-loaded.json) and [earlier-run samples](artifacts/feat015/latency-tunnel-before-final.json). The Windows headless browser uses SwiftShader; the short successful sample is not a production latency guarantee.

Reviewed screenshots:
- [Owner decorating](artifacts/feat015/decorating-owner.png)
- [Neighbor decorating](artifacts/feat015/decorating-neighbor.png)
- [Mobile room and inventory](artifacts/feat015/decorating-mobile.png)

Reviewed recordings of two people decorating the same room:
- [Owner's view](artifacts/feat015/decorating-owner.webm)
- [Neighbor's view](artifacts/feat015/decorating-neighbor.webm)

## Try it

1. In the API's Python 3.12 environment, set `VILLAGE_ENV_FILE` to the external secrets file and run `python scripts/tiger_migrate.py`.
2. Start the normal API, then `bun run dev` in `apps/web`. Open a house profile → **Go inside** → **Decorate**. Drag furniture; press R or scroll to rotate; use Ctrl+Z/Y or the buttons; stash/place using the tray. The owner can invite another member from the co-decorator picker.
3. Open the same house in a second browser as that member. Observe movement/presence, make another edit and reopen the room to verify persistence.
4. For isolated QA, start `python scripts/feat015_preview.py` from `apps/api`; it creates synthetic local/Tiger schemas and serves port 8015 with provider generation disabled. Start web with `VILLAGE_API_URL=http://127.0.0.1:8015`, `VITE_MOCK=0`, `VITE_DEMO_AUTH=1`, port 5185. Run the dedicated Playwright config. `interior-preview.html?seat=<seed-user-uuid>` is a Vite-only entry using the real API and production room component. Set `FEAT015_RECORD=1` to record new videos.

## Files changed and handoff

- API: `app/houses.py`, `app/config.py`, `app/main.py`, `Dockerfile`, migrations `050_house_interiors.sql` / `051_house_presence.sql`, `scripts/tiger_migrate.py`, `scripts/feat015_preview.py`, `scripts/measure_house_latency.py`, `tests/test_feat015.py`, `tests/conftest.py`.
- Web: `HouseInterior.tsx/.css`, `Furniture.tsx`, `interior.ts/.test.ts`, entry wiring in `App.tsx`, `ProfilePanel.tsx`, `playerControl.ts`, `usePlayerController.ts`; WebSocket proxy/config; test script/config and QA-only preview entry; thumbnail generator, 29 SVGs, reviewed artifacts and scoped scratch ignores.
- Shared: `packages/catalog/furniture.json`, authorized additions to `packages/contracts/api.md`.

No outstanding contract proposal or core acceptance blocker. No branch merge, push, paid generation or Solana transaction was performed. All modified files are within the task's allowed paths.

Automatic approval review rejected recursive cleanup of temporary QA files as blocked by policy, without a more specific reason. Those scratch captures remain ignored and uncommitted; only reviewed deliverables were committed.
