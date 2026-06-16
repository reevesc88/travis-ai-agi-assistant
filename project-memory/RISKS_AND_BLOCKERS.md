# Risks and Blockers

**Updated:** 2026-06-16 (git verified live)

## Critical blockers

### 1. Diverged git history (not a simple push)

- **Symptom:** `main` **ahead 28, behind 1** vs `origin/main`; branches diverged (no common merge-base).
- **Impact:** `git push` will fail or require force; `git pull` may create a merge of unrelated histories.
- **Risk:** Wrong push strategy could overwrite GitHub or create a messy merge commit.
- **Mitigation:** User chooses reconcile strategy before push. See `OPEN_QUESTIONS.md`. **Do not** force-push without explicit approval.

### 2. Unpushed local history

- **Symptom:** `main` ahead **28**, behind **1** vs `origin/main`.
- **Impact:** GitHub does not reflect local merge work; collaborators see stale `main`.
- **Risk:** Push while histories are unrelated could corrupt remote or require force.
- **Mitigation:** No push until user approves and reconcile strategy is chosen.

## High risks

### Duplicate directory trees

- Multiple copies (Downloads, notes) increase chance agents edit wrong repo.
- **Mitigation:** Scope rules in `AGENT_INSTRUCTIONS.md`; default keep all copies.

### Replit remotes on exports

- Export folders may retain Replit/Git remotes pointing elsewhere.
- **Mitigation:** `git remote -v` in any non-canonical folder before operations.

### Credentials

- `.dev.vars` exists locally; must never enter memory files or commits.
- **Mitigation:** Gitignore confirmed; agents must not `cat` or log it.

## Medium risks

| Risk | Detail |
|------|--------|
| wrangler not on PATH | Use `npx wrangler`; document in ENVIRONMENT_STATUS |
| DevFleet down | Port 18801 unavailable — parallel agent orchestration off |
| Gitignored disk bloat | `awesome-copilot/`, `copilot-sdk/` — confusion, not git pollution |
| Quotes / manifest uncertainty | Post-merge wiring may be incomplete |

## Low risks

- `OVERNIGHT.md` untracked — review before committing
- Modified scripts under `.agents/skills/` — unrelated to Travis app; don't mix into app commits

## What is NOT a blocker for reading memory

- Full computer restart — `project-memory/` and `.memory/` are on disk
- Missing push — local files still present

## Escalation to user

Ask Calum before:

1. Choosing git reconcile strategy or `git push` / force-push
2. Deleting any duplicate folder
3. `wrangler deploy`
4. Choosing conflict resolution strategy for core app files
