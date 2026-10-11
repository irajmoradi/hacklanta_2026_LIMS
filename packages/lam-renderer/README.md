# @village/lam-renderer

Browser renderer for LAM talking heads. It is a thin TypeScript wrapper around the official LAM WebGL renderer.

```ts
import { mountLamHead, fetchObjectUrl } from "@village/lam-renderer";
const headers = { "X-Demo-User": viewerId };                  // Village API auth (demo mode)
audio.src = await fetchObjectUrl(line.audio_url, headers);     // /api/assets/... needs the header too
const head = await mountLamHead(divEl, {
  packageUrl: manifest.portrait.head_package_url,             // /api/assets/avatars/<uid>/head/avatar.zip
  exprUrl: `/api/assets/avatars/<uid>/voice/<line_id>/line_expr.json`,
  audio, headers,
});
audio.play();          // the face follows audio.currentTime. When paused or ended it goes back to idle blink/sway.
head.setExpr(otherExpr); head.dispose();
```
- `container` is any element with a definite size. The module renders into an absolutely-positioned child
  (the upstream viewer goes into a resize feedback loop and draws nothing inside content-sized boxes, such as `aspect-ratio` without a fixed height).
- Idle: the upstream `animation.glb` "Idle" clip, plus procedural blinks every 2.5–5 s and slight smile, brow and eye drift.
  Speaking: Audio2Expression ARKit-52 frames at 30 fps, indexed by `audio.currentTime`. The chat state is "Responding".
- Options: `backgroundColor` ("0xRRGGBB"), `alpha` (default 1), `camera` ({y, z}, default {1.66, 0.62} head close-up), `onProgress`.
- Limitations inherited from upstream: one head per page at a time (the upstream class is a singleton, and `dispose()` resets it).
  The zip URL path must end in `<name>.zip`. The renderer fetches the zip itself; `headers` are injected into that one XHR.
  It needs a visible tab, because rendering runs on requestAnimationFrame.

## Demo
```bash
cd packages/lam-renderer && bun install
bunx vite --config demo/vite.config.ts        # http://127.0.0.1:5180
```
- `/`: sample_palm head (CC0 photo), with an ElevenLabs line and its Audio2Expression track, served from `data/assets` through `/local-assets`.
- `/?uid=13370000-0000-4000-8000-000000000005`: Dev's real head through the Village API on :8010 (manifest → zip, using the X-Demo-User header).
- Screenshots: `bun demo/screenshot.ts "http://127.0.0.1:5180/" ../../data/cv002/sample_palm play` (uses installed Chrome).
- `/?pkg=/local-assets/lam_sample/p2-1.zip`: any zip. `/raw.html`: the upstream renderer with no wrapper (sanity check).

## Licenses
- `gaussian-splat-renderer-for-lam@0.0.9-alpha.1` (npm; source: aigc3d/LAM_WebRender): MIT. The bundled LICENSE
  is the MIT license of mkkellogg/GaussianSplats3D ("Copyright (c) 2023 Mark Kellogg"), which it is built on, and it bundles three.js (MIT).
- This wrapper uses the package as a dependency and does not copy its source. The idle/expression stepping logic was
  adapted from LAM_WebRender's `src/gaussianAvatar.ts` (MIT).
