---
id: COPY-001
owner: codex (gpt-6-astra, medium)
branch: copy/COPY-001 (parallel; copy-only edits — keep diffs to string literals, JSX text, Mayor/LLM prompt templates, docs)
allowed_paths: [apps/web/src/**, apps/api/app/**, apps/imessage/src/**, docs/DEMO_TESTING.md, README.md]
request: R-93 (Iraj 18:19) "an agent to pass over text for AI-isms / Claude-isms"
---
# COPY-001 — De-AI the copy

Sweep all user-facing text (UI labels, empty states, helper text, toasts, error messages, onboarding/tour copy, Mayor/Gazette/scheduler LLM
prompt templates and their fallback lines, iMessage replies, seeded demo content) and rewrite anything that reads as AI-generated:
- Kill the tells: "Small steps…", "Every little step counts", "journey", "together" spam, "delve", "embark", "seamless", "elevate", "unlock your
  potential", "let's", "✨" sprinkles, "Whether you're X or Y", triads ("A, B, and C") used for rhythm, em-dash-heavy sentences, "It's not
  just X, it's Y", over-hedging, exclamation spam, title-case marketing headers, "Here's", "dive in", "game-changer", "cozy" overuse, filler
  explainers that restate the label.
- Voice target: a friendly small-town group chat. Short, specific, a little dry/funny, contractions, concrete nouns, no corporate wellness tone.
  Buttons are verbs ("Check in", "Buy", "Save"). Empty states say what's empty and what to do in ≤1 short sentence.
- LLM prompts: add a style block telling the Mayor/Gazette models to avoid those tells and write like a witty small-town mayor; keep their
  facts/safety rules untouched. Re-generate nothing (no paid calls); just update templates and static fallbacks.
- Don't change meaning, keys, tests' semantics, or accessibility labels' meaning; update test snapshots/strings that assert old copy.
Deliver a before/after table of the ~40 most visible strings in the report. All tests green. Final report per AGENTS.md.
