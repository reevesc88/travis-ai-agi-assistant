# Agent Instructions — Standing Rules

Apply to all work in **canonical** `C:\dev\tools\travis-ai-agi-assistant` only.

## Scope

- **Canonical path only** — do not edit `Downloads\open-fieldservice`, `Downloads\Travis-construction-assistant`, notes copies, or other duplicates unless Calum explicitly names them.
- If scope is unclear, ask which folder under `C:\dev` is in scope before editing.
- No cross-project edits unless explicitly requested.

## Safety (non-negotiable)

- **No file deletes** without explicit user approval (includes duplicate trees, notes, exports).
- **No destructive git:** no `reset --hard`, no `push --force`, no `rebase --abort` unless user asks.
- **No deploy** (`wrangler deploy`, production promotion) without explicit approval.
- **No push** to GitHub without explicit approval.
- **No `npm install`** unless needed for verification; prefer documenting versions over mutating `node_modules`.
- **Never write secrets** from `.dev.vars` into memory files, chat, or commits.

## Change discipline

- Small, focused diffs; match existing Hono/Preact/Worker patterns.
- Log significant actions in `PROJECT_STATE.md` or `.memory/topics/` when decisions are made.
- Prefer `project-memory/` updates at session end over long chat summaries.
- Only create git commits when user asks — except pre-approved memory/bootstrap commits documented in task.

## Session start

1. Offer cheat sheet: `C:\Users\calumai\.Codex\CALUMS-CHEAT-SHEET.md` (yes/no).
2. Read `project-memory/START_HERE_AFTER_RESTART.md`.
3. Run `git status` before assuming build/dev is safe.

## Consolidation goals (from Travis consolidation work)

- Single source of truth: `travis-ai-agi-assistant` repo = full app.
- `open-fieldservice` on GitHub = skeleton; `travis_new` = empty (verify on GitHub).
- Preserve quote-related UI/components during merges.
- Keep Replit-derived auth/views/CSS integrated; resolve conflicts favoring merged intent + preserved quotes.

## Verification before claiming success

- `git status` clean or conflicts understood
- `npm run build` only when tree is coherent
- Do not claim "pushed" or "deployed" without command evidence

## Memory surfaces

| Surface | Use |
|---------|-----|
| `project-memory/` | Human-readable restart kit |
| `.memory/` | Topic index, one-line history |
| `C:\Users\calumai\.claude\MEMORY.md` | Global plans/index |

See `WORKFLOW_PREFERENCES.md` for extracted chat preferences.
