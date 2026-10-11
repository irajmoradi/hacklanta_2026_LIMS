---
id: FEAT-014
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-014 (parallel; integrator resolves conflicts)
allowed_paths: [apps/api/**, apps/web/**, packages/contracts/api.md]
request: R-76 (Iraj 17:50, docs/refs/r76_colosseum_toggles.png)
---
# FEAT-014 — Colosseum: one view switch, scoring modes, auditor POV

1. **Duplicate controls:** the arena shows both "View open / View current" buttons AND "Open · Current · Mine · Past" tabs. Remove the
   top buttons; the left-rail tabs drive the arena view (Open = gate/waiting view, Current = podium/ranks, Mine = your comps, Past =
   settled with the winner on the podium + confetti). Keep the "N participants · Gate closed" caption bound to the selected banner.
2. **Scoring modes in the terms** (create form + API + display): `scoring` ∈
   - `cumulative` (today's behavior: sum of auditor-confirmed entry points; highest total wins),
   - `scoreboard` (each entry reports a numeric value with a unit set at creation, e.g. "hours", "km", "pages"; the auditor confirms the
     value; a live leaderboard ranks totals; an optional target shows progress bars),
   - `ordinal` (race: first to reach the target/complete wins; ranks by confirmed completion time, ties by earlier submission).
   Migration with suffix `_competition_scoring` (`scoring`, `unit`, `target` columns; default cumulative); validation; settle logic per mode;
   pytest for each; api.md. UI: the create plaque gets a segmented picker with a one-line explainer per mode; banners and the arena HUD show
   the mode chip + unit; the evidence form asks for a value in scoreboard mode.
3. **Auditor POV:** when the current seat is a competition's auditor, the arena switches to an **Auditor booth** view: the camera sits in the
   VIP box; a review queue lists pending entries (evidence thumbnail, claimed value, AI pre-check verdict, submitter), with Approve/Reject +
   points/value edit + reason, keyboard shortcuts (A/R, J/K to navigate); a "You sit out this competition" banner; the fee/payout preview;
   a Settle button when allowed. Contestants see a small "Auditor: <name> is reviewing" indicator. Use the existing decision/settle endpoints.
Tests: pytest (modes, settle), web unit, e2e (create each mode; auditor approves an entry and the leaderboard updates; tab-driven views),
screenshots including the auditor booth. Final report per AGENTS.md.
