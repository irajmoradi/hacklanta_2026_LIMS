# WEB-027: single-photo camera capture

Branch: `web/WEB-027`.
Milestones: `e9c1678` removes the superseded API multi-angle work; `603b564` implements the shared camera sheet. Final verification is in the commit containing this report.

The owner's updated task limits this to one photo. Removed the earlier view selector, optional angles, multipart views helper/tests, API handler/helper/tests, and contract additions. The API and contract now match their pre-WEB-027 versions. No GPU changes or migrations.

Implemented a shared capture sheet for Customize my avatar, onboarding, Group photo, Make it real, FaceCheck, check-in evidence and competition evidence. It uses the existing FaceCheck getUserMedia/canvas approach, front/rear switching, a face oval and lighting tips, 3-2-1 countdown, retake/confirm and upload fallback. Only the preview is mirrored; the captured canvas uses the original frame. Camera tracks stop on capture and close, including late permission grants. Preview URLs are revoked. Camera access starts only after an explicit action. Photo size/type limits follow each destination, and existing consent/upload boundaries remain intact.

Make it real had no UI in this checkout. Added a profile entry using the existing item endpoint, with object/outfit selection, consent, token-cost copy and job polling. Fixture mode allows capture without paid generation. The camera dialog is portaled outside parent forms so closing it cannot submit a check-in.

## Changed files

- API rollback: `apps/api/app/main.py`, removed `apps/api/app/avatar_photos.py` and `apps/api/tests/test_web027.py`; restored `packages/contracts/api.md`.
- Web UI: `src/components/PhotoCapture.tsx`, `photoCapture.css`, `MakeItReal.tsx`, `Onboarding.tsx`, `FaceCheck.tsx`, `GroupPhotoPanel.tsx`, `ProfilePanel.tsx`, `Modals.tsx`, `CompetitionsPanel.tsx`.
- Verification: `playwright.web027.config.ts`, `tests/web027.spec.ts`, `tests/web027-onboarding.spec.ts`, `tests/web015.spec.ts`, this report and screenshots.
- The pre-existing edit to `docs/tasks/WEB-027.md` was read and left untouched/uncommitted because it is outside allowed_paths.

## Try it

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev
```

Choose Iraj, open My profile > Customize my avatar > Take a photo. Open camera, switch if needed, capture, retake or confirm, then consent and Build my avatar. The offline-worker message preserves the preset. My profile > Make it real and Village > Our group photo use the same sheet. A new account joining by invite gets the same avatar capture during onboarding. Camera needs localhost/HTTPS and permission; upload remains available when permission is denied.

## Verification

- `bun run test` (apps/web): exit 0; 57 passed, 852 assertions.
- `bun run build` (apps/web): exit 0; Vite reports existing large bundle warnings.
- `python -m uv run --frozen pytest tests/test_api.py -k avatar_upload -q --tb=short` (apps/api): exit 0; 1 passed, 26 deselected. VILLAGE_ENV_FILE points to the supplied external .env at runtime. Providers are mocked by the existing fixture.
- Initial `bunx playwright test --config playwright.web027.config.ts`: exit 0; 8 desktop/mobile camera tests passed. An expanded-run startup initially exited 1 because port 5188 was occupied; retried after it became available.
- `bun run typecheck` (apps/web): exit 0.
- Final `bunx playwright test --config playwright.web027.config.ts` (apps/web): exit 0; 15 passed (2.9 minutes). Covers onboarding, FaceCheck, desktop/mobile capture, switching, countdown, retake, consent, denied permission/upload, late grant and close cleanup, unmirrored canvas, legacy multipart and offline presets.
- `git diff --check`: exit 0.

Reviewed and saved screenshots: `apps/web/tests/screenshots/WEB-027/{desktop,mobile}-{camera,confirm}.png`.

No blockers or proposed contract changes. Synthetic Chromium camera and mobile emulation were used; physical mobile hardware was not tested. No paid generation, GPU runs, real-person photos/voice, or secret files were added.
