---
id: DEMO-002
owner: codex (gpt-6-astra, medium)
branch: demo/DEMO-002
allowed_paths: [tests/demo/**, docs/submission/video/**]
---
# DEMO-002 — Full feature demo video v2 (for the team to review today)

Build on DEMO-001's capture pipeline (tests/demo/*, docs/submission/video/*). Record against the local preview
http://localhost:4173 (real API :8010, demo village "Hacklanta Crew"; GPU worker + bridge are running). Headed Chromium,
1920×1080, captions as an injected overlay, ffmpeg mux (check `ffmpeg -version`). Target 3:00–3:30 (a longer "feature
tour" cut for the team) plus a 2:30 "judges" cut from the same footage. Outputs: `data/demo/village_demo_v2_full.mp4`,
`data/demo/village_demo_v2_judges.mp4`, 10 stills in `data/demo/v2_stills/`, and a chapter list (timestamps) in the report.

Chapters (show each feature actually working; never fake UI):
1. The town: rectangular village fly-over, day → night (festival lights, dancing), villagers with generated heads + outfits.
2. **How avatars are made (CV pipeline)**: full-screen interstitial slides built from the real artifacts in
   `C:\Users\mourn\Downloads\hacklanta\data\` — cv002 (LAM head strips), cv003/cv004 contact sheets (photo → Gemini stylized
   → Hunyuan3D head → villager), cv006 (photo → wearable swatch / 3D decoration), plus `data/assets/villages/*/group/*`
   SAM 3 group-photo crops if present — animated with simple pans/fades + captions naming the models (SAM 3, LAM,
   Audio2Expression, Gemini 2.5 Flash Image, Hunyuan3D-2mini, RTX 5090 timings from docs/cv/*.md).
3. **Onboarding UI**: Village → "Our group photo" flow (use the existing finished group job in the demo village if listed;
   otherwise show the upload + consent screen and the crop-claim grid with mock-free real data where available), single-selfie
   avatar consent screen, Settings → voice clone consent (do NOT upload any audio).
4. Profile → LAM talking head + "Hear them" lip-sync (≤2 ElevenLabs calls total).
5. Check-in with evidence + AI auditor verdict (show the existing "suspicious" one), AI-at-work panel + Mayor memory.
6. Gazette, Mayor prayer (≤2 LLM calls) + bribe receipt, Week grading with AI pre-grade, crown ceremony, Compete +
   "Join pot with wallet" panel showing DEVNET program id (do not sign anything), Shop/Wardrobe equip, photo-item reward flow
   (show token gate / existing items), Inbox poke, sound on.
Don't reset the DB; don't create real users' content. Report: durations, file paths, chapter timestamps, and a bug list of
anything that looked broken on screen.
