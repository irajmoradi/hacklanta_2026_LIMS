# Village HTTP API contract v1 (integrator-owned)

Base: `http://localhost:8010/api` (web dev server proxies `/api` → 8010). JSON everywhere.

## Auth
- Prod: `Authorization: Bearer <Auth0 access token>` (audience `https://api.village.local`). API validates
  via Auth0 JWKS, maps `(iss, sub)` → `users.id`. Every village route checks membership (403 otherwise).
- Demo mode (`DEMO_AUTH=1`, default in dev): header `X-Demo-User: <user uuid>` is accepted instead.
  Web shows a "play as" picker of seeded villagers when Auth0 isn't configured. Never enable in prod.

## Types
```ts
type Villager = { user_id: string; display_name: string; house_slot: number; house_level: number;
  coins: number; xp: number; level: number; streak_days: number; avatar: AvatarManifest; equipped: string[];
  status_line: string | null; has_crown: boolean };
type AvatarManifest = { schema_version: 1; user_id: string; revision: number;
  body:     { kind: "preset"; preset_id: string; colors: { hair: string; shirt: string; pants: string; shoes: string; skin: string } };
  portrait: { kind: "initials" | "photo" | "lam_head"; asset_url?: string; head_package_url?: string };
  generation: { segment: JobState; head: JobState; body: JobState } };
type JobState = "none" | "queued" | "running" | "ready" | "failed";
type CheckIn = { id: string; created_at: string; user_id: string; kind: "status"|"progress";
  body: string; goal_id: string | null; stretch_tier?: number | null; evidence_url: string | null };
type StretchTier = { goal_id: string; tier: number; title: string; status: "active"|"done"; completed_at: string|null };
type Goal = { id: string; user_id: string; week_start: string; title: string; detail: string|null; status: "active"|"done"|"missed"|"stretch"; stretches?: StretchTier[]; stretch_bonus?: number };
type MayorEvent = { id: string; kind: "challenge"|"recap"|"random_event"|"prayer_response"; title: string;
  body: string; reward_xp: number; penalty: string|null; status: string; ends_at: string|null };
type FeedItem = { id: string; created_at: string; user_id: string|null; type: string; text: string; payload: object };
```
Colors are `#rrggbb`. Unknown preset_id → web falls back to `preset_default`.

### WEB-020 member house appearance

Every `Villager` in village and person/profile responses also includes `house_style`
and `house_colors` (both nullable). Style is `cottage | modern | aframe | tudor | beach | townhouse`;
null preserves the automatic/equipped style. Colors are either null (deterministic preset)
or the complete object `{wall, roof, trim, door, accent}`, each matching `^#[0-9a-f]{6}$`.

`PATCH /me` accepts these fields alongside the existing profile settings. A house update
requires `village_id` (UUID) and changes only the authenticated user's membership in that
village. Missing village ID or invalid style/colors returns 422; non-members receive 403.
Omitted fields remain unchanged; explicit null resets that field. Extra color keys are
rejected. The response remains `{user, villages}`; refetch the village/person for appearance.
Example: `{ "village_id": "13370000-0000-4000-8000-000000000000", "house_style": "beach", "house_colors": null }`.
This endpoint cannot change `house_level` or unlock paid upgrades. All six shapes support
levels 1–3; existing grand-house models remain in use at levels 4–5. Saved custom colors
override named wall/roof/trim/door/accent materials at every level.

### FEAT-006: owned wearable colors

Migration: `apps/api/migrations/019_item_colors.sql`; then sync the catalog.
The current equipment projection (also returned by equip/unequip) is:

```ts
type ItemColors = { primary: string; secondary?: string; accent?: string };
type EquippedItem = {
  item_id: string; slot: string; asset_key: string | null;
  colors?: ItemColors | {}; // {} means use the authored material colors
};
// Villager.equipped is EquippedItem[]; equipped_ids is the compatibility string[].
```

`PATCH /villages/{vid}/inventory/{item_id}/colors` accepts
`{"colors":{"primary":"#bc6651","secondary":"#f1d9ad","accent":"#3b9790"}}`.
Returns `200 {item_id, colors}` with lowercase hex. Replaces the whole palette;
omitted/null secondary and accent channels use authored defaults. Primary is required.
Only exact six-digit `#RRGGBB` strings are accepted; unknown fields are rejected (422).
Membership is required (403); the item must be clothing owned by the authenticated
user in that village (404 otherwise). Recoloring costs no coins and never equips an item.
Repeating a request is safe; the latest successful write wins. No provider is called.

Colors live on the inventory row and survive unequip/re-equip. `GET /villages/{vid}/shop`
adds `colors` to each shop item (`{}` when unset). Village and profile responses include
colors on equipped items for every member. Existing clothing uses supported legacy
material aliases; new `outfit_*` GLBs expose `primary`, `secondary`, and `accent`.
The 16 new shop entries cost 40–190 coins. Backpack/tote occupy torso; bandana occupies
neck; bottoms remain unsupported. Photo-derived custom items retain their separate API.

## Endpoints
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | – | `{ok, db, gpu_worker: "up"|"down", build}` |
| GET | `/me` | – | `{user, villages:[{id,name}]}` |
| POST | `/villages` | `{name}` | `{village}` (creator = owner, random seed + invite_code) |
| POST | `/villages/join` | `{invite_code}` | `{village}` |
| GET | `/villages/{vid}` | – | `{id,name,seed,villagers: Villager[], active_events: MayorEvent[]}` |
| GET | `/villages/{vid}/feed?limit=50` | – | `FeedItem[]` newest first |
| GET | `/villages/{vid}/users/{uid}` | – | `{villager, goal: Goal|null, past_goals: Goal[], check_ins: CheckIn[]}` |
| POST | `/villages/{vid}/goals` | `{title, detail?}` | `Goal` (this week; upsert) +XP once |
| POST | `/villages/{vid}/check-ins` | `{kind, body, goal_id?, idempotency_key}` | `{check_in, xp_awarded}` (retry → xp_awarded 0) |
| POST | `/villages/{vid}/evidence` | multipart `file` | `{evidence_asset_id}` |
| GET | `/villages/{vid}/shop` | – | `{items:[{id,kind,name,price_coins,requires,owned}], balance}` |
| POST | `/villages/{vid}/shop/buy` | `{item_id}` | `{balance, inventory}` atomic; 409 insufficient/missing requirement |
| POST | `/villages/{vid}/mayor/pray` | `{text}` | `MayorEvent` (Gemini proposes; server validates bounds) |
| POST | `/villages/{vid}/mayor/recap` | – | `MayorEvent` kind=recap |
| POST | `/villages/{vid}/mayor/nudge` | `{target_user_id}` | `{text, audio_url|null}` roast/encouragement as another villager; respects roast_ok |
| POST | `/voice/lines` | `{user_id, text}` | `{id, audio_url}` ElevenLabs TTS with user's voice_id |
| GET | `/avatars/{uid}` | – | `AvatarManifest` |
| POST | `/avatars/{uid}/photo` | multipart `file` + `consent=true` | `{job_id}` enqueues segment→head |
| GET | `/jobs/{id}` | – | `{id, stage, status, error}` |
| GET | `/assets/{key}` | – | file (authorized, from local `data/assets/`) |

XP rules (server-side constants): status check-in +10 (max 1/day), progress check-in +25, set weekly goal +20,
mayor challenge completion = event.reward_xp. level = floor(sqrt(xp/50)) + 1.

## v2 additions (2026-10-10 02:15) — API port is **8010**
- `POST /villages/{vid}/check-ins` body gains optional `evidence_asset_id` (from `/evidence`). If present, the
  server enqueues an AI evidence review. `CheckIn` gains `review: {verdict, confidence, reason} | null`.
- `GET  /villages/{vid}/check-ins/{cid}/review` → latest `{verdict: "verified"|"suspicious"|"rejected"|"error", confidence, reason, model}`.
- `POST /villages/{vid}/goals/{gid}/status` `{status: "done"|"missed"}` (goal owner or village owner).
- `POST /villages/{vid}/events/{eid}/complete` `{user_ids: string[]}` (village owner = auditor for now) →
  awards `reward_xp` once per user via ledger (`source_key = event:<eid>:<uid>`), marks event completed.
- `GET  /villages/{vid}/agent-log?limit=50` → Mayor/auditor decisions with reasons (for the "AI at work" panel):
  `[{created_at, agent: "mayor"|"auditor"|"scheduler", action, target_user_id|null, reason, model}]`.
- LLM provider: `LLM_PROVIDER=openrouter|gemini` (dev = openrouter deepseek/deepseek-v4-flash with
  `reasoning.enabled=false`; demo = gemini). Vision (auditor) always Gemini.

## v2 additions — accomplishments and reactions (FEAT-001)

All routes below require village membership. Reactions belong to the authenticated user;
the server verifies that the target belongs to the village (404 otherwise).

```ts
type Reaction = { emoji: '🎉'|'🔥'|'👏'|'💪'|'❤️'|'😂'|'🤯'|'👑'; count: number; mine: boolean };
type ReactionTarget = { target_kind: 'activity'|'goal'|'check_in'; target_id: string };
type Accomplishment = ReactionTarget & {
  id: string; user_id: string; display_name: string;
  type: 'goal_completed'|'competition_won'|'level_up'|'badge_earned';
  title: string; created_at: string; reactions: Reaction[];
};
```

- `POST /villages/{vid}/reactions` accepts `{target_kind,target_id,emoji}` and idempotently
  adds the viewer's reaction. `DELETE` with the same JSON body idempotently removes it.
  Both return the target's `Reaction[]`. Different emoji may coexist for one user;
  retries cannot increment counts. Invalid emoji/kinds/UUIDs return 422.
- Feed items and every current/past goal in `/villages/{vid}/users/{uid}` gain
  `reactions: Reaction[]` (empty array when none). `mine` is relative to the viewer.
  Feed reactions target the activity ID; profile goal reactions target the goal ID.
- Goals gain `completed_at: string|null`. A transition to `done` records the timestamp
  and emits `goal_completed` activity with `{goal_id,title}`. Retrying `done` does not
  duplicate the event. Marking missed clears the timestamp. Existing completed goals
  without a recorded completion time use their original creation timestamp.
- `GET /villages/{vid}/accomplishments?limit=50` returns `Accomplishment[]`, newest first
  (stable ID tiebreak); limit is 1–200. Completed goals use `target_kind=goal`, sharing
  their profile reactions. Competition wins, weekly completion stars, and level-up
  activities use `target_kind=activity`, sharing feed reactions. A tied competition
  produces a card per winner. Existing wins/stars are backfilled; level-ups are recorded
  prospectively when XP awards cross a level threshold. GPU/model services are unnecessary.

## Internal (imessage agent → api, header `X-Service-Key: $SERVICE_KEY`)
- Outbox is the `mayor_outbox` table: `GET /internal/outbox` claims pending rows (claimed_until = now+2min) and
  returns them; `POST /internal/outbox/{id}/sent` `{provider_msg_id?}`; `POST /internal/outbox/{id}/failed` `{error}`.
- `GET /internal/assets/{key}` — service-key-authenticated asset fetch (voice notes for iMessage).

| POST | `/internal/inbound` | `{phone_e164, text, message_id?}` | `{reply_text, processed_checkin}` — registered sender commands, real-data questions, pending photo choice, otherwise Mayor chat |
| POST | `/internal/inbound/evidence` | multipart `file`, `phone_e164`, optional `caption`, `message_id` | `{reply_text, processed_checkin}` — service-authenticated image evidence routing |

Both inbound endpoints require `X-Service-Key`. Questions about goals, competitions/standings,
XP/level/streak and help use keyword rules, with the existing provider classifying other phrasing.
Answers use the sender's database records in their oldest village membership. Goals show this
week's status, progress check-in count and days remaining (UTC week); competitions show rank
by confirmed points, including ties. The current competition schema has no deadline or team
target, so replies explicitly say no deadline is set and never invent a team percentage.

Evidence accepts image MIME types and validates JPEG/PNG/WebP bytes, at most 10 MiB per file.
Unknown, ambiguous or unjoined phone mappings get invite guidance without storing an image.
For an uncaptioned photo or legacy `checkin:` photo alias, exactly one joined, open, non-friendly competition receives an entry; otherwise the sender's
active current-week goal receives a progress check-in. With several eligible competitions,
the API persists numbered choices and up to 20 pending photos for that user/mapping for ten
minutes; text `1`, `2`, etc. submits those photos to the selected competition. Invalid choices
repeat the list; `cancel` clears it; expired or unavailable choices request a new photo. Further
photos share the original expiry and choices. Selection revalidates membership and competition
availability. The caption becomes the body (`checkin:`/`progress:` prefixes are stripped), or
defaults to "Photo evidence via iMessage". Missing active goals prompt the sender to set one
and resend. Existing background evidence review runs after submission; replies promise review,
not approval or immediate XP. `processed_checkin` is true for a recorded daily or goal check-in.

Evidence `message_id` is optional (1–480 characters); the agent always sends a stable ID per
photo. Durable receipts deduplicate uploads and choices; changed content with a reused ID
returns 409. File limit/type failures return 413/415. Caption limit is 4000 characters.
Apply API migration `025_inbound_evidence.sql` before enabling this workflow.
| GET | `/internal/outbox` | – | `[{id, phone_e164, text, audio_url}]` pending Mayor texts; agent sends then `POST /internal/outbox/{id}/sent` |
# FEAT-002: consented Villager-grams

Additive migration: `apps/api/migrations/014_villagergram.sql`. Sync the catalog after migration.

- `GET /api/me` includes `allow_voice_by_friends` and `receive_villagergrams`, both default false.
  `PATCH /api/me` accepts these booleans. Only the authenticated user can set their own phone
  or permissions. Disabling either permission cancels affected queued/claimed grams; changing
  the recipient's phone cancels grams addressed to the old number. STOP disables receiving too.
  The existing `/api/voice/lines` endpoint also requires this speaker permission for
  another user's voice and emits a `friend_voice` feed event with requester and text;
  a user's requests for their own voice continue to work without friend permission.
- `GET /api/villages/{vid}/villagergrams/options` returns `{members:[{id,display_name,
  allow_voice_by_friends,can_receive,portrait}]}` to members. Never exposes phone numbers.
- Catalog item `villagergram`: `kind=consumable`, `slot=consumable`, price 150 coins. Existing
  `/shop/buy` purchases one held token, never equips it. Successful queueing consumes it;
  it can then be purchased again, with a fresh coin debit. Equip/unequip rejects consumables.
- `POST /api/villages/{vid}/villagergrams` accepts `{speaker_id,recipient_id,text,
  idempotency_key?}`. Text is trimmed, 1–140 characters; the optional retry key is a UUID.
  Clients should reuse that key on ambiguous retries with the same payload. Returns 201
  `{id,status:"queued"|"rendering_video",video_url:null|string}`. This is not a delivery receipt. Sender, speaker, and recipient
  must belong to the village; speaker permission and recipient permission + self-set phone
  are required. Limits are 3 per sender and 5 per recipient per UTC calendar day, across villages.
  Consent failure: 403; missing token/conflicting retry key: 409; rate limit: 429;
  unsafe content: 422; unavailable moderation: 503. Failed moderation/provider requests
  retain the token. Speech generation happens only on this explicit send, once per successful
  retry key, using the speaker's consented clone; otherwise the gram contains text + portrait.
  GPU is optional. Audio is stored at `villages/<vid>/grams/<id>.mp3` and in `voice_lines`.
- Every successful use emits a `villagergram` feed event attributed to the speaker with
  `payload.text`, `sender_id`, `speaker_id`, and `gram_id`. The event tells the speaker who
  used their avatar and the exact line. Portrait fallback is a generated initials PNG.
- `GET /api/internal/outbox` adds `kind` and nullable `image_url` (authenticated internal
  asset path), alongside `audio_url`. Villager-grams are labeled
  `🎙️ <Speaker>'s villager (AI voice), sent by <Sender> via Village: <line>`.
  Gram claims recheck both permissions, current phone and all memberships independently
  of Mayor-message permission. Service-only `POST /internal/outbox/{id}/ready` rechecks
  an unexpired claimed gram immediately before transport (409 means do not send).
- Service-only `POST /api/internal/outbox/{id}/dry-run` transitions claimed rows to terminal
  `dry_run`. The iMessage agent defaults to this behavior unless `PHOTON_SEND_ENABLED=true`.
  Dry-run rows are not replayed when the switch is enabled. Audio/image are fetched with
  the service key and sent as Spectrum attachments in live mode. Logs contain row IDs,
  never message contents, phone numbers or credentials.

Revocation cannot recall an iMessage already handed to the provider. The existing outbox
lease/retry design does not guarantee exactly-once transport across process crashes.


## WEB-017 — idle activity

`PATCH /api/me` accepts optional `idle_activity`: `home` (default), `gaming`, `working_out`, `studying`, `gardening`,
`dancing`, `reading`, `food`, or `walk_pet`. Invalid values, including null, return
422. Omitted fields retain their stored values. This is a global user preference.
`GET /api/me` and PATCH responses include `user.idle_activity` and
`user.has_equipped_pet` (a boolean across the user's villages). Choosing `walk_pet`
requires an equipped catalog or custom pet, otherwise the API returns 422.
Village `villagers[]` and profile `villager` objects expose `idle_activity`.
If no pet is equipped in the displayed village, the scene uses `home` without
erasing the stored preference. Mayor events and festival weather override activity
destinations temporarily. Apply `apps/api/migrations/015_idle_activity.sql` and `021_idle_studying.sql`.
`studying` seats friends together at the always-open park study nook (12 seats);
when full, additional villagers remain at home until a seat is available.

WEB-024: also apply `apps/api/migrations/046_web024_idle_activities.sql`.
`working_out` visits the always-open park fitness corner. `gaming` hides the
avatar inside its home with flickering window light and a door badge on arrival.
Both retain the ten-minute schedule (510 seconds activity, 90 seconds at home)
and event overrides. `home` remains Chilling at Home.

### FEAT-003 — profile showcases and earned cosmetics

Catalog definitions require `source` (`shop`, `event:<pack>`, `earned:<rule>`) and
`rarity` (`common`, `uncommon`, `rare`, `epic`, `legendary`). Optional `tint` is a
six-digit hex recolor. Scene-only entries use `earned:village_progression` and
are not inventory rewards.

`GET /api/villages/{vid}/shop` includes locked collectible rewards. Items add
`source`, `rarity`, `description`, optional `tint`, and nullable `acquired_at`
(UTC timestamp for owned items). `owned` remains viewer-specific. Zero price
does not imply purchasability: `POST .../shop/buy` returns 409 for non-shop
sources. Town event-pack decorations remain in the world registry, outside the
personal inventory shop. Their event source does not grant personal ownership.

Public villager `equipped[]` adds the same metadata and acquisition timestamp
for catalog items. Custom photo items retain their existing shape. Profiles
expose equipped items only; unequipped inventory is owner-only through the shop.
Equip/unequip routes retain ownership and prerequisite checks. There is no new
client-triggered award endpoint.

| Item | Source / server trigger |
| --- | --- |
| `champion_mantle` | `earned:weekly_crown`: winner of finalized weekly audit |
| `perfect_week_halo` | `earned:perfect_week`: every UTC date Monday–Sunday has a check-in; granted Sunday |
| `streak_flame_scarf` | `earned:streak_28`: 28 consecutive UTC dates with check-ins |
| `auditor_badge` | `earned:auditor`: assigned auditor finalizes a weekly review |
| `festival_vip` | `earned:festival_vip`: owner confirms participation in a rewarded Mayor `game_night` |
| `mayor_medal` | `earned:mayor_event`: owner confirms completion of a Mayor event with positive XP reward |
| `competition_laurels` | `earned:competition_win`: positive-score winner (including ties) of a settled audited competition; friendly competitions excluded |

Awards occur inside the triggering transaction using the existing unique
`inventory(village_id,user_id,item_id)` key and `ON CONFLICT DO NOTHING`.
They cost no coins, preserve the acquisition date, and never auto-equip or replace
an outfit. Duplicate events cannot add a second copy. Check-in rules count
distinct dates, not submissions. Historical events are not retroactively replayed.

Deployment: run the existing `scripts/sync_catalog.py` after merging the catalog
and before serving the new API. This publishes metadata and collectible rows;
no database schema migration is needed. Mock mode shares the generated catalog
and purchase restrictions, with no provider calls.

## FEAT-004 demo seats and debug

Paths are relative to `/api`. Require `DEMO_AUTH=1`, `X-Demo-User`, and one of the
five seeded members of village `13370000-0000-4000-8000-000000000000`.
Bearer-authenticated requests return 404. Nonseeded users/nonmembers return 403.
Debug routes also require API `DEMO_DEBUG=1`, otherwise 404.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/demo/seats` | - | `{seats:[{user_id,clients}]}` |
| POST | `/demo/seat` | `{user_id,client_id:UUID}` | `{conflict:boolean}` |
| GET | `/demo/debug` | - | `{enabled:true}` |
| POST | `/demo/debug/{action}` | below | `{ok:true,replayed:boolean}` |

Seat user_id must equal the caller. Each browser stores a client UUID and heartbeats
once per minute. One client claims one seat; another client's claim within ten
minutes produces a soft warning. Registry is in memory per process.

All actions require `idempotency_key:UUID`; optional `reason` is 1-200 characters,
default Rehearsal. Changed input with the same key returns 409. Successful replays
cause no mutation or extra activity. Receipts survive full reset. Each action logs
an activity event rendered as `🐞 debug: …`. Targets are always the authenticated
seat in the fixed demo village; there is no caller-selected target village/user.

- `xp`: `amount:100|500|2000` (default 100); xp_ledger `debug:` source_key and reason.
- `inventory`: delete catalog/custom inventory and restore house level 1.
- `week`: delete current UTC-week goal, check-ins, reviews and check-in retry keys;
  earned XP and activity history remain.
- `goal-done`: mark current weekly goal done; 409 if absent.
- `event`: random offline fixture Mayor event, 50 XP reward, one-day duration; no providers/messages.
- `weather`: toggle festival_night/clear, bypassing cooldown. Festival overrides repair fog until toggled off.
- `reset`: also requires `confirm:"RESET"`; existing demo story reset runs in-process.
  All five seats reset; other villages, users, avatars and debug receipts survive.

The web persists its chosen seat separately for live/mock mode and uses it for
X-Demo-User. Real-auth sessions never render debug controls; connected mode probes
the API gate. The offline mock simulates enabled debug controls.


# FEAT-010: optional talking-avatar video

Apply `apps/api/migrations/018_gram_video.sql`. Both `villagergrams` and `mayor_outbox`
add nullable `video_key` and `video_pending_until` columns. No schema.sql edits.

- After rendering consented audio, a `portrait.kind=lam_head` speaker is eligible.
  GPU health gets a hard 2-second limit. Offline GPU, missing head, or missing audio
  keeps the original voice/text + portrait behavior. No automatic generation retries.
- A reachable worker gets one post-response `POST {GPU_WORKER_URL}/avatar/talk_video?wait=true`
  with `{user_id,audio_path_or_url,max_seconds:15}`. Worker returns
  `{video_path,seconds}`: H.264/AAC MP4, 512x512, on the shared asset volume beside
  the audio. GPU_WORKER_URL may be a base URL or end in `/health`. Native Windows
  paths are translated to WSL `/mnt/<drive>/...` for the worker and back on return.
- The 201 is sent before video rendering. While rendering, outbox rows cannot be
  claimed. Success saves `video_key` on both rows atomically; worker errors release
  voice + portrait. A persisted 120-second deadline releases delivery even if the
  API restarts; late results cannot change an already eligible/claimed delivery.
- `GET /api/villages/{vid}/villagergrams/{id}` returns
  `{id,status:"rendering_video"|"queued",video_url:null|string}`. Village membership
  and participation as sender/speaker/recipient are required. Unknown gram: 404;
  nonparticipant: 403. Idempotent POST retries return the current rendering status.
  `queued` means rendering has ended, not that transport succeeded.
- Status `video_url` uses the existing authenticated `/api/assets/...` route. The
  web client polls every 2 seconds and fetches the preview with user credentials
  into a revocable blob URL; credentials are never embedded in the player URL.
- `/api/internal/outbox` includes nullable `video_url` pointing to the service-key
  protected `/api/internal/assets/...` endpoint. Agent sends disclosure text,
  then video, then audio; a video suppresses the separate portrait. The worker
  codec contract avoids another encode. Each successful part is retained in the
  agent's existing in-process retry map, including video. Process restarts retain
  the existing at-least-once delivery limitation; no exactly-once guarantee.
- Mock/fixture mode never calls the GPU. Photon dry-run behavior is unchanged.

## WEB-025: photo tokens and demo guests

- Catalog SKU `photo_token` is a consumable costing 25 coins. `POST /api/villages/{vid}/items/token`
  returns 201 `{id}` and can be bought repeatedly. `POST .../shop/buy` with
  `{item_id:"photo_token"}` uses the same token balance (never equipment inventory).
  Membership, catalog requirements and sufficient coins are checked atomically. Mayor awards remain unchanged.
- Photo job status additionally returns `kind`, `stage`, nullable `progress`, and `refunded`.
  Worker-declared failure refunds the spent token exactly once, even without a polling client.
  Invalid completed worker output is persisted as a failed job and refunded when materialized.
  Failure status returns 200 with `status:"failed"`, `error`, `refunded:true`, `item:null`.
  The bridge currently reports the whole photo pipeline as `segment`; `progress` only carries
  finer worker stages if present in its result. Clients must not invent stage completion.
- `POST /api/demo/guests`: 201 `{id,display_name}`. Creates `Guest N` with no membership.
  The caller switches `X-Demo-User` to the returned ID; regular name/join/avatar routes then apply.
- `DELETE /api/demo/guests`: 200 `{removed,seat}` (the seeded Iraj ID). Deletes only accounts
  tagged with the internal `village-demo-guest` issuer, regardless of their display names.
  Account cleanup removes owned artifacts and references; shared group photos owned by seeded
  users are preserved. Running avatar jobs return 409; retry cleanup when processing finishes.
- Both guest routes require `DEMO_AUTH=1`, `DEMO_DEBUG=1`, `X-Demo-User`, no Authorization
  header, and a seeded demo user or tagged guest. Disabled routes return 404; other users 403.
  `/api/demo/debug` also recognizes guests. Existing destructive debug actions remain seeded-only.
### FEAT-008 — farm animals and house paddocks

- Catalog `kind` and equipment `slot` additionally support `farm_animal` and
  `house_addon`. `house_paddock` uses `house_addon`; dogs keep the exclusive `pet`
  slot. Farm animals never follow villagers or enable `walk_pet`.
- `farm_store` unlocks at village level 4 / 2,500 earned village XP, alongside
  `pet_shelter`. Spending coins does not revoke earned building unlocks.
- `house_paddock` costs 80 coins and requires `farm_store`. It remains equipped as
  a permanent side-yard add-on (unequip returns 409). House upgrades remain separate.
- Farm items: `goat_kid` 60 coins, `duckling` 25, `calf` 75, `chicken` 30. Each has
  a second companion ID with `_friend` suffix at the same price and asset key.
  Each item ID can be owned once. All require both `farm_store` and `house_paddock`.
- Existing `POST /api/villages/{vid}/shop/buy` with `{item_id}` supports these items.
  Farm buys equip the animal without clearing other animals or the dog. At most
  six farm animals may be owned per member per village, including unequipped ones.
  Requests are serialized under village/member locks; missing prerequisites,
  insufficient coins, duplicate ownership and the cap return 409 without a debit.
- Existing inventory equip/unequip and village/profile `equipped` arrays include
  all equipped animals (`slot: farm_animal`, model in `asset_key`). Unequipping an
  animal hides it but retains ownership and its capacity reservation.
- The first-animal shop action offers “Add a paddock to your house (80 coins)” before
  spending anything. Acceptance buys the paddock, then the selected animal using
  two existing requests. If the second request fails, the paddock stays owned and
  the client reloads authoritative balance/inventory; it never rebills that add-on.
- API migration `020_farm_animals.sql` widens catalog checks and exempts farm animals
  from the one-equipped-item-per-slot index. `scripts/migrate.py` records applied
  additions per schema and avoids replaying the obsolete contract baseline.

## INTEG-005: persistent house architecture and materials

`PATCH /api/me` additionally accepts `house_variant` and `house_materials`, with
`village_id` required whenever any house setting is supplied. Only the caller's
membership in that village is updated (nonmembers receive 403). Migration
`023_house_options.sql` adds nullable JSONB membership columns. Both fields are
returned on village villagers and `GET /api/villages/{vid}/users/{uid}` villager
payloads. Omitted fields remain unchanged; null or an empty object restores
style defaults. Each supplied object replaces that field's previous object.

- `house_variant`: per-level keys `1` through `5`; level 1 allows classic/porch/bay,
  level 2 classic/balcony/bay, levels 3?5 classic/tower/greenhouse. Future-level
  choices may be saved but do not grant house upgrades.
- `house_materials`: partial object; wall wood/brick/stone, roof shingle/tile/metal,
  trim wood/stone/metal, door wood/metal, accent ceramic/brass/wood.
- Choices come from `packages/catalog/house-options.json`; nonclassic variants
  must exist for every style in the asset registry. Unknown keys, invalid values
  and non-object values return 422 before any changes are written.
- The editor saves these with style/colors in one request. Scene rendering uses
  API values, never user-global device storage. The mock API follows the same
  membership scope and validation, and resets with other fixtures on reload.
# FEAT-012: cozy disasters (additive)

Migration: `apps/api/migrations/026_disasters.sql`. `village_world` gains nullable
`disaster` JSON, `last_disaster`, and `rebuilt_at`; catalog and custom inventory gain
`away` booleans. Nothing is deleted. Existing member authentication applies.

`GET /api/villages/{vid}` returns these additional `world` fields:

```json
{
  "disaster": {
    "kind": "scorch",
    "title": "Scorch",
    "body": "Mayor recovery instructions",
    "started_at": "2026-10-10T12:00:00+00:00",
    "deadline": "2026-10-12T12:00:00+00:00",
    "repair_event_id": "uuid",
    "target_checkins": 6,
    "target_people": 3,
    "checkins": 2,
    "people": 1,
    "closed_building": "pet_shelter",
    "pets_away": false
  },
  "rebuilt_at": null,
  "gardening_available": true,
  "garden_xp_bonus": 5
}
```

`disaster` is null after repair; `rebuilt_at` is the last completion timestamp.
Kinds and weights are `scorch:3`, `outbreak:2`, `blackout:3`, `blight:2`.
Only one can be active and the last kind is excluded from the next draw. Failed
challenge/random events queue oldest first, each with exactly one linked repair.
Scorch closes the pet shelter (including pet purchases); outbreak empties its yard
and marks equipped pets away at 48 hours; blackout projects rain/night and rejects
festival night; blight disables gardening and its bonus. Weather preferences and
equipped flags survive recovery. Generated assets and provider calls are unnecessary.

Repairs use existing `POST /api/villages/{vid}/check-ins`: 2M check-ins from M distinct
current members, where M = min(3, roster size), minimum 1. Only check-ins since the
disaster began and within the last 48 hours count. Replayed idempotency keys do not
count twice. A late rolling window can still complete a repair; the original
deadline controls the outbreak consequence. The linked repair stays active until
completed. `POST /api/villages/{vid}/events/{eid}/complete` returns 409 for an active
disaster repair; it cannot bypass participation. Completion restores all away pets,
clears effects, completes the event and emits `disaster_repaired` to the feed/Gazette.
World reads and check-in writes reconcile deadlines transactionally.

`GET /api/villages/{vid}/shop` includes `away` on owned items and a 30 coin
`revival_potion` consumable. `POST /api/villages/{vid}/shop/buy` with
`{"item_id":"revival_potion"}` immediately returns all of that member's away pets
(including custom pets), charging once per outbreak. It returns the normal balance
and inventory shape, with `away` on inventory entries. Already-home retries are
successful and free; insufficient balance returns 409. Revived pets stay home even
while the outbreak continues. Villager equipped lists hide away pets but preserve
their inventory/equipped flags. Repairs bring pets home for free.

`PATCH /api/me` rejects gardening with 409 during blight in a joined village.
With the garden unlocked, gardening grants +5 XP on the first status check-in of
each UTC day, using a separate idempotent ledger entry; the bonus is zero during blight.

Existing demo-only gate (`DEMO_AUTH=1`, `DEMO_DEBUG=1`, seeded demo member) protects:

* `POST /api/demo/debug/disaster`: `{idempotency_key, reason?, disaster}` where disaster
  is one of the four kinds. Returns `{ok:true,replayed:false}`; retries return true.
  Active-disaster or consecutive-kind conflicts return 409.
* `POST /api/demo/debug/repair`: `{idempotency_key, reason?}`. Repairs immediately;
  already-repaired requests are harmless. No provider calls.

All effects are fictional and recoverable. Debug weather also rejects festival
night during blackout. New feed types are `disaster_started`, `pets_away`, and
`disaster_repaired`, with Mayor `text` and a linked `event_id`.


## FEAT-007: coins, progress XP and devnet SOL

- Every `Villager` includes `coins` (spendable balance). `xp` is the sum of positive
  lifetime XP awards; level remains `floor(sqrt(xp / 50)) + 1`. Historical XP spends
  remain audit records, but no longer reduce individual progress. Communal/building
  XP remains earned progress and cannot be spent.
- Every new XP award grants the same number of coins in the same transaction,
  including check-ins, goals, evidence audits, Mayor challenges, weekly wins and
  competition awards. Duplicate `source_key` never grants twice. Existing reward
  fields (`xp_awarded`, `reward_xp`) also describe the matching coin award.
- Shop items expose `price_coins` with unchanged numerical prices; `price_xp` is
  removed from the HTTP/catalog shapes. Shop and purchase `balance` means coins.
  Items, photo tokens and Villager-grams debit coins only; insufficient coins
  returns 409 even if the member has enough lifetime XP.
- `POST /villages/{vid}/mayor/bribe` accepts
  `{currency?: "coins", coins: 1..10000, wish}` and returns
  `{bribe: {id, village_id, user_id, currency:"coins", coins, wish, status, created_at}, balance, receipt}`.
  Old XP and SOL-intent submissions are rejected (422). The legacy internal
  `mayor_bribes.xp` / currency `xp` storage represents the coin amount for scheduler
  compatibility; it does not debit XP. SOL is reserved for competition pots.
- `POST /demo/debug/coins` uses the existing gated, idempotent debug action body
  (`amount`: 100, 500, or 2000); grants coins without XP. Debug XP grants both.
  Seeds receive matching coin balances without requiring GPU assets/providers.
- Migration `027_coins.sql` creates `coin_ledger` with unique `source_key`, copies
  historical XP awards and spends once, and mirrors future XP inserts atomically.
  New negative XP inserts fail. Rerunning does not restore spent coins or overwrite
  catalog prices. The old DB price column is retained only for schema compatibility.
- SOL amounts are devnet test currency, shown with the `devnet · test` tag.
  Competition intents are not balances or payments. Existing simulation and
  explicit wallet signature approval remain; this feature sends no transactions.


### FEAT-014 competition scoring

Competition create/list/detail responses add `scoring` (`cumulative` by default,
`scoreboard`, or `ordinal`), nullable `unit` (1-40 nonblank characters), and nullable
`target` (finite number > 0 and <= 1e12). Terms are immutable after creation.
`scoreboard` requires a unit. `cumulative` disallows unit and target.

- Cumulative: sum confirmed integer `points` (0-500 per entry); positive highest totals win, including ties.
- Scoreboard: sum auditor-confirmed `value`; positive highest totals win, including ties. An optional target is for progress display only.
- Ordinal: first confirmed completion wins. Without a target, one confirmed entry is completion. With a target, sum confirmed values until the target is reached. Rank by that entry's `confirmed_at`, then its `created_at`; exact ties use user ID for a deterministic single winner. No finish means no winner.

`POST /api/villages/{vid}/competitions/{cid}/entries` accepts `value` (finite,
0..1e12), required for scoreboard and ordinal-with-target. Responses preserve it
as `claimed_value`. `value` in an entry response is the confirmed value, null until
reviewed (friendly entries are immediately self-confirmed). Cumulative rejects
numeric value input. Entries also expose `created_at` and nullable `confirmed_at`.

The existing `POST .../entries/{eid}/decision` accepts optional `value`, required
when confirming a numeric mode. Existing `points`, `decision`, and `reason` remain
required; numeric clients send points=0. Reject sends points=0 and value=0 or null.
For ordinal without a target the API sets confirmed value=1. Decisions are editable
until settlement. Changing a confirmed value starts a new confirmation timestamp;
identical retries preserve it. AI review is advisory only; it never confirms a result.

The existing settle endpoint still requires the assigned auditor (friendly creator),
rejects pending entries, locks the competition, and is idempotent. Result includes
`winners`, `scores` (numeric total in `points`, plus nullable
`completed_at`/`submitted_at`), and `payments_executed:false`. Verified XP uses the
integer floor of the total capped at 500; friendly competitions award no XP.
Fee/payout previews are intent metadata only; no transaction is signed or sent.
Migration: `047_competition_scoring.sql` (existing competitions remain cumulative).
# FEAT-017: playful head speech

- `GET /api/heads/presets` (authenticated) returns `{presets:[{id,text}]}` with 20 stable
  string IDs (`"0"`–`"19"`).
- `POST /api/heads/{uid}/say` accepts exactly one of `{text}` (1–100 trimmed characters)
  or `{preset_id}`. `preset_id:"surprise"` generates a short contextual line with the
  configured Mayor LLM. Every new line passes the same D-034 moderation as Villager-grams.
- Response: `{id,text,audio_url,expr_url,job_id,cached}`. `audio_url` is immediately
  available; `expr_url` may be null while the existing `voice_expr` GPU job runs.
  `GET /api/voice/lines/{id}` returns the completed expression URL; the standard worker
  output is `/api/assets/avatars/{uid}/voice/{id}/line_expr.json`. The live LAM renderer
  accepts these frames directly. With the worker offline, audio remains playable with
  visibly labelled approximate amplitude motion; fixture portraits remain usable.
- Requires a shared village (or self). Friends require the speaker's current
  `allow_voice_by_friends`; self does not. Clones also require `voice_consent`; otherwise
  the existing deterministic stock voice is used. No recipient opt-in or messaging is
  involved. Cache hits recheck permission before returning any result.
- Persistent cache identity is `(speaker_id,effective_voice_id,exact_trimmed_text)`.
  The speaker dimension keeps expression jobs and asset ownership correctly scoped.
  Cache hits perform no LLM, TTS, or GPU generation and remain available after the limit.
- At most 10 new attempts per authenticated requester per UTC day, including surprise
  generation, moderation rejections, and provider failures. Reservations commit before
  paid work; concurrent requests serialize reservations. `429` means the daily limit;
  `409` means the same line is in progress (or the voice changed). A process-abandoned
  reservation can be retried after five minutes, consuming another attempt.
- `403`: consent/shared village missing; `422`: invalid input or moderation rejection;
  `502`/`503`: provider unavailable. Clients must never automatically retry generation.
- Chorus playback calls the same endpoint once per consenting speaker, sequentially,
  with one shared text. It stops on an error or explicit cancellation. The current
  upstream LAM renderer is a singleton, so only the active speaker has a live canvas.


### Chorus head clips (FIX-017)

`POST /api/heads/chorus` accepts exactly one of `text` (1�100 characters) or
`preset_id` (including `surprise`), plus optional `village_id` and `member_ids`
(1�50 UUIDs). The member filter only narrows eligible shared-village members;
it cannot bypass membership or voice permission. The web client passes its
non-placeholder cast. Without a village, all shared-village peers are considered.

Returns `{members: [...]}`. Successful members contain `user_id`, `id` (voice line),
`text`, `audio_url`, `expr_url`, `cached`, `video_url` (nullable), and `status`
(`pending`, `ready`, or `unavailable`). Per-member speech failures contain
`user_id`, null audio/video URLs, `status: "error"`, `code`, and `error`.
Speech uses the FEAT-017 cache and requester daily quota; each uncached voice
counts as a generation. A surprise is selected once for the batch.

`GET /api/heads/chorus/{line_id}` rechecks peer access and voice permission,
returns the line's audio/expression fields and current video status/URL, and
never triggers a provider or render. Poll pending clips about every two seconds.
Audio preparation happens during POST; video rendering is asynchronous and does
not gate audio playback. MP4s and durable status sidecars live beside cached audio.
Unavailable renders have a three-minute cooldown; only an explicit POST can retry
stale work. Ready clips are reused across replays and API restarts.

The frontend keeps the active Gaussian speaker live and plays other clips muted,
matching normalized clip progress to the active speaker's shared audio clock.
This accommodates different voice durations; word timing remains approximate.

# Stretch goals (FEAT-018)

Stretch tiers extend the same weekly goal. Profile/current and past goals, weekly
goals, and stretch mutation responses include `stretches` (ordered by tier) and
`stretch_bonus` (completed-tier count, 0–3). A tier has `goal_id`, `tier`, `title`,
`status: active|done`, and nullable `completed_at`. Goal status additionally allows
`stretch`; its `completed_at` continues to describe the base goal's completion.

- `POST /api/villages/{vid}/goals/{gid}/stretch {title?: string}`: goal owner only,
  current unfinalized week, completed base/previous tier. Trimmed title up to 140
  characters; omitted/blank title reuses the base title. Starts the next tier and
  sets goal status to `stretch`. Maximum three tiers/week, one active at a time.
  Retrying the active tier's title returns it without creating another tier;
  a different title while active returns 409. Returns the goal with tiers.
- `POST /api/villages/{vid}/goals/{gid}/stretch/{tier}/status {status: "done"}`:
  goal owner only, same week restrictions. Completes the tier, sets goal status
  back to `done`, and awards **10 XP + 10 coins**, half the existing 20-point weekly
  goal reward. Each goal/tier has a durable award source key. Repeated/concurrent
  completion cannot duplicate awards or feed events. Returns the goal with tiers.
- Goal-progress check-ins accept `stretch_tier: 1|2|3` and must name the currently
  active tier when the goal is `stretch`. Base-goal progress omits this field.
  Check-in responses/profile history preserve the tier so evidence stays attached
  to the right target. Status notes cannot specify a stretch tier. Progress needs
  a current, open goal; completed goals require starting a stretch first. For legacy
  clients omitting `goal_id`, the API resolves the current goal (and applies the same
  tier/closure rules), or retains unlinked progress when no current goal exists.
- Unknown goal/tier: 404; another owner's goal: 403; closed week, unfinished base,
  existing active tier or exhausted cap: 409; invalid input/target tier: 422.
  Base status/title mutation cannot overwrite existing stretch tiers.

Weekly review exposes all tiers alongside the original goal. AI suggestions receive
the tier targets and tier-labelled check-ins; image review uses the relevant tier
title. Tier changes and new progress invalidate cached suggestions and grades.
Only human-approved completed goals compete for the crown. Their score is the
existing sum of ambition, evidence quality and progress **plus 1 ambition bonus
per completed stretch tier** (maximum +3); the existing UUID tie-break is unchanged.
Self-reported stretch completion does not independently approve a weekly goal.

Completion emits `stretch_completed` with `goal_id`, `tier`, `title`, `bonus_xp`
and `bonus_coins`. It appears in feed and accomplishments as “went above & beyond”.
The base accomplishment remains visible while another stretch is active.
Migration: `apps/api/migrations/049_goal_stretch.sql`; no schema.sql edit required.


### FEAT-016 scene greetings

`POST /api/villages/{vid}/scene-voice/{kind}` requires village membership and accepts
no body. `kind` is `checkin` or `mayor` (other values return 404). Returns at least
`{audio_url: string | null}`. Call only when the member explicitly opens that scene.
Fixed text: “What did I do today?” / “Mayor I am! What do you want to know?”.
Check-in requires the caller's consented cloned voice; Mayor uses the existing stock
voice only when `MAYOR_VOICE=1`. No provider, disabled voice, or provider failure
returns null for a local blip fallback. Existing voice lines are reused under a
speaker row lock; cloned lines predating the current consent are not reused.
No scheduler, schema change, or client-supplied generation prompt is introduced.
Rumours read the existing Gazette gossip; the scene caches that read per member,
village and API mode for one hour and never starts a Gazette generation job.
## FEAT-015 — shared house interiors

A house is keyed by its owner's user UUID (`uid`). All routes require authentication and
`?vid=<village UUID>`; both owner and visitor must belong to that village. Furniture has one
independent instance IDs (catalog kind is separate). Only the house owner can edit; visitors watch live.
Use `uid=vid` for the Community Hall: every current village member can decorate.
The main DB owns membership, coins, and purchased furniture; Tiger owns positions, creator attribution,
presence, revisions, and movement history. No Tiger URL is sent to the browser.

- `GET /api/houses/{uid}` -> `{type:"snapshot",seq,items,can_edit,floors,hall,can_remove_any,custom_items,catalog,owned}`.
  Items: `{house_id,item_id,kind,x,z,rot,stashed,seq,floor,creator,creator_name,model_url}`. Catalog is `packages/catalog/furniture.json`.
- `POST /api/houses/{uid}/edit` -> delta (same reducer as WebSocket).
  Body `{action:"move_item"|"rotate_item"|"place_item"|"stash_item",item_id,kind?,floor?,x,z,rot,client_seq}`.
  Positions are meters in an 8×8 room, snapped to .25m; rotation is degrees snapped to 15°.
  Wall items snap to the nearest wall; conservative rotated bounds reject collisions (409).
  Rugs, wall art and ceiling fixtures occupy separate collision layers. Invalid numbers: 422.
  Unauthorized editors/unpurchased extras: 403. Each successful edit increments a house-wide `seq`.
  Last committed edit wins. `client_seq` correlates acknowledgements; on a socket it must increase.
- `POST /api/houses/{uid}/buy` body `{kind}` -> `{ok:true}`. Home owner or Hall member. Purchases belong to the actor and debit coins
  once under main DB locks and persist entitlement before a separate placement action.
- `POST /api/houses/{uid}/editors` body `{user_id,enabled}` -> 410 Gone. Legacy grants never authorize edits.
- `GET /api/houses/{uid}/history` -> `{as_of,items,moves}`. Current snapshot plus movements
  from the last ten minutes, newest first. Reverse `before_state` to preview older state;
  history preview never writes state. Each move includes time, seq, actor, action and before/after.
- `GET /api/villages/{vid}/busy-houses` -> `[{house_id,moves}]` (current hour, maximum five).
- `WS /api/houses/{uid}/live?vid=…`: send `{Authorization:"Bearer …"}` or, in demo mode,
  `{"X-Demo-User":"…"}` as the first frame within ten seconds. Tokens never appear in URLs.
  Server sends initial snapshot, then transaction-committed `{type:"delta",seq,item,user_id,client_seq,client_id}`.
  Author also receives `{type:"ack",…}`; clients deduplicate by item revision and reconcile pending
  optimistic moves. The socket snapshot assigns a `client_id`; match it when acknowledging
  local edits so two tabs using the same user cannot acknowledge each other. Invalid edits send `{type:"rejected",client_seq,detail,snapshot}`.
  `{type:"permissions"}` requests an authenticated snapshot refresh.
  `{type:"presence_list",people:[{user_id,name}]}` includes all active room visitors.
  Send `{type:"ping"}` every 20 seconds for a pong and presence renewal (60-second TTL).
  Reconnect with a fresh snapshot; client sequence is socket-local. No offline edit queue.

`apps/api/scripts/tiger_migrate.py` applies house migrations to local DB and configured Tiger.
When `TIGER_DATABASE_URL` is empty, the API uses its local pool. Configured Tiger failures surface;
there is no silent failover that could split state. Timescale installations get a compressed
`house_item_moves` hypertable (7-day policy) and `house_activity_hourly` continuous aggregate;
plain Postgres gets the same tables and an hourly view. Run the script before starting the API.

FEAT-019: `floor` is zero-based and defaults to 0 for legacy clients. Houses have 1/2/3 floors
at levels 1/2-3/4-5; the Hall has 2. Unavailable floors return 422. Collision checks only
consider the target floor. One ordered room stream carries each item's floor; clients render
the active floor without losing moves during a tab switch.
`item_id` accepts 1-80 alphanumeric, underscore or hyphen characters. New independent instances
send `kind`; legacy clients may omit it when item_id equals the catalog kind. Existing instances
retain their kind and creator irrespective of client-supplied fields.
Any Hall member can move/rotate items; only the creator or village member with role `owner`
can stash them. Photo objects use `custom_items.id` as kind; only the photo owner can place,
duplicate or restore them. The server resolves same-village object assets and creator names.
`custom_items` in snapshots lists the actor's ready objects (`id,owner,glb_url,preview,display_name`).
Every new Hall instance emits `hall_item_added`; moves/restores do not spam the activity feed.
Room locks serialize limits: 30 accepted edits/second per actor/room, 20 placements/minute,
and 256 total instances per room. Rate limits return 429; full rooms return 409.
Apply `052_house_floors.sql` on the main DB and Tiger before deploying. It preserves old items
on floor 0, backfills their creators and retires editor grants. The house migration script
includes it and remains repeatable.


## FEAT-020: Library weekly reading list

All routes require membership in `{vid}` and use the authenticated user, never a caller-supplied user ID.
Weeks begin Monday at 00:00 UTC, independently of weekly-goal finalization. Reading never enters crown scoring.

- `GET /api/villages/{vid}/reading?week_start=YYYY-MM-DD`: default current UTC Monday;
  current/past Mondays only (422 otherwise). Returns a `ReadingShelf`; empty past weeks are valid archives.
- `POST /api/villages/{vid}/reading`: `{title, link?, author?, why?}` adds to the current week.
  Trimmed nonempty title <=180 chars; optional HTTP(S) URL <=2000, author <=120, why <=500.
  Any member may add; 10 items per village/week, atomically enforced (409 when full).
- `POST /api/villages/{vid}/reading/suggest`: explicit Mayor request, returns `{items: ReadingDraft[]}`
  with 1?2 suggestions from recent goals. Cached once per village/week, including an offline fallback;
  concurrent requests share the cached generation. Suggestions do not add items automatically.
- `POST /api/villages/{vid}/reading/{item_id}/complete`: `{takeaway?: string}` (<=280 chars).
  Durable completion per user/item. Repeats return the existing completion without editing its takeaway,
  re-awarding, or duplicating feed events. First five completed items per user/village/week each earn
  +5 XP and +5 coins; later completions still record the read with `awarded:false`.
  Source key `reading:{item_id}:{user_id}`; the existing XP-to-coins trigger credits coins once.
  Unknown/wrong-village item: 404. Past-week completion: 409. Returns updated `ReadingShelf`.

`ReadingShelf = {week_start, read_only, awarded_count, items: ReadingItem[]}`.
`ReadingItem = {id, village_id, week_start, user_id, title, link, author, why, created_at, readers: Reader[]}`.
`Reader = {item_id, user_id, takeaway, awarded, activity_id, id, created_at, reactions}`;
`id` aliases `activity_id` for the existing reaction aggregate. Each reader's portrait/name comes from
village membership data. Item author `user_id` becomes null if that account is deleted; the shared
item and other readers remain. Readers retain their takeaway; no uncheck/delete/edit endpoint is provided.

Every completion emits `reading_completed` with `{item_id,title,week_start,bonus_xp}` and feed text
?X finished reading Y?, and appears in `/accomplishments`. Existing activity reactions accept its
`activity_id`. Adding/removing reactions to archived reading completions returns 409; existing reactions
remain visible. Prior weeks are read-only everywhere, including via the general reaction route.
Weekly review responses add `reading_bonus: [{user_id,completed,xp}]` for all readers (including members
without goals and auditors). These counts and earned XP/coins are informational, outside crown scoring.

## Village overworld (FEAT-023, replaces FEAT-021 movement relay)

`WS /api/villages/{vid}/live`: accept, then authenticate within 10 seconds with
`{"X-Demo-User":"<seat UUID>"}` or `{"Authorization":"Bearer <Auth0 token>"}`,
like house live. Members only; policy failures close 1008.
Server first sends `{"type":"snapshot","players":[...]}`. Client movement is
`{x:number,z:number,heading:number,moving:boolean,running:boolean,emote?:"wave"|"cheer"|"spin"|null}`.
Coordinates are unscaled town coordinates (render scale .55); heading is radians.
Send only changed state, at most 10 Hz, including a final moving:false/emote:null.
Server sends peers `{"type":"movement","user_id":"<authenticated seat>","seq":1,...movement}`;
sequence increases while a village room is connected; a fresh snapshot starts a new epoch. Snapshot entries have the
same shape. Server clamps town envelope and speed (7 units/s plus .25 jitter).
Frames >1024 characters or invalid fields close 1008; excess rate is dropped.
No XP, provider calls, or database writes occur. State is process-local and expires
after five seconds of silence; disconnect sends `{"type":"leave","user_id":"..."}`.
Newest connection for a seat replaces the old one. Receivers buffer 100ms, extrapolate
at most 200ms, then blend back to ambient behavior on stop/expiry. Idle sockets send
no application heartbeat; membership is rechecked every 30s. Reconnect with backoff.
This movement shape is reusable by FEAT-022; interior routing is separate.

### Interior avatar movement (FEAT-022)
After authentication on `/api/houses/{uid}/live?vid=...`, clients may send
`{"type":"movement","x":0,"z":3.25,"heading":3.14159,"moving":false,"running":false,"emote":null,"floor":0}`.
Coordinates are room-local units in [-3.75,3.75]; heading is radians in [-pi,pi],
facing +z at zero; floor is an available integer storey (0-2).
Server broadcasts the same shape plus authenticated `user_id`, `name`, and
`client_id` over the existing house LISTEN/NOTIFY channel. Client-supplied identity
is ignored. Updates are capped at 10 Hz per connection; excess messages are
dropped and invalid positions receive `movement_rejected`.
Positions are ephemeral: no furniture revision, history, XP or durable writes.
Clients periodically repeat their latest position to hydrate late joiners, preserve
positions across presence heartbeats, and remove departed peers via presence_list.
Visitors may move; existing private-house edit authorization is unchanged.
Reuses FEAT-021 x/z/heading/moving/running/emote with the interior floor extension.
Interiors currently send running:false and emote:null. The authenticated house
channel supplies routing; town sequence buffering and speed limits stay town-specific.

The former ephemeral movement/leave transport is superseded by the durable
snapshot/delta protocol below. Deploy the API and web client together. House
interior transport remains separate. Legacy bare movement input is accepted,
but old snapshot/movement/leave output is no longer emitted.

### FEAT-023 authoritative village overworld

`WS /api/villages/{vid}/live` authenticates with the first JSON message containing
`Authorization` or `X-Demo-User` (demo mode only). Optional `world_version: 2`
identifies current clients. Membership is required at connect, on every intent,
and every 30 seconds. Presence SSE/heartbeats are unchanged. Run one API process
(`uvicorn --workers 1`); multiple independent API workers require a shared reducer
coordinator before horizontal deployment.

The initial message is `{type: "world_snapshot", world_seq, server_time, avatars}`.
`server_time`, `since`, and `until` are Unix seconds. Each avatar contains
`user_id`, `mode` (`idle|walking|attraction|seated|emote|following|home`), `x`, `z`,
`heading`, `since`, `seq`, and optional `attraction_id`, `slot`, `seat_id`, `emote`,
`target_user`, `until`. Render hints include `activity`, `elevation`, `running`;
autopilot journeys additionally persist `destination` and `route`. Coordinates
are authored town metres, before the renderer's 0.55 scale.

After committing a change, the server sends
`{type: "world_delta", from_seq, world_seq, server_time, avatars}` to **all**
clients, including the actor. Batches coalesce each avatar's latest state over
50ms. `from_seq` is the receiver's prior world sequence; intermediate avatar seq
values may be skipped by coalescing. Apply only if `from_seq` equals the client's
world sequence; otherwise send `{type: "resync"}` and replace state with the full
snapshot. Membership changes also replace the snapshot. Disconnect freezes the
last known state; reconnect restores a snapshot. No local live-mode autopilot.

Send `{type: "intent", request_id, action, ...fields}`. Request IDs are 1-96
characters, scoped to village + authenticated user. Accepted requests are stored
for 24 hours and repeated identical requests return the original result without
reapplying; a reused ID with different fields is rejected. Clients retry unacked
non-movement intents after reconnect using the same ID. Result:
`{type: "intent_result", request_id, ok, world_seq? , error?}`. Reducer rejections
keep the socket open; malformed framing/floods and denied membership close 1008.

| action | fields | behavior |
|---|---|---|
| `move` | `x,z,heading,moving`, optional `running` | finite bounded coordinates; server clamps travel to 7 m/s plus 0.25m tolerance; 20s control lease |
| `join_attraction` | `attraction_id` | allocates the first free slot; validates unlocks and closures |
| `drop` | `attraction_id`, optional `user` | same allocation; user must be the authenticated user |
| `sit` | `seat_id` such as `storefront_cafe:0` | reserves that exact chair; conflicts reject |
| `leave_attraction` | none | clears seats/rides/follow; idles for 20s |
| `emote` | `kind: wave|cheer|spin` | synchronized three-second emote |
| `follow` | `user` | follows another village member for 120s; invalid/self targets reject |

Capacities: cafe 6, study 12, fountain benches 3, festival 24, wheel 10, fitness 8;
other ordinary attractions 12; Mayor gathering 100. Attraction leases last 120s,
except the wheel (two revolutions, ~104.72s). Manual leases survive disconnects.
The per-village 1Hz tick exists only while any socket is connected. WEB-024's
600-second schedule, 137-second member stagger, 90-second home visit, cafe cohorts,
festival weather and Mayor gathering are evaluated once on the server. The seed
and catalog determine identical addresses. Capacity overflow returns home. The
server reserves destinations while walking, and clients interpolate movement.
Dancing/emotes use `since`; wheel geometry uses server wall time and assigned cabin.
Clients send `{type: "ping", client_time}` every 10s; the server replies
`{type: "pong", client_time, server_time}`. Use the lowest-RTT midpoint sample to
align animation clocks without treating delayed snapshots as clock drift.

At most 10 accepted intents/second/user across sockets; over 40 messages/second
or a frame over 2048 bytes closes the connection. At most one queued state/member
is retained for a slow client. Migration `056_overworld.sql` persists state,
sequence and idempotency in Postgres; startup loads state before accepting sockets.
Legacy bare FEAT-021 movement inputs are validated and routed through `move`;
legacy clients must upgrade to consume snapshots/deltas.


### FEAT-024: cached avatar voice barks

- `GET /api/villages/{vid}/barks` (member): returns `{user_id: {trigger: [audio_url, ...]}}`. Only current, consenting cloned voices with existing clips appear; other members have `{}`. Triggers: `walk`, `wave`, `cheer`, `spin`, `cafe`, `attraction`, `checkin`, `cheered`, `house`. This read never generates audio.
- `GET /api/barks/{uid}/{line_id}` (self/shared-village peer): returns cached MP3 with `Cache-Control: private, no-store`. Consent and current voice are checked on every request. Missing/revoked clips return 404; non-peers return 403. Raw hashed bark asset keys are not public asset URLs.
- Town movement messages optionally include `activity: "cafe" | "attraction" | null` (default null). Same authenticated sender, rate limit, sequence and fanout as FEAT-021 movement; informational only, with no reward or generation authority. Old clients may omit it.
- Voice-barks listening preference defaults on and is stored per user on the browser device. No user schema migration.
- Generation is an explicit operator CLI only: `python -m uv run python scripts/generate_barks.py --village <uuid> --max 3` from `apps/api`. Selects three immutable lines per trigger, caches by SHA-256 of `(voice_id, line_id)`, returns generated/cached/remaining/failed/capped/characters counts. Uses the shared asset directory and SEC-001 daily caps.

## FEAT-026: iMessage gameplay

Both service-authenticated inbound endpoints use the same web domain functions and SEC-001 caps.
No schema migration is needed beyond the existing inbound/evidence tables.

| Text | Action |
| --- | --- |
| `check in: <note>` / `daily: <note>` / `checkin: <note>` | Daily note with normal UTC daily award deduplication. The legacy `checkin:` **photo** alias retains automatic evidence routing described above. |
| `progress: <update>` + optional photo | Progress on the current weekly goal or active stretch. Explicit photo routing takes priority over competitions; existing AI pre-check runs. |
| `goal: <title>` | Set/replace this week's goal (200 characters). Retitling resets status; finalized weeks and existing stretch rules apply. |
| `stretch: <title>` / `go beyond` | Start the next stretch tier using web eligibility rules (title: 140 characters). |
| `challenges` | Open village competitions with eight-character UUID codes. Ambiguous prefixes are rejected; full UUIDs work. |
| `join <code>` | Show terms, lamports intent and auditor fee; `Y` accepts, `N` cancels. Revalidate terms and eligibility before joining. No signing or payments. |
| `enter <code>: <update>` + optional photo | Submit an entry; opt-in and audited-photo requirements apply. Include `value=5` for numeric scoring. |
| `status` | Today's daily check-in state (UTC), goal/status, streak, XP and coins. |
| `help` | Six-line command menu. |
| `STOP` | Disable Mayor messages and Villager-grams; clear pending gameplay confirmation. Takes precedence over attached photos. |

Natural phrasing uses the existing bounded JSON Mayor classifier and generation budgets.
Inferred writes always ask for Y/N, including photo captions. One pending gameplay confirmation
per sender is stored durably in a reserved inbound_messages receipt (`play-confirm:<user UUID>`),
expires after ten minutes, and is consumed transactionally. A new proposal replaces the previous
pending confirmation. Confirmations bind the selected village and goal identity/title/status;
changed goals require a new update. Unknown/unlinked senders retain invite guidance. Plain
conversation stays Mayor chat. A captioned photo is one action, never a separate text award.
Expected domain rejections return an explanatory reply with processed_checkin=false; security
caps remain HTTP 429. Caller message IDs starting `play-confirm:` are reserved and rejected.
Agent retries retain stable IDs, so recorded effects and cached replies remain idempotent.
Replies report actual immediate XP and coin deltas; evidence approval can award rewards later.


## FEAT-027: confirmed devnet pots, payout modes and Treasury

Supersedes the earlier SOL-intent-only behavior. No server wallet or sender exists.
All SOL actions verify devnet genesis. Full policy and runbook: docs/solana/FEAT-027.md.

Competition creation adds payout_mode (winner_take_all/proportional/ranked),
ranked_bps (ranked only: 1-10 positive integers totaling 10000), entry_coins
(0-1000000, mutually exclusive with SOL), and timezone-aware deadline (mandatory,
future for SOL). SOL auditor fees are at most 2000 bps. Terms cannot change after
creation. Friendly competitions cannot stake either currency.

Details add chain_config, pot_address, chain_status, settlement_snapshot, and
projected_payouts:{currency,fee,refund,payouts:[{user_id,amount}]}. Monetary values in
projections are integer strings. Participants add wallet_address, joined_at,
chain_join_index. SOL order comes from the program, not receipt arrival time.

Winner-take-all pays the first joiner among tied highest positive scores.
Proportional pays score percentages. Ranked sorts positive scores descending,
breaking ties by join order, and renormalizes unoccupied places. Fee and payouts
are floored; dust goes in join order to positive-weight recipients. No positive
scores means coin refunds or SOL refunds 72 hours after deadline. Ordinal uses
finishing rank; other scores use six-decimal fixed point. u64 overflow is rejected.

Direct competition join/settle endpoints reject SOL (409); use verified wallet
receipts. Coins debit once at join and pay/refund atomically on settlement.
Preparing SOL settlement freezes scores. Results retain winners/scores and set
payments_executed true only for recorded coin payments or verified SOL payouts;
SOL results also include signature and payouts.

Member-authenticated routes under /api/villages/{vid}:
- GET /treasury: {cluster:'devnet',enabled,destination,lamports_per_xp:'100000',daily_cap_xp:1000,used_xp}.
- POST /solana/intents: {action:'treasury'|'create'|'join'|'settle'|'refund',wallet,competition_id?,auditor_wallet?,xp?:1..1000}.
  Returns {id,wallet,action,instructions,metadata,created_at,expires_at,...}.
- GET /solana/intents: latest 20 intents for this member and village.
- POST /solana/intents/{iid}/confirm: {signature}; returns {confirmed:true,signature,xp_awarded}.

Instructions are {program,accounts:[{address,role}],data}, with Kit AccountRole
values and base64 data. Exact operation plus signer-bound memo UUID are stored.
Create requires the creator; settle the assigned auditor and original wallet;
join pins the member's first entry wallet; any member may request eligible refunds.

Browser simulates unsigned, shows review, then signs/sends on a separate approval.
Signature is saved before broadcast and linked to devnet Explorer. Verification
retry never pays again. API uses confirmed getTransaction with version support 1,
checks genesis/success/signer/exact instructions/memo/block time, and has globally
unique signatures and locked intents. Same-signature retries award zero new XP.

Treasury: 0.01 devnet SOL = 100 personal XP, cap 1000/account/UTC intent date across
villages. Preparations reserve that day's allowance even if abandoned. Instructions
expire after ten minutes; timely payments can be verified later. Only confirmed
receipts award treasury_devnet XP, exposed as Villager.treasury_xp. No coins or
shared village XP. Other XP sources retain the normal coin-mirroring trigger.
Auditor candidates receive one ticket plus one per 100 personal XP, capped at 11;
Treasury counts and rotation/sit-out rules remain unchanged.

Runtime settings from VILLAGE_ENV_FILE: SOLANA_PROGRAM_ID (approved v2 deployment),
SOLANA_TREASURY_ADDRESS, optional SOLANA_RPC_URL (default public devnet). Missing
configuration disables that paid action; fixture/free play remains available.


## FEAT-028: disaster repair plans

New `world.disaster` payloads include `repair_plan`:
`{tasks:[{kind,title,target,progress}],reasoning,model,example}`.
There are 2-3 distinct tasks. Kinds: `hangout`, `checkins`, `workout_together`,
`study_session`, `cook_together`, `call_a_friend`, `help_a_neighbor`.
Integer targets: 1-6. Titles: at most 100 characters. Public rationale: at most
800 characters. Plans never set rewards. Every task must meet its target before
repair. Existing disasters without a plan retain rolling 48-hour check-in rules.

`POST /villages/{vid}/check-ins` accepts optional `repair_task` from the active
plan. A tag requires `evidence_asset_id`; the server binds it to the active
`repair_event_id`. Responses expose both fields. Only verified photo evidence
advances that task. Reusing an asset does not advance the same task twice.
Photo task progress persists until repair, including after the initial deadline.
Shared activity photos must show at least two participants. Existing owner review
overrides allow approval when vision is offline. Plans and public rationales are
logged as `agent_decision` / `repair_plan`.

`POST /lab/repair-plan` accepts only `{kind: "scorch"|"outbreak"|"blackout"|"blight"}`.
It streams newline-delimited JSON status messages, followed by `{status,plan}`.
Statuses describe public workflow stages, not private model reasoning. The first
status reports the requested model; the plan reports the actual provider model.
It uses a fixed synthetic group (four recent updates), needs no database lookup,
and writes no database or assets. SEC-001 global/IP/anonymous-seat daily LLM caps
apply to each physical provider attempt. Offline, invalid or capped generation
returns a labelled example. Only an explicit Ask the Mayor click calls it.

Automatic disaster detection uses a deterministic plan; village reads never start
paid generation. Explicit debug disaster creation may ask the configured Mayor
adapter, with provider fallback. The Lab never changes any village.

## FEAT-029: optional Auth0 seat claiming

Demo and Auth0 coexist when DEMO_AUTH=1. Authorization takes precedence over
X-Demo-User; invalid bearer tokens never fall back to demo authentication.
GET /me maps a linked Auth0 issuer/subject to its existing seat ID. All HTTP and
WebSocket authorization uses that same ID. Unlinked identities use onboarding.

POST /auth/claim-seat requires a valid Auth0 bearer token. Body:
`{"village_id":"uuid","code":"uuid.random-secret"}`. Success (200):
`{"user_id":"seat uuid","village_id":"uuid"}`. The next /me returns that seat.
400: invalid, used, expired, or wrong-village code. 401: no valid Auth0 identity.
409: account already linked/has membership, or seat already linked. Codes are
operator-issued, SHA-256 hashed at rest, valid for 72 hours, and consumed atomically.
Issuing another code for a seat revokes its previous codes. One account per seat;
claiming preserves all seat-owned data. No automatic merging or reassignment.
