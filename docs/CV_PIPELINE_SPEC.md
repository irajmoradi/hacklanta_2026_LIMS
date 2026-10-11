# Village Avatar CV Pipeline Spec (text export of the .docx, Oct 9 2026)

Village Avatar CV Pipeline Spec
Oct 9, 2026 · @Iraj Moradi
TL;DR
Build the WOW path first: SAM 3 cuts each friend out of the photo, LAM turns their face into a talking 3D head, and Audio2Expression lip-syncs it to their ElevenLabs voice. Then build the MVP path, which turns each cutout into a stylized, rigged, walking villager with TRELLIS 2 and UniRig. Both run on one Vultr L40S (48 GB, $1.67/hr on demand) as a single FastAPI GPU server.
Stage
Model
Source
License
Output
Speed (reported)
Used in
Segment people + clothing
SAM 3
Meta
SAM License, gated HF
Instance masks from text prompts
~30 ms per image on H200
Both
Talking head
LAM (LAM-20K)
Alibaba Tongyi
Check repo
Animatable Gaussian head (FLAME)
1.4 s
WOW
Audio to face motion
LAM Audio2Expression
Alibaba Tongyi
Check repo
Expression coefficients per frame
Real time
WOW
Body proportions
SAM 3D Body
Meta
SAM License, gated HF
MHR rigged body mesh, GLB/BVH
Seconds
WOW (stretch)
Stylize crop
Gemini image editing
Google API
API terms
Front-facing chibi T-pose image
Seconds
MVP
Image to mesh
TRELLIS 2
Microsoft
MIT
Textured GLB with PBR
~1 to 3 min
MVP
Auto-rig
UniRig
VAST / Tsinghua
Permissive
Skeleton + skin weights, rigged GLB/FBX
~53 s on A100
MVP
Backup mesh
Hunyuan3D 2.1
Tencent
Tencent community license
Textured GLB
Minutes
MVP fallback
Build order: SAM 3 server, then LAM head + voice demo, then TRELLIS 2 + UniRig villagers, then SAM 3D Body proportions if time allows.
avatar pipeline · SAM 3 splits into WOW and MVP lanes
SAM 3 runs once and feeds both lanes. Clicking a walking villager opens that person's talking head.
Stage 0: Segmentation and identity (shared)
SAM 3 runs once per uploaded photo and feeds both pipelines. Its text-prompt mode (Promptable Concept Segmentation) returns every instance of a noun phrase, so no clicking is needed.
Input: one group photo, plus one optional selfie per person (strongly recommended, it makes every downstream model better).
Load sam3 image predictor once at server start, keep it on GPU.
set_text_prompt("person") on the group photo. Keep masks with score above 0.5 and area above 2% of the image.
For each person mask, crop the bounding box with 10% padding, composite onto a white background, save as person_{i}.png.
Run SAM 3 again on each crop with prompts "face", "hair", "shirt", "pants", "shoes". Save each mask and the median RGB of its pixels to traits.json.
Face crop: take the "face" mask box, expand 1.6x to include hair and chin, resize to 512x512. This is the LAM input.
Identity: return all crops to the frontend. Each user taps "this is me" during onboarding. Store user_id → crop_id.
If a selfie exists, use it instead of the group crop for the face (higher resolution, frontal).
Outputs per user: full_body.png, face_512.png, traits.json (hair, shirt, pants, shoes colors), masks.
Demo talking point: one model, used three ways: instance segmentation of the group, part segmentation for clothing colors, and face extraction for the head model.
WOW pipeline: talking 3D heads (build first)
Clicking a villager opens their profile card with a photoreal 3D head of the real person that speaks in their cloned voice. This lives in the profile panel, not the village, so photorealism is fine there.
A. Head generation (once per user, ~2 s GPU)
Input face_512.png from Stage 0.
Run LAM-20K inference (huggingface-cli download 3DAIGC/LAM-20K). It internally fits FLAME tracking and outputs a canonical Gaussian head.
Use LAM's avatar export feature to produce the web-ready avatar package (the format the OpenAvatarChat WebGL renderer loads).
Upload the package to object storage as avatars/{user_id}/head/. Mark head_ready = true in the DB.
B. Voice lines (per message)
Text comes from the Gemini mayor agent or a canned line ("Yo you're slacking bro").
ElevenLabs TTS with the user's cloned voice ID → line.mp3 (also send 16 kHz WAV to the GPU server).
GPU server runs LAM Audio2Expression on the WAV → per-frame expression coefficients, saved as line_expr.json.
Store both under voice_lines/{line_id}/. Pre-generate 5 to 10 lines per user at onboarding so the demo never waits.
C. Frontend playback
Profile card mounts the LAM WebGL renderer with the user's head package.
On "play", start line.mp3 and step through line_expr.json frames keyed to audio.currentTime.
Idle state: loop a small blink and head-sway expression track when no audio is playing.
D. Stretch: SAM 3D Body proportions
Run SAM 3D Body on full_body.png. Output is an MHR mesh with skeleton (GLB) plus shape parameters.
Read limb lengths and height from the MHR skeleton. Normalize against a reference adult.
Apply those ratios as bone scales on the MVP villager rig, so tall friends are tall and broad friends are broad.
Demo line: "the village body is shaped by a 3D body estimate from your photo".
Fallback if LAM install fights you: skip 3D heads and show the SAM 3 face crop as a 2D card with a simple jaw-flap driven by audio amplitude. Still demoable, much less wow.
MVP pipeline: walking villagers
Each friend becomes a stylized chibi character that walks around the village in Three.js. Stylizing before meshing fixes the uncanny photoreal look and gives image-to-3D a clean input.
A. Stylize (Gemini, ~5 s)
Send full_body.png + traits.json colors to Gemini image editing.
Fixed prompt: "Chibi low-poly 3D game character of this person, full body, front view, A-pose arms 30° from body, neutral expression, plain white background, same hair, clothing and colors." Keep this prompt identical for everyone so the village has one style.
Run SAM 3 "person" on the result to strip any background, save stylized.png.
B. Mesh (TRELLIS 2, ~1 to 3 min)
Input stylized.png. Export GLB with baked base-color texture.
Post-process in Python (trimesh or Blender headless): decimate to ~10k to 20k triangles, recenter feet at origin, face +Z, scale to 1.0 unit tall.
If TRELLIS output is bad for a person, rerun with a new seed once, then fall back to Hunyuan3D 2.1.
C. Rig (UniRig, ~1 min)
generate_skeleton on the GLB, then skinning, then merge.sh → rigged.glb.
Retarget to a shared humanoid animation set (idle, walk, wave, cheer) so every villager uses the same clips. Map UniRig bone names to the animation set's bone names once, by hand.
Upload avatars/{user_id}/body/rigged.glb. Mark body_ready = true.
D. Frontend
Three.js (or React Three Fiber) GLTFLoader + AnimationMixer. One mixer per villager.
Villagers pick random waypoints on the village navmesh and crossfade idle ↔ walk.
Click a villager → profile card with the WOW head from the previous section.
Fallback (zero rigging risk): generated head on a preset body
One pre-rigged chibi body asset with the animation set already attached.
Run TRELLIS 2 on a stylized head-only image instead of full body.
Parent the head mesh to the body's Head bone. Tint shirt, pants and shoes materials with traits.json colors from SAM 3.
Every step still uses CV (segmentation for parts and colors, 3D generation for the head), and nothing can fail at rigging.
Vultr infra
One Vultr Cloud GPU instance, kept warm for the whole hackathon. Vultr Serverless Inference is built for LLMs behind an OpenAI-compatible API and cannot host these models, so do not use it here.
Instance: 1x NVIDIA L40S, 48 GB VRAM, 16 vCPU, 180 GB RAM, Ubuntu 22.04 + CUDA 12.1. $1.67/hr on demand (pricing), about $40/day. A100 80 GB is the backup if L40S stock is out.
VRAM plan: SAM 3 stays resident. LAM and Audio2Expression stay resident (small). TRELLIS 2, UniRig and SAM 3D Body load on demand, one at a time, then torch.cuda.empty_cache(). Peak should stay well under 48 GB.
Process layout: one conda env per model (they have conflicting CUDA extensions), each wrapped as a small worker. One FastAPI gateway + Redis queue in front. Jobs run serially on the GPU.
Endpoint
Body
Returns
Worker
POST /segment
photo URL
crop list + traits.json per crop
SAM 3
POST /avatar/head
user_id, face URL
job_id → head package URL
LAM
POST /avatar/body
user_id, full-body URL
job_id → rigged.glb URL
Gemini → TRELLIS 2 → UniRig
POST /voice/expr
WAV URL
line_expr.json URL
Audio2Expression
POST /avatar/proportions
full-body URL
bone scale JSON
SAM 3D Body
GET /jobs/{id}
none
status, progress, result URL
gateway
Storage: Vultr Object Storage (S3 compatible) for photos, GLBs, head packages, mp3 and expression JSON. The DB (Tiger Data) stores only URLs and head_ready / body_ready flags.
Onboarding UX: segmentation returns in about a second, head in seconds, body in a few minutes. Show the head first and a "your villager is being built" construction-site animation in the village until the body is ready.
Risks and checklist
Risk
Impact
Mitigation
SAM 3 / SAM 3D Body checkpoints are gated on Hugging Face
Blocks Stage 0 entirely
Request access tonight from every teammate's HF account. Fallback: SAM 2 + a person detector
CUDA extension builds (spconv, Gaussian rasterizer, nvdiffrast)
Hours lost
Separate conda env per model. Build each on the Vultr box first, before writing app code
LAM web renderer integration
No WOW head
2D face card with audio jaw-flap (see WOW fallback)
TRELLIS output looks bad on some people
Ugly villager
Reseed once, then Hunyuan3D, then preset-body fallback
UniRig bones don't match animation set
No walking
Hand-map bone names once, or use preset-body fallback
Group photo too low-res for faces
Blurry heads
Ask for one selfie per person at onboarding
L40S out of stock in region
No GPU
Try another region, or A100 80 GB
Consent for photos and voice
Ethics / judging
Explicit opt-in screen at onboarding. Label AI-voiced messages
Tonight
☐ Request HF access: facebook/sam3, facebook/sam-3d-body-dinov3
☐ Spin up Vultr L40S, install CUDA 12.1, clone SAM 3, LAM, TRELLIS 2, UniRig
☐ Run each repo's demo on one test photo of the team
☐ Confirm LAM export package loads in its WebGL renderer
☐ Pick the shared animation set and the chibi stylize prompt
☐ Stub the FastAPI gateway with the endpoint table above
Sources
SAM 3 repo · SAM 3 overview (Roboflow)
SAM 3D Body (ComfyUI wiki) · SAM 3D Body explainer · Rerun SAM 3D Body example
LAM repo · LAM paper
LHM repo
UniRig repo · UniRig on Replicate
Open-source 3D generators 2026 · TRELLIS 2 vs Hunyuan 3D
Vultr GPU plans · Vultr Serverless docs
