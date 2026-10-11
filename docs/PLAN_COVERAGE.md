# Hackathon.pdf plan → implementation coverage (2026-10-10 06:05)

Legend: ✅ built & verified · 🟡 partial / running now · ❌ gap → task

| Plan item (team doc) | Status | Where / task |
|---|---|---|
| 3D village, everyone walking around, click → profile/feed | ✅ | WEB-001/006/008/010 |
| Feed: status updates, goal for week, progress updates, previous goals | ✅ | API-001, WEB-001 |
| Group photo / individual photos → segmentation → 3D avatar | ✅ | CV-001..005, WEB-009 |
| Voice memos → ElevenLabs clone (consent) + voice lines | ✅ | API-004, WEB-005, CV-004 |
| Procedurally generated, consistent village; grows when people join | 🟡 | WEB-008 ✅, rectangular grid w/ lots WEB-011 running |
| LLM God/Mayor: weekly recap, prayers, random events/challenges | ✅ | API-002/003 |
| Mayor long-term memory, scaled events, daily digest | 🟡 | API-009 running |
| Tamagotchi vibes + humorous sound effects | 🟡 | chimes/fanfare exist; richer SFX → WEB-013 |
| **Bribe the Mayor with points/XP (or SOL)** | ❌ | API-010 |
| Daily check-in, XP, streaks | ✅ | API-001 |
| **Send messages to people (villager ↔ villager)** | ❌ | API-010 + WEB-013 |
| Shop: clothing, pets (backyard before dog, no cat/fish), pet decorations, house upgrades, talking styles | 🟡 | API-008/WEB-010 ✅; pet decorations + upgrades GLBs in ASSET-003 |
| Predetermined vetted items; easy to add more | 🟡 | ARCH-001 registry running |
| **Points/items purchasable with Solana; money to auditor** | ❌ | SOL program ✅ (not deployed, owner step); shop-with-SOL → WEB-012/API-010 |
| Agent texts people at random times with updates, as other people ("Lance roasting Iraj") | ✅ | API-002 scheduler + Photon agent |
| Weekly goal, put money in pot, fancy math, only payers compete | 🟡 | program + intents ✅; live wallet after deploy |
| Auditor grades ambition/quality/work; crown; badge/star | ✅ | API-003, WEB-004 |
| Competitions (group/global), auditor in/out, fee %, photo entries, friendly mode | ✅ | API-003, WEB-004 |
| Reward: new outfit for self/others **using computer vision** | 🟡 | CV-006 running (photo → wearable / 3D decoration) |
| Gloating iMessages from avatars | ✅ | Mayor nudges as friend + Photon |
| Random events: VC talk, hang out, movie night, mixed | 🟡 | templates in API-009 |
| **Steam / Discord activity as read-only signal (status, weekly recap)** | ❌ | ACT-001 |
| Evidence verified by auditor + VLM random checks for slop | ✅ | API-002 auditor |
| Penalties: house downgrade, crater (recoverable); rewards unlock buildings (pet shelter → pets) | ✅ | API-007, WEB-008 |
| Audit deadlock emergency vote, punish auditor | ✅ | API-003 (recoverable penalty) |
| Vultr serverless/GPU | 🟡 | deploy kit ready; owner approval |
| Tiger Data DB | 🟡 | TimescaleDB locally (same engine); cloud swap = DATABASE_URL |
| Auth0 with a **unique login process** | 🟡 | Auth0 ✅; unique login (face/voice match) → CV-007 |
| Stripe for the business side (company runs villages) | ❌ | BILL-001 (test mode; needs Stripe test keys) |
| Gemini API | ✅ | API-002+ (Vertex) |
| Real-time multiplayer (see friends live) | ❌ | API-010 presence + WEB-013 |
| Delete yourself fully (photos, voice) | 🟡 | voice delete ✅; full account deletion → API-010 |
| Stefanny: clothing, house upgrades, buildings, cosmetic events | ✅/🟡 | ASSET-001..003 |
| Lance: onboarding UI, evidence, competition creation/terms, shop UI | ✅ | WEB-002..010 |
