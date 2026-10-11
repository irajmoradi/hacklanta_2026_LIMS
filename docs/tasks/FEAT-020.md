---
id: FEAT-020
owner: codex (gpt-6-astra, high)
branch: feat/FEAT-020
allowed_paths: [apps/api/**, apps/web/src/**, apps/web/tests/**, apps/web/package.json, packages/contracts/api.md]
---
# FEAT-020 — Library weekly reading list (R-120, Stefanny)

Teammate: "for the library can we add a list of things we should read weekly and we can check them off once we read them for
XP. idk if that should be in weekly goals or weekly reading goals."
Decision: a **shared weekly reading list in the Library**, separate from the one weekly goal so it doesn't compete with it:
- Any member can add a reading item for this week (title, optional link/author, optional "why"), max ~10 per week. The
  Mayor may suggest 1–2 from recent goals, only on an explicit "Suggest" click (no background LLM loops; cache the result).
- Each person checks items off when read (+5 XP + 5 coins each, durable award key per user/item, max 5 awarded per week),
  with an optional one-line takeaway. Others see who read what (portraits) and can react. Past weeks archived, read-only.
- Opening: click the Library building in town, plus a "Reading list" entry on the dashboard. Styling should feel like a cozy
  library (bookshelves, cards), consistent with the app.
- Feed/accomplishments: "X finished reading Y" event; counts in the weekly review as a small bonus line (not for the crown).
New migration: next free number after the highest in apps/api/migrations on main (idempotent). Add a contract section to api.md.
Tests: API (awards, caps, permissions, idempotency), web unit + Playwright (desktop + 390 px screenshots in
apps/web/artifacts/feat020/) via `ops/remote_run.sh` (AGENTS.md); scratch DB/mock mode only. Final report per AGENTS.md.
