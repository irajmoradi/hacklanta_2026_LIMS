---
id: FEAT-026
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-026
allowed_paths: [apps/api/app/inbound*.py, apps/api/app/mayor*.py, apps/api/app/goal_stretch.py, apps/api/app/competitions.py, apps/api/tests/**, apps/imessage/src/**, apps/imessage/test/**, packages/contracts/api.md]
---
# FEAT-026 — iMessage: check in, set weekly goals and enter challenges by text (R-153, owner)

Owner: "I want Photon iMessage to allow me to do a daily check-in, or a weekly goal, or random challenge tasks, not just
normal stuff." Today inbound texts (apps/api/app/inbound.py `command()`, inbound_evidence.py for photos) mostly get a
Mayor chat reply; `processed_checkin` is usually false. Make texting a first-class way to play:
1. **Intent routing** (deterministic keywords first, then a cheap Gemini classification fallback under the existing
   bounded-JSON adapter and SEC-001 caps): `check in: …` / `daily: …` → daily note check-in; `progress: …` → goal-progress
   check-in (attaching any photo as evidence through the existing evidence pipeline + AI pre-check); `goal: …` → set or
   replace this week's goal (same rules as the web: retitle resets status, stretch tiers via `stretch: …`/`go beyond`);
   `challenges` → list open competitions/challenges with short codes; `join <code>` → join (same terms/cost rules;
   SOL intent only); `enter <code>: …` + optional photo → competition entry/evidence; `status` → today's check-in state,
   goal, streak, coins/XP; `help` → a 6-line menu. Natural phrasing ("I ran 5k today", photo attached) should map to the
   right intent via the classifier, which confirms when ambiguous ("Log that as progress on 'Run three times'? reply Y/N").
2. **Same rules as the app:** call the same domain functions (awards, caps, idempotency by message_id, week finalization,
   membership, consent). No new ways to earn more than the web allows.
3. **Replies:** short, in the Mayor's voice (plain, playful), always confirming what was recorded, e.g. "Logged ✅ +10 XP
   +10 coins. Streak: 5 days."
4. Unknown or unlinked numbers keep the invite reply; STOP still works.
Tests: API unit tests per intent (keyword and classifier paths mocked; no real Gemini/Photon calls), idempotency,
evidence-with-photo, and the confirmation flow; plus agent-side parsing tests in apps/imessage. Mock transports only;
never send real texts. Final report per AGENTS.md, with a command table to paste into the Devpost write-up.
