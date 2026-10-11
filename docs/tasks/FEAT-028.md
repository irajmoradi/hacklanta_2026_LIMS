---
id: FEAT-028
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-028
allowed_paths: [apps/api/**, apps/web/src/**, apps/web/tests/**, packages/contracts/api.md, packages/contracts/schema.sql]
---
# FEAT-028 — Mayor-chosen disaster repair tasks with visible reasoning (R-176, owner)

Owner (Iraj): "The disaster doesn't always require just check-ins but custom options for tasks people can do, like hanging
out together, right? It's the Mayor's choice. Maybe in the demo you have the LLM robot show its thinking, then decide the
options."
Today `apps/api/app/disasters.py` repairs only by check-ins (`target_checkins = people*2`, `target_people`).
1. **Repair plans chosen by the Gemini Mayor:** when a disaster starts, the Mayor (existing Gemini adapter, cheapest model,
   validated JSON, OpenRouter fallback, deterministic fallback when offline) picks 2–3 repair tasks from a validated menu
   and sets targets, e.g. `hangout` (2+ villagers in one evidence photo, or co-located check-ins within an hour),
   `checkins` (current behaviour), `workout_together`, `study_session`, `cook_together`, `call_a_friend`, `help_a_neighbor`.
   Tasks fit the disaster theme (scorch → "rebuild together", outbreak → "walk the pets together", blackout → "a candle-lit
   game night", blight → "garden day"). Server validates kinds/targets/bounds; the Mayor never invents rewards.
   Store the plan plus a short **public reasoning summary** (2–4 sentences: why these tasks for this group, based on recent
   activity) in the disaster payload and the agent log. Progress: evidence check-ins tagged with a task (and approved where
   evidence review exists) advance that task; the disaster is repaired when all tasks hit target. Keep old disasters (check-in
   only) working. Migration if needed: the next free number, idempotent, folded into schema.sql.
2. **UI:** the disaster banner/panel lists the tasks with progress and a "Why the Mayor chose these" expander; the check-in
   flow lets you tag which repair task your evidence is for. Plain voice (COPY-001).
3. **Demo Lab (Disasters & repair scene, sandbox):** a "Ask the Mayor" button that shows the Mayor "thinking" (a streamed
   step-by-step reasoning summary: reads the group's recent activity → considers options → picks tasks, with the model name),
   then the chosen tasks appear and "simulate" buttons advance each one to the repair reveal. Use a real Gemini call only
   on that explicit click, through a stateless, rate-limited API endpoint that writes nothing (SEC-001 caps); offline or capped
   → a canned, labelled example plan.
**Safety:** never start disasters or Mayor events on the live village (:8010 / prod); tests use mocked LLM + scratch DB.
Tests: API (plan validation/bounds, fallback, progress per task, legacy check-in disasters, the Lab endpoint writes nothing and
is capped), web unit tests, Playwright for the banner + Lab scene at 1440/390 via `ops/remote_run.sh`. Final report per AGENTS.md.
