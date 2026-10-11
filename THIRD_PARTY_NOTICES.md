# Third-party notices

Village's own source code is MIT-licensed (see `LICENSE`). The components below are **not** covered by
that license. They keep their upstream licenses and terms. This repository does **not** redistribute any
model weights: the GPU worker downloads them at setup time, and each one must be obtained and used under its
own license. This is a summary of our records, not legal advice. Check each upstream license before reuse,
especially for commercial use.

## Computer-vision and avatar models (used by `workers/gpu`, run on Modal)

| Component | Used for | Terms (per our records; verify upstream) |
|---|---|---|
| **SAM 3** (Meta) | Photo segmentation | SAM License; gated weights on Hugging Face |
| **LAM**, Large Avatar Model | 3D Gaussian-splat talking heads | Upstream license; weights recorded as **non-commercial** |
| **Audio2Expression** | Lip-sync expression tracks | Upstream license |
| **Hunyuan3D-2 / 2mini** (Tencent) | Photo/idea → 3D head and object meshes | Tencent Hunyuan 3D Community License, including **territory restrictions**. Meshes generated with it may be subject to its terms |
| **OpenCV Zoo SFace** | Optional face match | Apache-2.0 (training data terms not audited) |
| **OpenCV Zoo YuNet** | Face detection | MIT |

Our pipeline code that calls these models is MIT. Using the pipeline means accepting each model's own
license, including the non-commercial and territory limits above.

## Hosted services (called through their APIs, under their terms)

Google Gemini (Vertex AI), OpenRouter, ElevenLabs (voice clones, TTS and the generated sound effects in
`apps/web/public/sfx`), Modal, Photon Spectrum (iMessage), TigerData, Auth0, Solana (devnet), Vultr.
Generated outputs from these services are subject to each provider's terms.

## Assets

- `apps/web/public/models`: original procedural GLBs made in Blender for this project (MIT, with the code)
  unless an asset report in `assets/` says it was generated with Hunyuan3D (see above).
- `apps/trailer/public/audio`: original score, CC0 1.0 (see the `LICENSE.txt` there).
- `apps/web/public/sfx`: generated with ElevenLabs sound effects (ElevenLabs terms).

## Package dependencies

npm, bun, Cargo and Python dependencies are installed from their registries and remain under their own
licenses (see each package's metadata).

## People

No photos or voice recordings of real people are included in this repository. The live demo uses faces
and voices only with each person's consent, stored outside the repository.
