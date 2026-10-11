# DOCS-014 handoff

Branch: `docs/DOCS-014`. Setup milestone: `40184eb`. Final documentation/validation milestone: the commit containing this report (`git log -2 --oneline`).

## Delivered

- `docs/SETUP.md`: zero-key mock setup, Docker scratch API, provider signup/screens and credential readers, recorded costs, fallback behavior, smoke commands, Modal/bridge deployment, devnet program runbook, fresh-production prerequisites and the routine updater.
- `.env.example`: grouped placeholders covering application, worker, deployment and test/tool environment reads, with safe active rehearsal defaults and optional assignments commented out.
- `README.md`: top links; current Gemini model, overworld synchronization, payout modes, Treasury, Demo Lab and fixed repair-task scope; preserves the architecture sections.
- `docs/devpost/SUBMISSION.md`, `docs/devpost/DEMO_SCRIPT.md`, `docs/devpost/EVIDENCE.md`: current product story, judged rehearsal and source evidence, sponsor qualification paragraphs, pending D-002 side-challenge confirmation, hidden Lab and honest devnet/transport limitations.
- `docs/infra/PRODUCTION-DEPLOYS.md`, `docs/infra/REMOTE_RUNNER.md`: correct the hardcoded production demo-auth flag and mark the old desktop tunnel as historical.
- `docs/infra/check_docs014.py`: offline environment-reader inventory, credential-placeholder checks, local Markdown links and fenced-block checks. It imports no application code and reads no secret files.

## Validation

Commands run locally from repository root:

| Command | Result |
| --- | --- |
| `python docs/infra/check_docs014.py` | Exit 0; environment coverage, blank credential placeholders, local links and fences |
| `python docs/infra/check_docs014.py --shell` | Exit 0; 176 env names cover 173 detected/reviewed readers; eight documents' local links/fences; eight contiguous demo beats total 150 seconds; 16 Bash blocks parse with `bash -n` |
| `git diff --check` | Exit 0 |

These are lightweight static checks, so no remote build/test runner was needed. Bash examples were parsed, not executed. Application tests, browser rehearsal, provider generation, migrations, production deployment, wallet sends and live messaging were not run. No UI screenshots are claimed. The scanner covers literal Python/JS reads, shell default inputs and reviewed dynamic settings; it excludes OS/SDK built-ins, shell locals and generated code. It is a repeatable coverage check, not proof that every external SDK configuration knob is enumerated.

## Choices and limits

The current code is the authority where older reports conflict. FEAT-027 implements verified wallet payments and payout modes; D-030 proves only the older devnet deployment. A compatible v2 deployment is not evidenced. FEAT-028 custom Mayor repair tasks are absent, so they remain future work. The current production build hardcodes demo auth despite an older runbook saying zero. Several account billing tiers are unrecorded; the guide says so instead of guessing. The historical STATUS table does record ElevenLabs Creator with IVC enabled, which the setup guide now cites.

No secret file needed to be read for this documentation task. No credentials, private runner addresses, phone numbers or personal media were added. Official provider setup references were checked where accessible; Photon and Tiger documentation could not be fetched by the browser tool, so their setup descriptions also use the checked-in integration and the local Spectrum skill. The skill targets an older SDK version; the guide retains the repository's pinned 12.10.1 and introduces no SDK code.

The production updater cannot bootstrap a new VM; the guide distinguishes initial operator provisioning from routine release updates. Fresh-install and provider instructions are source-reviewed runbooks, not a claim of an end-to-end deployment rehearsal. Trailer MP4s/personal assets are intentionally absent from a fresh clone.

## Teammate trial

Follow [mock setup](../SETUP.md#local-in-five-minutes-mock-mode), then visit `/lab#disasters` and `/lab#pipeline`. Read the refreshed [submission](../devpost/SUBMISSION.md) and [demo script](../devpost/DEMO_SCRIPT.md). Run `python docs/infra/check_docs014.py --shell` from the repository root to repeat offline checks (requires Bash on PATH).

Screenshots: not applicable; no UI code changed. Existing screenshot/media artifacts were not modified. No contract changes proposed. No documentation implementation blockers remain; real provider credential checks, fresh VM provisioning and v2 devnet deployment require their separate operational work.
