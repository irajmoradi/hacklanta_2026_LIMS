# Demo lab assets

Only the mug photograph, mug cutout, mug GLB, and hand-drawn placeholder SVG ship with this exhibit. No person's photo, mask, head package, video, or voice is included.

The demos use the existing API client only after a token provider is present. They read `/me` and joined villages, confirm membership, and select only Iraj (`13370000-0000-4000-8000-000000000001`). Portrait and head URLs come from his avatar manifest. Authenticated asset GETs load the worker's scoped full-body crop and person/hair/shirt masks. Masks align with that full-body crop, not the manifest's face portrait. If the person mask is missing, a labeled approximate overlay is computed from the white-background cutout. Missing part masks are disclosed. Colors come from the avatar manifest.

The read-only village bark cache manifest supplies an existing Iraj voice line, played only on user action. Profile speech/chorus APIs require POST to discover/create lines; no cached-clip listing GET exists. Consequently this exhibit uses portrait + cached voice instead of claiming a talking video is available. No guesses at other users' media, generation, or server writes. Blob URLs are revoked on exit; no personal files are stored in the repository.

Logged-out, nonmember, offline, and unavailable-media states retain illustrated steps. Local photo previews remain browser-only. Runtime tests use synthetic artwork and silent audio, never real personal media.

Mug provenance: existing `cv006_mug.jpg`, `object_mug/cutout.png`, and `object_mug/object.glb` from the cached object experiment. Historical timings: `docs/cv/cv004.md` and `docs/cv/cv006.md` (RTX 5090; not current Modal latency measurements).
