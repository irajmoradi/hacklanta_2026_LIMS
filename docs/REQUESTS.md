# Teammate request tracker

Every Discord request gets a row. Status: `queued → in progress → review → live` (or `declined` with reason).
Progress updates are posted as replies to the requester's original Discord message. Ask the bot "status of R-xx" anytime.

| ID | From | Ask (short) | Task / agent | Status | Updated |
|---|---|---|---|---|---|
| R-01 | Iraj | Gazette crashed in browser | integrator fix (web adapters) | live | 10:30 |
| R-02 | Stefanny | Show clothes for feedback | integrator (images posted) | live | 10:05 |
| R-03 | Iraj | Demo video of all features | DEMO-002 (Codex) | live (v2 posted) | 10:35 |
| R-04 | Iraj | Week panel 530 error | tunnel blip, auto-recovered | live | 12:33 |
| R-05 | Iraj | Real face on villager | bake (GPU) | live | 12:40 |
| R-06 | Lance | Real face on villager | bake (GPU) + short-hair reroll | live | 12:50 |
| R-07 | Stefanny | Real face on villager | bake (GPU) | live | 12:52 |
| R-08 | Iraj | More honest Gemini stylize | integrator (prompt + cache version) | live | 12:50 |
| R-09 | Iraj | API cost so far in status | integrator (posted; now in every status) | live | 12:50 |
| R-10 | Lance | Profile pics next to names | WEB-015 (Codex) | live (+ face-check login UI) | 13:20 |
| R-11 | Stefanny | Villagers at own house, not stores | WEB-016 (Codex) | live | 13:25 |
| R-12 | Lance | See each user's avatar + cosmetics | WEB-016 (Codex) | live | 13:25 |
| R-13 | Lance | Voice clone | integrator (API /me/voice, ElevenLabs IVC) | live | 14:40 |
| R-14 | Iraj | Festival stage vs Mayor area too similar | ASSET-005 models + WEB-018 scene swap | live | 13:39 |
| R-15 | Iraj | Houses too similar; boring backs | ASSET-006 models + WEB-018 scene wiring | live | 13:39 |
| R-16 | Iraj | Voice clone from voice message | integrator (API /me/voice, ElevenLabs IVC) | live | 13:07 |
| R-17 | Stefanny | Idle activity picker + waypoint routing + nametag status badge | WEB-017 (Codex) | live | 13:58 |
| R-18 | Stefanny | Pets at the pet shelter | WEB-017 (Codex) | live | 13:58 |
| R-19 | Stefanny | Drag-pan / scroll-zoom map controls | WEB-017 (Codex) | live | 13:58 |
| R-20 | riemannzetafunction | WASD movement | WEB-019 after WEB-017 lands (same controls code) | live | 13:28 |
| R-21 | Stefanny | See others' accomplishments + emoji reactions | FEAT-001 (Codex) done → INTEG-001 batch merge | live | 13:16 |
| R-22 | Iraj | Villager-gram: friend's avatar/voice says custom line over iMessage (shop item) | FEAT-002 merged (dry-run); live sends need owner OK in terminal | live (dry-run) | 13:50 |
| R-23 | hello_world42 | Real face on villager (consented selfie) | bake (GPU subagent) → Mario (user 0005); shirt-color fix next | live | 13:21 |
| R-24 | Stefanny | Choose house colors (palette picker) | WEB-020 (Codex) done → INTEG-001 batch merge | live | 13:39 |
| R-25 | Lance | Destiny-style 3D villager showcase on profile, click cosmetic → details | FEAT-003 (Codex) done → INTEG-001 batch merge | live | 13:25 |
| R-26 | Lance | House showcase with decorations below villager | FEAT-003 (Codex) done → INTEG-001 batch merge | live | 13:25 |
| R-27 | Lance | Cosmetics only winnable via events/challenges | FEAT-003 (Codex) done → INTEG-001 batch merge | live | 13:25 |
| R-28 | Stefanny | Demo access + XP to test shop | integrator: +3000 XP to Stefanny in demo village (4120 total) | live | 13:27 |
| R-29 | Stefanny | Can't buy dog; show why items are locked | WEB-021 → INTEG-001 (cause: pets need Backyard first) | live | 13:31 |
| R-30 | Stefanny | House nameplates only on hover (clutter) | WEB-021 → INTEG-001 batch merge | live | 13:31 |
| R-33 | Iraj | HUD overlap: self-card vs bottom dock | WEB-021 → INTEG-001 batch merge | live | 13:37 |
| R-31 | Lance | Click equipped cosmetic on profile → buy it in shop | WEB-021 → INTEG-001 batch merge | live | 13:36 |
| R-32 | Iraj | Villagers stuck at stage / not moving | integrator hotfix: multi-day Mayor events pinned everyone; now 2 of 10 min | live | 13:36 |
| R-34 | Iraj | Per-teammate test seats + debug menu (XP, clear inventory) | FEAT-004 (Codex) done → INTEG-001 batch merge | live | 13:40 |
| R-35 | Iraj | Competitions as a Colosseum map (open/current views, click → evidence) | FEAT-005 (Codex) | live | 13:50 |
| R-36 | Stefanny | More outfits + choose clothing colors | FEAT-006 (Codex) | live | 13:50 |
| R-37 | Mario | Three currencies: coins / SOL / XP with icons | FEAT-007 (Codex), starts after INTEG-001 | live | 13:58 |
| R-38 | Iraj | Drag & drop your villager onto Ferris wheel etc. to ride | WEB-022 (Codex), after INTEG-001 | live | 14:01 |
| R-39 | Iraj | Portraits load slowly | WEB-023 done (2nd-load portraits 1.6MB→0, no zips on town load) → next merge batch | live | 14:13 |
| R-40 | Stefanny | Drag to rotate outfit preview | WEB-023 done → next merge batch | live | 14:13 |
| R-41 | Stefanny | Farm store + farm animals in a house paddock | FEAT-008 done → next merge batch | live | 14:40 |
| R-42 | Stefanny | Pigeons around the fountain | FEAT-008 done → next merge batch | live | 14:40 |
| R-43 | Stefanny | Cozy study nook in the park (picnic tables) + 📚 Studying activity | FEAT-009 done → next merge batch | live | 14:37 |
| R-44 | Iraj | Cosmetics floating on chest/neck with 3D head | FIX-004 (Codex) | live | 14:33 |
| R-45 | Stefanny | More idle activities: working out + gaming at home as extra options (keep Chilling at Home) | WEB-024 (Codex), after FEAT-009 | live | 14:28 |
| R-46 | Iraj | Villager-gram should include talking-avatar VIDEO | FEAT-010 merged; waiting on GPU renderer (cv/talk-video) | in progress | 14:31 |
| R-47 | Iraj | Shop item models look bad → art pass + nice thumbnails | ASSET-007 (Codex) | live | 14:34 |
| R-48 | Lance | Can't do goal progress check-in | cause: goal already done; hint UX in WEB-024 | live | 14:37 |
| R-49 | Iraj | How to test photo→object / onboarding / group photo | WEB-025 via INTEG-004 | live | 14:44 |
| R-50 | Stefanny | Voice clone | integrator (API /me/voice) | live | 14:43 |
| R-51 | Iraj | Where is the Villager-gram setting? → top-bar ⚙️ Settings | WEB-026 (Codex) | live | 14:47 |
| R-52 | Iraj | Settings UI ugly (overlapping labels, raw slider, stray checkbox) | WEB-026 (Codex) | live | 14:57 |
| R-53 | Iraj | Cosmetics still mis-fit on 3D head (headphones bucket, glasses forward, neck gap) | FIX-005 via INTEG-004 | live | 15:20 |
| R-54 | Iraj | Better avatar photo UI + camera input (multi-angle cancelled by owner 15:03) | WEB-027 done (camera-only) → INTEG-005 | live | 14:52 |
| R-55 | Iraj | iMessage: ask goals/competitions + send evidence photos | FEAT-011 (Codex) | live | 15:08 |
| R-56 | Iraj | Real materials (not just pastel) + per-level house options; shop round 2 | ASSET-008 done; sheets posted for 👍; next merge batch (+API fields) | live | 14:55 |
| R-57 | Iraj | Colosseum hard to find | superseded by R-58 (WEB-028) | declined | 14:59 |
| R-58 | Iraj | Compete = Colosseum-first (list/join/create in arena) + snappier animations | WEB-028 done → INTEG-005 | live | 15:00 |
| R-59 | Iraj | Varied trees/gardens; larger map, spread houses, less obvious grid | ASSET-009 live; WEB-029 done but 23 fps → perf pass in INTEG-007 | superseded by R-78 (rectangular kept bigger) | 15:02 |
| R-60 | Iraj | Shops/arcade/buildings look the same | ASSET-009 done → INTEG-005 (palette pass next) | live | 15:05 |
| R-61 | Iraj | Disasters (volcano, pet outbreak, revival potions) | FEAT-012 (Codex), after INTEG-003/004 | live | 15:05 |
| R-62 | Iraj | Profile is a confusing long scroll with emoji-ish icons | WEB-030 | live | 15:12 |
| R-63 | Lance | HUD cleanup: level/XP on profiles, remove self-card + Mayor dock button, move Around the Village, reorder dock | WEB-030 | live | 15:25 |
| R-64 | Iraj | Colosseum look better / more polished | ASSET-010 done; preview posted; merge after INTEG-005 | live | 15:38 |
| R-65 | Mario | Left widget dashboard (minimize/pop-out), auto-hide on zoom, fullscreen clean view | WEB-031 (Codex) | live | 16:20 |
| R-66 | QA-010 | Live bug hunt: intermittent 500s, slow API, mobile overlap, colosseum contrast, photo-token buy | FIX-006 (Codex) | live | 16:35 |
| R-67 | Iraj | Better ambient sounds (cicadas suck) | AUDIO-001 (Codex, ElevenLabs SFX ≤14 gens) | live | 17:13 |
| R-68 | Iraj | Performance pass | PERF-002 (Codex) | review (INTEG-015) | 17:13 |
| R-69 | Iraj | Outfit combos break (hoodie blob, floating glasses) — fix ALL combos | FIX-008 (Codex) + automated fit matrix | live | 17:15 |
| R-70 | Stefanny | Fence at farm store; walk-in Shop + Farm/Pet store interiors per sketches; cats/dogs/more pets | FEAT-013 (Codex) | live | 17:25 |
| R-71 | Stefanny | Pet pictures missing in store menu | FIX-009 (Codex): 74 priced items lacked thumbnails | live | 17:46 |
| R-72 | Stefanny | Wave looks weird, hand does not go up | FIX-010 (Codex) + cheer/dance emotes | live | 17:50 |
| R-73 | Iraj | Neighbor Rewards tab reads like viewer can get it; mojibake | WEB-032 (Codex) | live | 17:53 |
| R-74 | Iraj | Activity feed too long; group purchases; fewer reactions | WEB-032 (Codex) | live | 17:53 |
| R-75 | Iraj | 500 during API restart | FIX-011 (Codex): proxy 503 + client auto-retry; integrator batches restarts | live | 17:54 |
| R-76 | Iraj | Duplicate view toggles; auditor POV; scoring modes (scoreboard/ordinal/cumulative) | FEAT-014 (Codex) | live | 17:56 |
| R-77 | Mario | Night ambience sounds like a sprinkler | AUDIO-002 (Codex, ≤4 gens or procedural crickets) | live | 17:57 |
| R-78 | Lance | Revert organic map to rectangular grid, keep bigger | WEB-033 (Codex) | live (perf follow-up in PERF-002) | 17:58 |
| R-79 | Mario | Hats float above heads | FIX-012 (Codex) + seating checks in the outfit matrix | live | 18:01 |
| R-80 | Stefanny | Café outdoor seating (parasols, planters, string lights) | ASSET-012 (Codex) | live | 18:02 |
| R-81 | Iraj | Disasters look bad → pretty/cool cinematic VFX | VFX-001 (Codex) | live | 18:03 |
| R-82 | Iraj | Ugly overlapping toast ("Rebuilt!") → unified toast system | WEB-034 (Codex) | live | 18:04 |
| R-83 | Iraj | Tiger integration + house interiors + live shared furniture (BitCraft-style) | FEAT-015 (Codex) on Tiger service village-realtime | in progress | 18:06 |
| R-84 | Lance | White space/scroll below the dock | integrator CSS fix (page scroll locked) | live | 18:09 |
| R-85 | Iraj | Dashboard widgets all look the same; raw system rows | WEB-035 (Codex) | live | 18:09 |
| R-86 | Iraj | Cinematic check-in ("What did I do today?") + Mayor dialogue scene (options/bribe/rumours) | FEAT-016 (Codex) | review (INTEG-014) | 18:15 |
| R-87 | Iraj | Colosseum text too verbose | WEB-036 (Codex) | live | 18:15 |
| R-88 | Iraj | Disaster banner → minimize to ! badge in top bar | WEB-036 (Codex) | live | 18:15 |
| R-89 | Iraj | Zoomable Gaussian heads; make any face say silly things | FEAT-017 (Codex) | live | 18:19 |
| R-90 | Lance | Auditor shown in weekly review (should sit out) | FIX-013 (Codex) | live | 18:20 |
| R-91 | Iraj | Widget/badge icons feel emoji-like → custom icon set | WEB-037 (Codex) | live | 18:22 |
| R-92 | Iraj | Profile overview: accomplishments overflow + floating Profile settings | FIX-014 (Codex) | live | 18:21 |
| R-93 | Iraj | Remove AI-isms / Claude-isms from all copy | COPY-001 (Codex) | live | 18:21 |
| R-94 | Iraj | Lance renders with no body | FIX-015 (Codex, urgent) | live | 18:23 |
| R-95 | Iraj | Stretch goals: build on a done goal, go above & beyond | FEAT-018 (Codex) | review (INTEG-014) | 18:25 |
| R-96 | Lance | Coins/XP text misaligned in panels | integrator CSS fix | live | 18:41 |
| R-97 | Lance | Shop button: just the price, no repeated lock reason | integrator fix | live | 18:45 |
| R-98 | Lance | Try on cosmetics before buying | WEB-038 (Codex) | live | 18:47 |
| R-99 | Lance | Shop cards: no price in meta line, bigger text | integrator fix | live | 18:55 |
| R-100 | Iraj | GPU on Modal (~$30) for when the PC is off | MODAL-001 (GPU subagent) | live | 18:52 |
| R-101 | Iraj | Public deploy (stable URL) | VM + Caddy + reverse tunnel live at https://207-246-81-187.sslip.io; Auth0 callbacks added | live (phase 1) | 18:52 |
| R-102 | Iraj | Chorus UI bad; heads load after the voice line | FIX-016 (Codex, urgent) | live | 18:56 |
| R-103 | Lance | Sticky title + X in scrolling panels | WEB-039 (Codex) | live | 18:58 |
| R-104 | Iraj | Run agents heavy work on a big Vultr runner; more agents | INFRA-002 (Codex) + runner VM | in progress | 19:01 |
| R-105 | Iraj | Owner-only house editing; Community Hall for everyone (+SAM objects); multiple floors; polish interior UI | FEAT-019 (Codex), after INTEG-014 | live | 19:03 |
| R-106 | Iraj | Only one live head in the chorus | FIX-017 (Codex): pre-rendered talking videos for every head | live | 19:15 |
| R-107 | (team) | Devpost submission write-up + demo script | DOCS-010 (Codex) | in progress | 19:17 |
| R-108 | Iraj | Check-in cinematic: picking an option should commit (other option still clickable); make check-in UI look unique | WEB-040 (Codex) | live | 19:52 |
| R-109 | Stefanny | Clothing store door on left wall + rack not overlapping shelves; pet prices on checkout desk | WEB-041 (Codex) | live | 19:53 |
| R-110 | Iraj | Mayor cinematic: bigger/fill screen, Mayor + player on left, icons not emojis, village-health visual, polish all | WEB-042 (Codex) | live | 19:55 |
| R-111 | Iraj | Own profile says "Your neighbor" | integrator: header shows THIS IS YOU / Your profile when mine | live | 19:56 |
| R-112 | Iraj | Profile: buttons at bottom do nothing, cannot scroll | integrator: panel scrolls (Play was unreachable below line chips) | live | 20:00 |
| R-113 | Iraj | Trees/roads samey: procedural variety in roads, trees, hedges; vary house/store placement (keep rectangular) | WEB-043 (Codex) | live | 20:04 |
| R-114 | Iraj | Could the village scale to 100 people? | SCALE-001 (Codex): measure + fix bottlenecks | live | 20:04 |
| R-115 | Iraj | Sitting positions look wrong (café); double-click a location for hi-res close-up of place + people | WEB-044 (Codex) | live | 20:09 |
| R-116 | Iraj | While walking, own name tag covers body; highlight own avatar | WEB-045 (Codex) | live | 20:10 |
| R-117 | Iraj | House interior stuck on "Connecting…" | integrator: vite preview drops WebSockets; Caddy routes /api/houses/*/live to API via 2nd tunnel (:8090) | live | 20:14 |
| R-118 | Iraj | Move everything to cloud (VM + Tiger), Modal as only GPU (no 5090) | integrator cutover after SEC-001 (awaiting terminal confirm for keys) + MODAL-002 (GPU subagent) | live (cutover 20:42) | 20:15 |
| R-119 | Stefanny | Goal shows completed though never completed | integrator: retitling kept the seeded done status; fixed (new title resets status), her goal reset | live | 20:35 |
| R-120 | Stefanny | Library weekly reading list, check off for XP | FEAT-020 (Codex) | live | 20:35 |
| R-121 | Stefanny | Not interactive with friends; help navigating; where are accomplishments | WEB-046 (Codex) | live | 20:35 |
| R-122 | Stefanny | Shoes and pants with colors, more glasses | ASSET-013 (Codex) | live | 20:35 |
| R-123 | Stefanny | Color/house editing: preview scrolls out of view | WEB-047 (Codex) | live | 20:35 |
| R-124 | Lance | Selecting an owned house item in own profile shifts whole site up ~1/3 | integrator: scrollIntoView scrolled the page; now scrolls only the panel (verified 256px→0) | live | 21:08 |
| R-125 | Lance | Shop X: only bottom third of the hitbox closes the shop | integrator: Edge F11 fullscreen toolbar swallows clicks in the top ~48px; shop header padded in fullscreen (X y 16→56) | live | 21:12 |
| R-126 | Mario | Check-in: all options open the old form; each should do its own thing; move Add proof into Daily note + Goal progress; keep Not now | WEB-048 (Codex), queued after WEB-040 merges | live | 21:15 |
| R-127 | Mario | House customization in profile: track unsaved changes + Undo button | WEB-049 (Codex) | live | 21:25 |
| R-128 | Stefanny | Add more trees; WEB-043 removed most, looks random/unnatural | WEB-050 (Codex) | live | 21:40 |
| R-129 | Mario | Top bar relayout (Settings/Inbox order, drop Play-as + connected icon, fullscreen/speaker below), Create village button, neighbors count + conveyor + members list | WEB-051 (Codex) | live | 22:10 |
| R-130 | Iraj | Sync movement/position so everyone sees others walking in town | FEAT-021 (Codex) | live | 22:35 |
| R-131 | Iraj | Interiors: see own + others avatars, walk, go upstairs | FEAT-022 (Codex) | live | 22:35 |
| R-132 | Iraj | MORE trees (denser forest groves) | integrator tuning on WEB-050 placement | live | 22:35 |
| R-133 | Iraj | Switch LLM to Gemini API, cheapest model, instead of DeepSeek | integrator: LLM_PROVIDER=gemini, GEMINI_MODEL=gemini-2.5-flash-lite (cheapest available on the Vertex key) | live | 22:50 |
| R-134 | Iraj | Snazzy launch trailer (Remotion) | TRAILER-001 (Codex) | v1 done, v2 in progress | 22:53 |
| R-135 | Iraj | GitHub repo setup: dense high-IQ README explaining the entire architecture | DOCS-012 (Codex) + pre-publication history audit | live (docs merged; publication decisions pending) | 22:57 |
| R-136 | Iraj | Sync everything in the overworld (dancing, attractions, seats, idle positions), BitCraft style | FEAT-023 (Codex): server-authoritative avatar state + reducers | live | 23:25 |
| R-137 | Iraj | Gazette shows raw ids (farm_store…) and "fallback:gazette-v1" | integrator: cached pre-Gemini fallback (DeepSeek ValidationError 20:02); fallback now uses names; regenerated with Gemini | live | 23:30 |
| R-138 | Iraj | Reframe trailer + Devpost: AI automates getting people together; Solana economy, Gemini Mayor, ElevenLabs+CV avatars, iMessage IRL loop; slick startup launch film | TRAILER-002 + DOCS-013 (Codex) | in progress | 23:35 |
| R-139 | Mario | Neighbors strip: one stylized pill (icon + count + pfps), not a white box | integrator CSS | live | 23:58 |
| R-140 | Mario | Top-right overlap: emote into tool row; camera hint bottom-center above dock; Community Hall above neighbors | integrator CSS | live | 23:58 |
| R-141 | Iraj | Remove "Your friends. One village." text overlay | integrator: visually hidden (kept for screen readers) | live | 00:00 |
| R-142 | Iraj/Mario | Voice line chips do nothing; Reconnecting toast spam; profile X hidden under tool row | integrator: chips speak on click; realtime evicted shared-seat tabs (reconnect loop ~1/s) now per-connection; toast debounced 2.5 s; tool row shifts off profile; HEAD on assets | live | 00:10 |
| R-143 | Mario | Friends above Community Hall (bottom right); Gazette under Village button; Mayor updates inside Mayor | WEB-052 (Codex) | live | 00:12 |
| R-144 | Iraj | Random cloned-voice lines when avatars do things | FEAT-024 (Codex), bounded cached batch | live (clips need one-time generation) | 00:12 |
| R-145 | Lance | Dashboard: full-height left column; Reading list / Everyone says it / Accomplishments buttons inside the dashboard top | integrator, right after WEB-052 (same area) lands | review (deploying) | 00:16 |
| R-146 | Lance | Generated head not attached to neck (floats forward) | FIX-022 (Codex) | live (89e6cd0) | 00:18 |
| R-147 | Iraj | Connect floors into one space; stairs labelled Downstairs but model goes up | FEAT-025 (Codex): stacked dollhouse floors + continuous stairwell | live | 00:20 |
| R-148 | Mario | Drag-to-pan hint top-right when profile open; too faded | integrator: hidden while a profile is open; darker text on a light pill | live | 00:22 |
| R-149 | Lance | Walking highlight discolors the villager; only the ring should glow | integrator: removed body tint, ring only | live | 00:24 |
| R-150 | Iraj | Colosseum headline over the arena; move above | integrator CSS | review (deploying) | 00:27 |
| R-151 | Iraj | Full sync feels laggy; find a compromise | FIX-023 (Codex): client prediction + reconciliation, ≤100 ms interp, faster fan-out | live | 00:31 |
| R-152 | Lance | Mayor menu: bring back Mayor Plaza 3D backdrop + bobbing camera | WEB-053 (Codex): WEB-042 layout as overlay over live plaza zoom | live (89e6cd0) | 00:36 |
| R-153 | Iraj | iMessage: daily check-in, weekly goal, challenge tasks by text | FEAT-026 (Codex) | live (89e6cd0) | 00:44 |
| R-154 | Iraj | Feed "shared evidence" click does not show the evidence | integrator: feed rows with evidence show the photo inline, click opens full | live | 00:44 |
| R-155 | QA-013 | P1: outage blanks app (toast showPopover throws); P1: Bottoms/Shoes empty in prod (catalog never synced) | integrator: guarded popover; ran catalog sync on prod + added to deploy migrate step | live | 00:50 |
| R-156 | Iraj | Trailer v3: Iraj face → avatar → Gaussian splat, voice clone, shop + pet shelter + many features, faster | TRAILER-003 (Codex) | done (v3 delivered) | 00:58 |
| R-157 | Mario | Feed: click entry to open it (e.g. competition entry); remove "See their accomplishments"; title + subtitle instead of cut-off text | WEB-054 (Codex) | live (89e6cd0) | 01:00 |
| R-158 | Iraj | Villager-gram must arrive with video | integrator + GPU agent: Modal renders now extend the delivery deadline; caps raised for demo; video gram delivered 01:02 ET | live | 01:03 |
| R-159 | Lance | Remove Everyone says it + Reading list from dashboard; Accomplishments to bottom-right stack (below Hall, above neighbors) | integrator; dashboard now full-height (R-145) | review (deploying) | 01:13 |
| R-160 | Lance | My goal stretch form spacing | integrator CSS | live (0bafba8) | 01:14 |
| R-161 | Iraj | Movement still laggy; toast "validation error for Intent activity" | integrator: barks client sends activity, overworld Intent rejected it -> every move rejected; field accepted | live (0bafba8) | 01:15 |
| R-162 | Lance | Gazette headline card overlaps button in Village growth | integrator CSS | live (89e6cd0) | 01:27 |
| R-163 | Mario | Clone my voice (consented) | already saved via Settings, verified in DB | live | 01:27 |
| R-164 | Iraj | Festival Lights strand lying on the floor | integrator: poles + raised strand | live (89e6cd0) | 01:40 |
| R-165 | Iraj | AI-driven villagers walk jittery (live players fine) | integrator: buffer one 1 Hz server step on the client | live (89e6cd0) | 01:40 |
| R-166 | Iraj | Solana polish: SOL to XP shop for auditor, working SOL entry, payout modes (winner/proportional/ranked split) | FEAT-027 (Codex) | live (86bc24e) | 01:40 |
| R-167 | Lance | Bring back the welcome text under the logo (above the dashboard) | integrator CSS: dashboard top back to 195px | live | 01:47 |
| R-168 | Lance | Inbox messages have no timestamps | integrator: time of day on each message | live | 01:48 |
| R-169 | Iraj | Hidden judge Demo Lab: onboarding (new + join), interactive image→avatar and object→mesh pipeline, 50–100 person town, disasters, level 1→max futures | WEB-055 + WEB-056 (Codex) | live (86bc24e) | 01:50 |
| R-170 | Mario | Short feed entries: title only, no subtitle repeating it | integrator: drop redundant subtitles | live | 01:53 |
| R-171 | Iraj | Use the newest Flash-Lite instead of 2.5 | integrator: gemini-3.5-flash-lite (newest on the key; 3.6 not available) | live | 01:51 |
| R-172 | Iraj | Vertical "placeholder face" text over Colosseum challenge cards (trailer 0:37) | integrator CSS: label only on large portraits | live (51d4744) | 02:09 |
| R-173 | Iraj | Trailer v4: real iMessage, updated Mayor, longer voice clip, >1 min, clearer avatar + splat, item generation, pets, synced walking, interiors + TigerData persistence | TRAILER-004 (Codex) | delivered (v4, 94 s) | 02:09 |
| R-174 | Iraj | AI-controlled Stefanny walking in place | integrator: pet walk is a continuous loop, not corner jumps every 120 s | live | 02:14 |
| R-175 | Iraj | Demo Lab big town: fully rendered houses, better spread-out layout | WEB-057 (Codex) | live (86bc24e) | 02:17 |
| R-176 | Iraj | Disaster repair via Mayor-chosen custom tasks (hang out together, etc.) with visible reasoning; Lab "Ask the Mayor" | FEAT-028 (Codex) | live (86bc24e) | 02:20 |
| R-177 | Iraj | Trailer in two lengths: ~3 min and 1.5 min | TRAILER-005 (Codex), queued after TRAILER-004 | delivered (2:48 + 1:30) | 02:28 |
| R-178 | Iraj | README setup for every service + Devpost write-up | DOCS-014 (Codex) | done | 02:29 |
| R-179 | Iraj | Auth0 sign-in for the team + two judge accounts on two laptops (persistent synced world) | FEAT-029 (Codex): own Auth0 accounts + single-use seat claim codes (no passwords shared) | deployed hidden (owner switches on) | 02:33 |
| R-180 | QA | QA-015 residuals: mobile Lab labels, mobile Gazette access, duplicate title, Gazette casing, clipped Lab notice | WEB-059 (Codex) | live (bff8e8b) | 05:28 |
| R-181 | Lance (found via screenshot) | Around the village showed "No activity yet": scheduler no-op ticks (~20/h) filled the feed window | integrator: feed query skips scheduler no-ops | live (cfe97d3) | 06:58 |
| R-182 | Lance | Dashboard scrollbar looks ugly; match the theme | integrator CSS: thin sage scrollbar, no arrows | live (cfe97d3) | 06:58 |
| R-183 | Iraj | When the AI walks *my* villager it still jumps around | integrator: own villager uses the buffered track while server-driven; median gap | live | 07:06 |
| R-184 | Iraj | Repair tasks must be real-life actions (voice call 30 min, exercise 30 min, read a news article), not in-game chores | integrator: fixed IRL titles per task kind; Mayor picks kinds/targets only | deploying | 07:15 |
