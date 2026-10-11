---
id: WEB-056B
owner: codex (gpt-6-astra, medium)
branch: web/WEB-056
allowed_paths: [apps/web/src/lab/onboarding/**, apps/web/src/lab/pipeline/**, apps/web/public/lab/**, apps/web/tests/**]
---
# WEB-056B — Keep Iraj's personal media out of git (follow-up on your WEB-056 branch)

AGENTS.md: never commit photos or voice of real people; the repo will be public. Your branch commits `apps/web/public/lab/`
`iraj.png`, `face.png`, `hair.png`, `person.png`, `shirt.png`, `head-reference.png`, `avatar.zip` and `talking.mp4`, all
derived from Iraj's face or voice. Fix it on this branch:
1. **Remove those files from the branch history** (rewrite only your own two commits on `web/WEB-056`, e.g. reset to `main`'s
   merge base and recommit; it's unpushed and unmerged, so this is safe). Keep `mug.*` (an object, not a person) and README.
2. **Load them at runtime instead,** read-only, from the live app's own data: find Iraj's villager (user id
   `13370000-0000-4000-8000-000000000001`) through the existing API client (`/api/villages/{vid}` etc.); use his
   `avatar.portrait.asset_url` (photo), `head_package_url` (LAM zip), the cached talking clip/voice-line URLs the profile uses,
   and the SAM 3 mask/trait artifacts if an endpoint exposes them. If the masks aren't served, compute the mask overlay
   client-side from what is available, or show the photo with the exact segmentation boundary from the trait data. Never fetch
   with write methods, and never other people's media.
3. **Fallback:** when not signed in as a member, or the fetch fails (e.g. `/lab` opened logged out), show a clear
   illustrated/placeholder version of each step with the same labels. The demo must never break.
4. Update tests: the bundle contains no files with a person's face or voice (assert the `public/lab` listing), demos still never
   use POST/PUT/DELETE, and steps advance with both the runtime and fallback sources. Run them via `ops/remote_run.sh`.
Final report per AGENTS.md (what was removed, how assets now load, screenshots of both modes).
