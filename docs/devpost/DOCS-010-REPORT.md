# DOCS-010 final report

Branch: `docs/DOCS-010`. Baseline: `5309fcc`. Deliverable milestone: `3c81c9c` (`docs: prepare evidence-backed Devpost submission and demo`). The following report commit is identified in the final response and by `git log -2 --oneline`.

## Delivered

- `README.md`: current feature summary, stable live URL, runtime-secret handling, local ports 8010/4173/8100, fixture setup and credits/license disclosures.
- `docs/ARCHITECTURE.md`: Mermaid diagram and component tour; pending connections use dotted arrows.
- `docs/devpost/SUBMISSION.md`: all eight Devpost fields, measured results, cost subset and eight sponsor paragraphs.
- `docs/devpost/DEMO_SCRIPT.md`: exact 150-second shot list, narration, Maya seat IDs/URLs, prepared-media and GPU/network fallbacks.
- `docs/devpost/EVIDENCE.md`: claim-to-source ledger, billing boundaries and ten unresolved fact groups.
- This report.

All changes are within `README.md`, `docs/ARCHITECTURE.md` and `docs/devpost/**`. No application code, task records, contracts, secrets or personal media were changed. No push or merge.

## Choices

The old README described an earlier morning build and several subsequently fixed gaps. The replacement follows the checked-out source and later decisions/requests. The historical `docs/submission/` package remains untouched. Missing house/Modal implementations and unmatched timing examples are explicitly marked unverified rather than credited as shipped. The demo uses read-only connected views, fixture mutations and prepared media. No agent delegation was needed.

## Validation

Commands ran from the worktree root. `python -` means a Python program supplied through a PowerShell here-string on stdin; the checks did not create validation scripts or alter application files.

| Command | Exit | Actual result |
| --- | ---: | --- |
| `python -c "from pypdf import PdfReader; print('\\n'.join(p.extract_text() for p in PdfReader('Hackathon.pdf').pages))"` with `PYTHONIOENCODING=utf-8` | 0 | Product brief extracted; initial attempt without UTF-8 exited 1 on console encoding |
| `python -` (urllib read-only availability probe) | 0 | Public `/` and `/api/health`, local `/api/health` and `/openapi.json`: all HTTP 200; local OpenAPI has 82 paths, no house-sync routes |
| `python -` (Markdown content validator) | 0 | Six documents; local file/anchor links resolve; balanced fences; required eight fields and eight sponsor paragraphs; contiguous eight-shot script ending at 150 seconds; Mermaid component/pending-edge markers present; copy-style checks pass |
| `git diff --check` | 0 | No whitespace errors |
| `git diff --cached --check` | 0 | Staged milestone has no whitespace errors |

The content validator's first attempt exited 1 because PowerShell replaced literal Unicode regex characters on stdin. Replacing those literals with Unicode escapes fixed the check; the corrected run passed **69 local links/anchors**. This was a validation harness failure, not a suppressed content failure. Git printed its normal LF-to-CRLF notices. The browser web-fetch tool could not open sslip.io; the independent urllib HTTPS probe succeeded.

Documentation checks are distinct from historical application benchmarks. No application suite, full browser rehearsal, model generation, message delivery, wallet operation, service restart or deployment was performed. API availability does not verify login or delivery. Mermaid was reviewed structurally, not rendered by a browser engine.

## Word counts

Whitespace-delimited counts include headings, tables, URLs and code. Narration counts only the nominal spoken column, excluding alternate lines and directions.

| Deliverable | Words |
| --- | ---: |
| Submission, including sponsor notes and disclosures | 1,548 |
| Architecture, including diagram | 1,263 |
| Demo script, including setup and fallbacks | 1,192 |
| Nominal spoken narration within the script | 292 |
| README | 1,156 |
| Evidence ledger | 1,135 |

The report itself is excluded from deliverable word totals. The script assigns exactly 150 seconds; its runtime still needs a presenter rehearsal, not an inference from word count alone.

## Teammate try-it

Open the submission and architecture in a Markdown renderer with Mermaid support. Follow the README's fixture commands on unused port 4174, select Maya, and rehearse the script with a stopwatch. The connected public tab is read-only. Review the evidence ledger before replacing any pending claim with a stronger one.

Screenshot: not applicable; no UI changed or new screenshot/video captured. Diagram syntax/structure checks are not a claim of visual browser rendering.

## Blockers and proposed contract changes

No blocker to the documentation deliverables; no proposed contract changes. Unverified publication facts are enumerated in the evidence ledger: official rubric/eligibility, media and licenses, total USD spend, handset video/Auth0 login, Tiger/159 ms, FPS range, Modal, runner/full hosting migration, and settled wallet payments. The task's supplied example numbers do not override missing measurement evidence.
