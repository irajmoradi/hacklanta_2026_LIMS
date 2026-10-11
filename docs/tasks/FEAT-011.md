---
id: FEAT-011
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-011 (parallel)
allowed_paths: [apps/imessage/**, apps/api/**, packages/contracts/api.md]
request: R-55 (Iraj 14:52) "via iMessage let me ask what competitions/goals I have, and send evidence and images via iMessage"
---
# FEAT-011 — iMessage: ask about goals/competitions, send evidence photos

Inbound iMessages already reach `POST /internal/inbound {phone_e164, text}` (maps phone → user; "checkin: …" makes a check-in;
otherwise Mayor chat). Extend it:
1. **Questions, answered from real data** (not LLM guesses): "what are my goals" / "my goal", "competitions" / "what am I in",
   "standings" / "rank", "XP" / "level", "streak", "help". Use intent detection: cheap keyword rules first, then fall back to a
   small LLM classifier through the existing provider (mocked in tests). Replies are short, friendly and Mayor-voiced, with
   real numbers: goal title/status/progress count, competitions with rank or team %, days left, XP/level/streak.
2. **Evidence via iMessage:** when an inbound message has image attachments (the Spectrum inbound payload; see how
   apps/imessage receives messages), the agent downloads each image (≤10 MB, image/* only), uploads it to a new internal
   endpoint `POST /internal/inbound/evidence` (service-auth; multipart image + phone + optional caption), and the API:
   - if the user is in exactly one active competition that needs evidence → creates a competition entry; if several, replies
     with a numbered list and waits for "1"/"2" (keep a short pending state per phone, 10 min);
   - otherwise attaches it to a goal-progress check-in on their active goal (caption = body), triggering the existing AI
     evidence review;
   - replies with what happened ("📸 Logged as evidence for 'Run 20 miles' — the auditor will review it").
   Images are also accepted with "checkin: …" text.
3. Safety: only registered phone → user mappings; ignore unknown numbers (polite "join the village first" reply); size/type
   limits; no PII in logs.
Tests: pytest (intents, evidence routing, pending choice, unknown phone), agent unit tests (attachment download/upload, mocked
Spectrum). Final report per AGENTS.md, plus how to try it from a phone.
