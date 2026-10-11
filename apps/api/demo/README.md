# Living village pitch fixture

Run from the repository root (PowerShell), with the existing external environment file:

```powershell
$env:VILLAGE_ENV_FILE='/c/Users/mourn/Downloads/hacklanta/.env'
python -m uv run --directory apps/api python scripts/demo_story.py --reset
python -m uv run --directory apps/api python scripts/demo_check.py
```

`--reset` rebuilds only **Hacklanta Crew**, UUID `13370000-0000-4000-8000-000000000000`.
Other villages and all shared users, avatars, jobs, voices, and catalog records survive.
Reset is one database transaction, serialized with the original seed's advisory lock.
It also cleans the demo's hypertable rows, evidence reviews, and durable check-in keys.
The script refuses a differently named village at that UUID. An existing legacy demo
requires the explicit `--reset` flag. With the story installed, a plain run is a strict
database no-op: user progress stays intact. Reset again before a later pitch to refresh dates.
Apply the existing schema/migrations separately if this is a fresh database.

Evidence images are deterministic Pillow mockups, visibly labeled synthetic. Files live
in `apps/api/demo/assets`, inside API-005's allowed paths. The normal API's `ASSET_DIR`
may point elsewhere. To serve **both** these images and existing Dev/avatar assets, use
the optional pitch server on an available port:

```powershell
$env:DEMO_AUTH='1'
$env:UVICORN_LOOP='app.runtime:selector_loop'
python -m uv run --directory apps/api uvicorn scripts.demo_server:create_demo_app --factory --host 127.0.0.1 --port 8015
```

This uses the original API and original asset directory, adds one authenticated route for
the three synthetic demo images, and disables automatic Mayor scheduling for the pitch.
It does not change any environment file or running deployment. Point the web client at
this API to view evidence. Alternatively, the integrator can deploy the generated `evidence/`
subtree into their existing asset storage; API-005 does not write outside its allowed paths.
No existing real-person asset is copied. The current server needs the wrapper or that
integrator deployment before it can serve the new demo evidence.

## Three-minute tour

1. **0:00-0:40:** Meet the five friends. Stefanny has last week's crown, Lance owns a dog
   and backyard, and the failed movie night left a recoverable crater.
2. **0:40-1:20:** Open goals/check-ins. Show the synthetic paintings or notes and Lance's
   suspicious repeated workout screenshot. His held 25 XP has not entered the ledger.
3. **1:20-2:00:** Open last week's finalized rubric: Dev audited; Stefanny earned the
   crown and 100 XP. This week Maya audits and sits out; she still tracks personal study.
4. **2:00-2:30:** Compare Minecraft hours (no stakes) and Study streak (0.01 SOL devnet
   entry intent, 5% auditor fee intent). Show one confirmed and one pending study entry.
5. **2:30-3:00:** Show the active walking challenge and agent log: reasons, simulated model
   provenance, a throttled decision, and decisions to leave people alone.

Use `/docs` and `X-Demo-User: 13370000-0000-4000-8000-000000000001` for Iraj.
The last digit is 2 for Lance, 3 for Stefanny, 4 for Maya, and 5 for Dev.
Read routes: `/api/villages/{vid}`, `/users/{uid}` (goals and check-ins), `/feed`,
`/weekly/current`, `/weekly/{Monday}`, `/competitions`, and `/agent-log`
(village-relative except the first). The village response contains active events;
the feed includes the previous recap and failed event with their bodies.

## Fixture choices

- UTC weeks relative to runtime. Early Monday/Tuesday, multiple progress reports share a
  day so all five villagers still have 2-5 check-ins without inventing future activity.
  Streak variety naturally increases as the week advances.
- Five previous-week goals plus five current goals; 18 current-week check-ins. Maya's goal
  is retained but excluded from awards. Dev sat out last week, avoiding consecutive auditors.
- Starting XP uses explicit `demo_history` ledger entries, then normal goal, review,
  purchase, and weekly-finalization functions calculate all changes. No balance counters.
- Prior assignments, historical timestamps, Mayor events and competition review JSON need
  direct fixture inserts; all paid generation/background review is deliberately bypassed.
  Provenance is labeled `demo-fixture/... (not called)`, never presented as live model output.
- Twelve agent decisions plus five evidence-review entries appear in the agent log. Nudges
  are historical simulated decisions, not deliveries. No outbox messages are enqueued.
- The failed movie-night event retains its historical status. A separate active, zero-XP
  aftermath event keeps its crater visible until repair: the current renderer looks only
  at `active_events`. This is cosmetic; it deducts no XP and downgrades no houses.
- SOL and fee values are intent only. No wallet access, transactions, payments, LLM calls,
  speech generation, or GPU jobs. Dev's manifest rows are never modified or removed.
- Database rollback leaves only harmless, deterministic synthetic image files on disk.

Verification/report: see `API-005-REPORT.md` in this directory.

## API-007 world upgrade

Apply migration 006 before running this version. The first run on an older story adds
world state and links its existing crater aftermath to the failed movie event; subsequent
runs remain strict no-ops. A reset produces **2800 collective lifetime XP, level 4**:
garden, festival lights and pet shelter unlocked, ferris wheel next at 5000 XP.
Purchases do not reduce collective XP. Three new rule-based Mayor announcements bring
the initial agent-decision count to 15; no model call is made.

`GET /api/villages/{vid}` now includes `world`. The initial fog lasts until the owner
completes the active event whose `repairs_event_id` is present, using the existing
`POST /events/{eid}/complete` route and `{ "user_ids": ["<member UUID>"] }`.
This removes the visible crater and restores scheduled weather without rewriting the
original failed event. See `../API-007-REPORT.md` and the API-007 contract proposal for
routes and the required GPU bridge integration for group-photo onboarding.

API-008 adds Lance's festival hat/dog, Stefanny's earned crown/scarf, Iraj's round
glasses/headphones/Hype coach style, Maya's denim jacket, and Dev's cap. Rerun the
story without `--reset` to install these once on an older story. Added outfits are
fixture gifts: balances and competition results are preserved. Later runs preserve
manual equips/unequips. The reset boundary remains the fixed demo village only.
