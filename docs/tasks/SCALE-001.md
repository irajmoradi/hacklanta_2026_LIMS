---
id: SCALE-001
owner: codex (gpt-6-astra, high)
branch: perf/SCALE-001
allowed_paths: [apps/api/**, apps/web/src/**, apps/web/tests/**, docs/perf/**, packages/contracts/fixtures/**]
---
# SCALE-001 — Can a village hold 100 people? Measure, then fix the bottlenecks (R-114, owner)

Owner: "what if we had 100 different people, could we scale community?" Answer with numbers, then make it work.
1. **Seed a scratch village with 100 villagers** (script under apps/api/scripts or fixtures; fixture avatars, varied goals,
   check-ins, items, houses, competitions, feed history) in a SCRATCH Postgres DB — never the live DB/village.
2. **Measure** API p50/p95 for the hot endpoints (village load, feed, week/review, profile, presence, gazette, competitions)
   and web: initial load time, JS heap, draw calls, fps (town overview + street level) with 5 / 25 / 100 villagers.
   Write `docs/perf/SCALE-001.md` with a table and what breaks first.
3. **Fix the top bottlenecks** you find, e.g.: N+1 queries / missing indexes / unbounded payloads (paginate the feed, slim the
   village payload), town growth (does the rectangular grid allocate 100 lots? extend deterministically without moving existing
   lot ids), avatar rendering (instancing / LOD / impostors far away, cap animated avatars, label culling & decluttering of
   name tags), presence fan-out, the week review / auditor UI and pickers with 100 people (search, virtualized lists),
   leaderboards top-N + "you". Keep 5-person behavior and visuals unchanged.
Coordinate: INTEG-015 (perf pass) touches TownRenderer/VillageScene/OptionalModel and WEB-043 touches layout/trees — avoid
those files where possible; if you must, keep diffs small. New migrations: next free number after the highest in
apps/api/migrations on main (idempotent). Run full API + web suites via `ops/remote_run.sh` (AGENTS.md). No paid calls.
Final report per AGENTS.md with before/after numbers.
