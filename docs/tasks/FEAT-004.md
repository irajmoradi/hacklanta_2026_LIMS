---
id: FEAT-004
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-004 (parallel; integrator resolves conflicts)
allowed_paths: [apps/api/**, apps/web/**, packages/contracts/api.md]
request: R-34 (Iraj, Discord 13:32) "each of the 4 teammates selects a separate person to try out goals etc., and a debug menu to clear inventory and get XP"
---
# FEAT-004 — Teammate test seats + debug menu

1. **Seats.** First visit (no saved choice) in demo-auth mode shows a "Who are you testing as?" picker with the 5 demo villagers
   (Iraj, Lance, Stefanny, Maya, Mario) with portraits; the choice persists in localStorage per browser and drives `X-Demo-User`.
   Show "Testing as <name> · switch" in the topbar (keep the existing Play-as select but tie it to the same stored choice).
   Show a soft warning if someone else picked the same villager in the last 10 min (API: `POST /demo/seat {user_id}` heartbeat
   stored in memory or a tiny table; `GET /demo/seats`). Goals/check-ins then naturally act as that person.
2. **Debug menu.** Only when env `DEMO_DEBUG=1` on the API AND demo auth is active (never with real auth): a 🐞 button
   (and Ctrl+Shift+D) opening a panel for the current seat: +100 / +500 / +2000 XP (writes xp_ledger with a
   `debug:` source_key + reason), clear my inventory (unequip + delete inventory rows, keep base house), reset my goal/check-ins
   this week, mark my goal done (to test accomplishments), trigger a random Mayor event, toggle festival_night weather,
   reset whole demo village (calls existing `scripts/demo_story.py --reset` logic in-process, confirm dialog). API endpoints
   under `/demo/debug/*`, member-only, 404 when DEMO_DEBUG is off; log each action as an activity event "🐞 debug: …".
   pytest (enabled/disabled, idempotency, scoped to demo village only), web e2e (mock).
3. Document in packages/contracts/api.md and add `DEMO_DEBUG=1` to the run notes (README section in apps/api).
Final report per AGENTS.md.
