# START HERE — After Restart

**Workspace (canonical only):** `C:\dev\tools\travis-ai-agi-assistant`  
**Package:** `@clawnify/open-fieldservice`  
**GitHub:** `reevesc88/travis-ai-agi-assistant`

## First command (run immediately)

```powershell
cd C:\dev\tools\travis-ai-agi-assistant
git status
```

If output shows **"interactive rebase in progress"** or **unmerged paths**, stop coding and read `RISKS_AND_BLOCKERS.md` before any build or feature work.

## Verify workspace (60 seconds)

```powershell
# Confirm canonical path
pwd

# Git summary
git status
git log -1 --oneline main 2>$null
git branch -vv
git remote -v

# Runtime (no install)
node -v
npm -v

# Secrets present? (do not cat)
Test-Path .dev.vars

# Dev port free?
netstat -ano | findstr :8787
```

## Read order

1. `PROJECT_STATE.md` — what is done / broken right now
2. `RISKS_AND_BLOCKERS.md` — especially rebase conflicts
3. `OPEN_QUESTIONS.md` — user decisions still needed
4. `AGENT_INSTRUCTIONS.md` + `WORKFLOW_PREFERENCES.md`
5. `CLI_COMMANDS.md` — safe commands
6. `NEXT_ACTIONS.md` — what to do next

## Questions to ask Calum before building

- Rebase: **abort**, **continue resolving conflicts**, or **pause** and work from a worktree?
- Push: 25 local commits on `main` not on `origin` — push now or after rebase?
- Duplicate folders under Downloads/notes — archive, keep, or delete? (default: **keep, do not delete**)
- `awesome-copilot/` / `copilot-sdk/` — leave gitignored in repo or relocate?

## Cheat sheet (session start)

Per workspace rules, ask:

> "Hey Calum! Want me to pull up your cheat sheet before we get started? (`C:\Users\calumai\.Codex\CALUMS-CHEAT-SHEET.md`)"

Wait for yes/no before heavy work.

## Dev server (only after git is sane)

```powershell
npm run dev
```

API/UI target: **http://localhost:8787** (Wrangler). Requires `.dev.vars` (OpenRouter) — never copy values into memory files.

## Do not start until answered (if still open)

See `OPEN_QUESTIONS.md` and `USER_DECISIONS_CHECKLIST.md` — items marked **blocks work** must be resolved or explicitly deferred with a safe default.
