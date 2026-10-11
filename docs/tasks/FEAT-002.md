---
id: FEAT-002
owner: codex (gpt-6-astra, medium)
branch: feat/FEAT-002 (parallel; integrator resolves conflicts)
allowed_paths: [apps/api/**, apps/web/**, apps/imessage/**, packages/contracts/api.md, packages/catalog/**]
request: R-22 (Iraj, Discord 13:17) "send a message of [a villager] saying a custom thing over iMessage, doable from the UI by other people, maybe as a shop item"
---
# FEAT-002 — "Villager-gram": send a friend's avatar saying a custom line over iMessage

Reuse what exists: ElevenLabs cloned voices (`POST /api/me/voice`, voice_lines), the Mayor outbox
(`mayor_outbox`, `GET /internal/outbox` → `{id, phone_e164, text, audio_url}`), the Photon agent in apps/imessage, avatar
portraits/heads. NEVER hardcode phone numbers; recipients come only from `users.phone_e164` set by the user themself.
1. **Consent first.** New per-user settings (migration `0xx_villagergram.sql`, distinct suffix):
   `allow_voice_by_friends` (default false) — others may make MY avatar/voice say lines; `receive_villagergrams`
   (default false) + phone_e164 set in Settings by the recipient themself. Settings UI for both, with clear copy.
2. **Shop item** `villagergram` (consumable, XP price ~150) in the catalog registry. Flow in UI: pick a speaker villager
   (only those with allow_voice_by_friends) → type ≤140 chars → pick a recipient member (only those with receive on) →
   preview (text + speaker portrait; audio only after confirm) → Send consumes the item.
3. **API** `POST /villages/{vid}/villagergrams {speaker_id, recipient_id, text}`: checks consent flags, membership,
   moderation (reject slurs/harassment/impersonation of real-world claims, links, phone numbers — cheap keyword list + LLM
   check via existing provider abstraction, mocked in tests), rate limit (3/day per sender, 5/day per recipient). Renders
   audio with the speaker's ElevenLabs voice (one call, only on this explicit action; skip if speaker has no voice → text only),
   saves under villages/<vid>/grams/, and enqueues an outbox row with text prefixed
   "🎙️ <Speaker>'s villager (AI voice), sent by <Sender> via Village:" + audio_url + portrait image url.
   Every send logged as an activity event visible to the speaker ("Lance made your villager say: …") so the speaker sees
   every use, and the speaker can revoke consent anytime. If GPU worker is up, optionally attach a LAM talking-head clip;
   otherwise portrait + audio.
4. **Delivery safety.** Add env `PHOTON_SEND_ENABLED` (default false). When false, the agent marks rows `dry_run` and logs
   instead of sending — the integrator will enable it only after the owner approves in the terminal.
   Teach apps/imessage to send attachments (audio + image) for outbox rows if Photon Spectrum supports it; else link.
Tests: pytest (consent, moderation, rate limits, outbox row), imessage agent unit test (dry run, attachments), web e2e (mock).
Final report per AGENTS.md, including exactly how the owner flips it live.
