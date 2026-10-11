# CV-001 sample outputs (paths only — files live in gitignored `data/`)

Repo root = `C:\Users\mourn\Downloads\hacklanta` (WSL: `/mnt/c/Users/mourn/Downloads/hacklanta`).

Inputs (all CC0, sources in `data/inputs/sample_cc0/SOURCES.md`):
- `data/inputs/sample_cc0/palm_beach_man.jpg` — single person, full body (primary test)
- `data/inputs/sample_cc0/doorway_man.jpg` — single person, frontal
- `data/inputs/sample_cc0/crowd_plaid.jpg` — several people (multi-crop test)

Stage 1 (SAM 3) — `data/assets/avatars/<sample>/`
- `sample_palm/segment.json`, `sample_palm/person_0/{full_body.png,face_512.png,traits.json,masks/*.png}`
- `sample_doorway/person_0/...`
- `sample_crowd/person_{0..4}/...` (9 candidates, 5 kept by score>0.5 & area>2%; 2 used face fallback)

Stage 2 (LAM head) — `data/assets/avatars/sample_palm/head/`
- `avatar.zip` (OpenAvatarChat/LAM_WebRender package) and unpacked `avatar/{skin.glb,offset.ply,animation.glb,vertex_order.json}`
- `offset.ply`, `ref.png`, `preview.mp4` (150 frames, sample FLAME motion), `frames/*.png`, `head.json` (timings/VRAM)

Stage 3 (Audio2Expression) — `data/assets/avatars/sample_palm/voice/test_line/line_expr.json` (+ `.meta.json`), 240 frames @30fps for 8.0 s

Stage 4 (server smoke test, user `smoke_user`) — `data/assets/avatars/smoke_user/`
- `full_body.png`, `face_512.png`, `traits.json` (selected crop), `segment/…`, `head/avatar.zip`, `voice/smoke1/line_expr.json`
- server model logs: `data/logs/gpu_worker_{segment,head,expr}.log`
