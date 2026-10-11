# Pre-publication Git-history audit — DOCS-012

**Result: no confirmed credential leak was found by the executed scan; this is not publication clearance.** Historical media and third-party assets need rights/privacy review. No repository visibility, history, remote refs, keys or running services were changed. No secret values, email addresses or phone numbers are reproduced here.

## Scope and method

The source baseline is `f80f5b7fe231af87a6c6f8d52a074f51e9bbe4a5`. On October 10, 2026, the audit captured all locally available ref targets plus HEAD, then traversed that fixed set. It covered **1,035 reachable commits, 13,951 Git objects and 7,186 unique blobs / 785,737,504 uncompressed bytes**. This includes history reachable from other local branches, not only files in this task's checkout. Concurrent branch movement after capture is outside that snapshot.

[The scanner](../architecture/audit_history.py) uses the equivalent of `git rev-list --objects --all` over captured object IDs, streams every blob through `git cat-file --batch` without a size cutoff, and scans commit-message metadata. It never checks out old code or executes historical files. It scans provider token prefixes, PEM/OpenSSH private-key markers, JWT shapes, credential-bearing URLs, assigned-secret patterns, email/US-phone patterns and sensitive filenames. Existing private-env secret values were read into memory at runtime for exact-match comparison; they were not copied into the worktree or emitted. Eleven configured value names were checked; the inventory records names, never values.

Five ZIP trace archives were expanded in memory, covering **837 members**, and scanned with the same patterns and exact-match checks. Additional recursive JSON inspection of their trace/network records found no nonempty Authorization, Cookie, Set-Cookie, X-Service-Key or X-GPU-Key header entries. Browser runtime object identifiers containing `@` caused email-shaped trace matches; all 409 expanded-trace occurrences were `page@...` identifiers, not contact addresses.

[The redacted inventory](../architecture/history-inventory.json) preserves captured refs, blob IDs, representative historical paths, sizes, candidate categories/line numbers and media lists. One blob may have appeared under multiple paths; `rev-list --objects` supplies a representative path, not a complete rename map. Remediation must resolve every containing commit/path before rewriting history.

Run from root, with `VILLAGE_ENV_FILE` already pointing at the existing private env:

```bash
python docs/architecture/audit_history.py
```

Exit **0**. Initial enumeration also completed successfully; the final run freezes refs and expands ZIP members. No system-wide scanner was installed. The scanner is heuristic, not gitleaks or a certification of absence. Unknown token formats, removed/rotated credentials, encrypted archives, rasterized text, steganography and image/audio contents can evade text matching. Binary byte-pattern hits were retained for triage rather than treated as confirmed secrets. No remote fetch, reflog/unreachable-object scan, LFS-server scan or ignored-working-file audit was performed. “Full history” here means all history reachable from the captured available refs, including deleted historical files.

## Findings and exact disposition

| ID / severity | Historical location | Finding | Remediation before publication |
| --- | --- | --- | --- |
| A-01 / High, clearance required | `97950e0`, `docs/devpost/gallery/screenshots/03-profile-head.png`; blob `5fa85d638fe2` | Visually inspected screenshot contains a rendered human-derived portrait under a substituted display name. Its source identity and public redistribution consent cannot be established from pixels. Changing a label does not anonymize portrait content. | Owner verifies source/media license and explicit public-repository consent. If unavailable, replace with a procedural/synthetic portrait, then integrator removes the original blob from **all historical paths/refs**, not just HEAD. Rerender gallery from synthetic fixtures. |
| A-02 / High, review required | `d41dcd0`, `apps/web/public/heads-demo.wav` and `apps/web/artifacts/feat017/head-saying-line.webm`; `503f5ea`, `apps/trailer/public/audio/village-original.wav` | Voice/audio or audiovisual media is committed. FEAT-017 describes its fixed sample as synthetic and the test records that sample; this is not evidence of an exposed real voice clone. Trailer music is a separate provenance item. | Verify generation source, provider redistribution rights and absence of personal recordings. Retain approved synthetic media with provenance; replace and history-remove any unconsented real-person samples. Do not infer ownership from a filename. No voice identity was inferred by this audit. |
| A-03 / Medium, privacy inventory | Screenshot/video families under `apps/web/artifacts/`, `apps/web/tests/`, `docs/qa/`, `docs/devpost/gallery/`; exact blob/path inventory linked above | **2,220 media/archive versions**, including **86 distinct audio/video paths**, are reachable. Town/profile screenshots may preserve personal names, likenesses, goals or feed content. A text secret scan cannot clear these images. | Review the full inventory before publication; regenerate documentation evidence using synthetic names/content and procedural avatars. For any personal pixels/audio that lack release consent, integrator removes affected historical blobs and archived copies. Six representative screenshots were visually inspected; this is explicitly not a claim that every frame/image was manually cleared. |
| A-04 / Medium, retained browser traces | `bbf06d0`, `apps/web/artifacts/integ006/{baseline,headed,headless}-trace.zip`; `3052638`, `apps/web/artifacts/web028/transition-trace.zip`; `6c12f9a`, `apps/web/tests/screenshots/INTEG-005/arena-transition-trace.zip` | Archives retain browser snapshots/resources and increase exposure surface. Expanded scans found no configured secrets or sensitive HTTP-header values. Email-shaped matches were runtime page identifiers. | Prefer publishing synthetic screenshots and keeping raw traces in private expiring artifacts. If any embedded personal resources fail review, remove complete archives from all history, then verify a fresh clone. Rotation is required only if private review finds a real credential; no specific credential was confirmed here. |
| A-05 / Medium, repository size | Ten blobs >=5 MiB; see table below | Large trace ZIPs and generated PNG sheets remain in history, even when HEAD replaces them. | Move permitted large evidence to artifact storage or an explicitly selected LFS policy. To reduce existing clone size, integrator must rewrite history or publish a sanitized new repository; deleting latest files alone is insufficient. |
| A-06 / Low, identity metadata | Root history from `a849a81`; commit-message trailers across captured refs | One author/committer email identity and email-shaped coauthor trailers are present. Aggregate inspection classified matched addresses as service/noreply domains. Values are withheld. | Owner confirms intended public attribution. If an address must be removed, integrator rewrites author/committer metadata and matching message trailers across all refs. A mailmap changes presentation, not stored history. No credential rotation follows from an attribution address alone. |
| A-07 / Informational, no confirmed leak | `10bff7f`, `apps/imessage/.env.example`; `3540192`, `infra/vultr/cloud-init.yml`; `ops/deploy/prod.env.example`; test/config source | Sensitive-path scan found only the tracked `.env.example` among `.env`/key patterns. Secret-assignment candidates were runtime expressions, replacement placeholders or explicit synthetic test credentials; credential URL candidates were local test/rehearsal defaults. No provider-token/private-key/JWT or configured-secret match was found. | Keep examples empty or obviously synthetic. Preserve runtime loading and ignore rules. If later scans find a real credential, revoke/rotate it first, then remove every historical occurrence and invalidate related sessions; deleting the file does not revoke access. |
| A-08 / Informational, synthetic phone candidates | API/iMessage/web tests and `SettingsPanel.tsx`; e.g. `apps/web/src/api/mock.test.ts` lines 88–89 at source snapshot | Phone-pattern matches are test/example values containing the synthetic 555 sequence, plus an all-zero invalid-number test. No real phone number was confirmed in scanned text. | Keep synthetic fixtures; inspect screenshots separately because OCR was not performed. Broaden international/format coverage before treating this US-focused regex as an exhaustive contact-data detector. |

Severity describes publication risk and required review, not a claim that a real person's private information or a live key was proven exposed. A-01 records human-derived visual content without identifying the person. A-02 records voice-capable files with synthetic provenance evidence; it does not assert they contain a real person's voice.

## Large blobs

Sizes are uncompressed Git blob bytes. IDs disambiguate historical versions. Introduction/update commits can be recovered with `git log --all --find-object=<full-blob-id> --format='%H'`; full IDs are in the inventory.

| Historical path | Blob prefix | Bytes | Commit reference |
| --- | --- | ---: | --- |
| `apps/web/artifacts/integ006/baseline-trace.zip` | `94ed78f833ea` | 6,212,034 | `bbf06d0` |
| `apps/web/artifacts/integ006/headed-trace.zip` | `a5604e7c5cdf` | 11,977,573 | `bbf06d0` |
| `apps/web/artifacts/integ006/headless-trace.zip` | `a2f92ee32521` | 10,421,114 | `bbf06d0` |
| `apps/web/artifacts/web028/transition-trace.zip` | `4ddd7eb4b7c2` | 8,047,119 | `3052638` |
| `assets/previews/contact_sheet.png` | `76cd9d7dbe1e` | 18,166,023 | `fe0f037` |
| `assets/previews/events.png` | `c281a95f6bc9` | 7,050,063 | `151c3e1` |
| `assets/previews/outfits_fit.png` | `82669700f2ef` | 5,396,490 | `2d1d831` |
| `assets/previews/contact_sheet.png` | `e2eacdef79c4` | 18,310,730 | `151c3e1` (later replaced) |
| `assets/previews/contact_sheet.png` | `fdcdf7ab47f0` | 12,088,438 | `7ec55c2` (later replaced) |
| `assets/previews/contact_sheet.png` | `57cb62950e22` | 18,699,780 | `8b55bd7` (later replaced) |

No model-weight extension was identified in the media inventory. GLBs, textures, sound effects and generated assets still require their own license/provenance review. This does not inspect ignored local weight caches, nor imply that binary contents have been independently reverse-engineered.

## Integrator action order

1. Keep publication/visibility unchanged until A-01–A-04 receive a media/privacy decision. Review all media versions, not only the current gallery.
2. If any real credential emerges, rotate/revoke at its provider immediately; record only the variable/key name in tickets. Reissue dependent services from the private environment. This audit identified **no specific key requiring rotation**.
3. Prepare approved synthetic replacements, then choose coordinated history removal or a sanitized new publication repository. A rewrite changes commit IDs and requires collaborator coordination; this worker did not perform or authorize it.
4. Check every ref, archived trace and renamed path; rerun scanning on a fresh clone of exactly what will be published. Review hosting caches/forks separately if anything was already public.
5. Select a project license after third-party/media terms are reviewed. MIT is a possible simple code license if the owner wants permissive reuse; it would not relicense pretrained models, personal media or provider outputs. No LICENSE was added.

The task's audit is complete as a read-only inventory and triage. Publication remains contingent on media rights/privacy clearance and the integrator's chosen remediation; heuristic scanning cannot substitute for that decision.
