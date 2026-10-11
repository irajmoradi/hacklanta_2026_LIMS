# WEB-026 delivery report

Branch: `web/WEB-026`. Implementation milestone: `e3fa46e`. Final follow-up commit contains the mobile header specificity fix, layout assertion, screenshots, and this report (resolve with `git log -1`).

Implemented grouped Profile, Villager-grams & voice, Messages, Sound, Face check, and Danger zone cards. Settings uses accessible switches, sage sliders, connected helper descriptions, accent keyboard focus, consistent spacing, and a sticky bar only while profile changes are unsaved. A gear Settings button sits beside Inbox, and empty Villager-gram choices link directly to Settings.

The shared control sweep corrects modal checkbox sizing/alignment (voice consent, competitions, weekly review, participant/photo consent), styles the Mayor bribe slider, and spaces adjacent panel headings. Voice consent remains a labeled checkbox because it is an explicit acknowledgement, rather than a preference. Recording, consent gates, voice deletion, and DELETE account confirmation are preserved.

## Files changed

- `src/App.tsx`: header entry and Shop-to-Settings callback.
- `src/components/SettingsPanel.tsx`: cards, switches, dirty tracking and Save bar.
- `src/components/SettingToggle.tsx`: reusable native checkbox-backed accessible switch.
- `src/components/DeleteAccount.tsx`: subdued danger card and icon.
- `src/components/Modals.tsx`, `src/components/Villagergram.tsx`: empty-state Settings navigation.
- `src/sound/SoundControls.tsx`: labeled sound preferences and percentage slider.
- `src/styles.css`: settings design and shared control corrections.
- `package.json`, `bun.lock`: axe Playwright development dependency.
- `tests/settings.spec.ts`: deterministic demo seat and current permission payload assertion.
- `tests/web026.config.ts`, `tests/web026.spec.ts`: isolated offline/HTTP-fixture browser coverage.
- `tests/screenshots/WEB-026/*.png`: desktop/mobile visual evidence.
- `WEB-026-REPORT.md`: this handoff.

## Verification

Commands below run from `apps/web`, except `git diff --check` at the worktree root.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` | 0 | Dependencies installed |
| `bun add -d @axe-core/playwright` | 0 | Accessibility test dependency installed |
| `bun run typecheck` | 0 | TypeScript passed |
| `bun run build` | 0 | Production bundle built; existing large-chunk warning remains |
| `bun test src/api/settings.test.ts src/api/v2.test.ts` | 0 | 7 tests, 44 assertions passed |
| `bunx playwright test --config tests/web026.config.ts` | 0 | 8 tests passed: desktop/mobile settings, failed-save retry/reversion, empty-gram navigation, recording cleanup, voice consent/deletion retry, evidence, village/tour |
| `bunx playwright test --config tests/web026.config.ts --project settings-ui` | 0 | Final layout/screenshot rerun: 4 passed |
| `git diff --check` | 0 | No whitespace errors |

Axe WCAG 2 A/AA and 2.1 AA scans report zero violations inside Settings at 1366px and 390px. Keyboard coverage exercises Space on switches, ArrowRight on volume, and focus restoration after close. Tests verify persistence after reopening, no sticky bar for instant sound preferences, account deletion gating, and no horizontal dialog overflow. Desktop/mobile topbar, initial settings, unsaved state, sound and danger screenshots are in `tests/screenshots/WEB-026/` and were visually reviewed.

An initial Playwright invocation from the repository root failed with exit 1 because the relative config path was wrong; rerunning from `apps/web` resolved it. Screenshot review found and corrected two inherited selector conflicts (slider text-field border and mobile header placement).

## Try it

From `apps/web` in PowerShell:

```powershell
$env:VITE_MOCK='1'
$env:VITE_DEMO_AUTH='1'
bun run dev --port 5426
```

Open `http://localhost:5426`, choose a demo seat, then select Settings beside Inbox. Change a permission, save, close and reopen. Scroll to Sound and Danger zone. Open Shop to use the Settings link when speakers or recipients are unavailable. For repeatable validation, run the browser command above; its config sets fixture IDs and does not need GPU workers or secrets.

## Decisions and limits

Sound preferences retain existing immediate, device-local persistence; the helper text explains this. Profile/phone/permission edits require Save. Voice actions still require explicit button activation. No paid generation, actual iMessages, account deletion, real personal media, or on-chain transactions were used for validation. HTTP behavior was tested against the repository MockApi through the live client, not a deployed backend.

Blockers: none. Proposed contract changes: none. All tracked changes are inside `apps/web/**`.
