# Re-running QA-013

Run from `apps/web` using Git Bash. These scripts visit the public production URL and do not start an API or Vite server. The wrapper installs dependencies on the remote runner. Do not run them against a different target without reviewing the guards.

```bash
export QA_FAST=1
export QA_SEATS=Iraj
export QA_LEAN=1
export QA_STEPS=compete,checkin,mayor,profile-accomplishments,interior,shop
export QA_RESULT=cinematics.json
../../ops/remote_run.sh --env QA_FAST --env QA_SEATS --env QA_LEAN --env QA_STEPS --env QA_RESULT node ../../docs/qa/QA-013/run.cjs

export QA_RESULT=seats.json
../../ops/remote_run.sh --env QA_FAST --env QA_RESULT node ../../docs/qa/QA-013/seats.cjs
export QA_RESULT=world.json
../../ops/remote_run.sh --env QA_FAST --env QA_RESULT node ../../docs/qa/QA-013/world.cjs
export QA_RESULT=panels.json
../../ops/remote_run.sh --env QA_FAST --env QA_RESULT node ../../docs/qa/QA-013/panels.cjs
export QA_RESULT=recovery.json
../../ops/remote_run.sh --env QA_FAST --env QA_RESULT node ../../docs/qa/QA-013/recovery.cjs
../../ops/remote_run.sh node ../../docs/qa/QA-013/followups.cjs
../../ops/remote_run.sh node ../../docs/qa/QA-013/health.cjs
```

`QA_FAST` uses the app's existing remembered-seat and dismissed-guide localStorage keys. It skips the fresh-browser seat/Help sequence, which was checked separately by `audit.cjs`. It does not change server identity records. `QA_LEAN` omits redundant screenshots but still inspects each option. All other runs capture full target-size screenshots. `recovery.cjs` disconnects only its own browser context to inspect error recovery; it does not interrupt production.

`audit.cjs` provides HTTP/WebSocket guards, privacy redaction, console/request evidence, and setup. A screenshot briefly pauses animation-frame callbacks, then resumes them in `finally`. CSS animations are disabled only for the screenshot. Network activity and interval-based interior movement continue. Capture failures are recorded separately and must not be interpreted as product failures.

The other scripts cover read-only controls. Do not add clicks to Submit, Buy, Equip, Save, Cheer, Send, Join, Pray, Bribe, debug buttons, or camera/upload controls. Only seat/presence and ephemeral walking are allowed to cross the network as writes. Raw auth frames are omitted from evidence. Request failures caused by closing a context are not server outages; use explicit HTTP status records.

Scripts use `observed` to mean a flow was reached and inspected, not that the product is bug-free. Look at the recorded text, empty categories, geometry, screenshots, and network errors. `harness-error` requires review and a targeted follow-up. Initial experiments and the outage trace are retained separately from final coverage runs.

From the repository root, validate saved artifacts with:

```powershell
python docs/qa/QA-013/validate.py
```
