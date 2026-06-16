# CLI Commands

Canonical root: `C:\dev\tools\travis-ai-agi-assistant`

## Daily dev

```powershell
cd C:\dev\tools\travis-ai-agi-assistant
git status                    # always first after restart
npm run dev                   # D1 schema + Vite + wrangler on :8787
npm run build                 # Vite production build — only when tree is clean
```

## Git (safe)

```powershell
git status
git log -3 --oneline
git branch -vv
git remote -v
git diff --name-only --diff-filter=U   # list conflicted files during rebase
git log origin/main..main --oneline    # unpushed commits
```

## Git — requires explicit user approval

```powershell
git push -u origin main
git push --force-with-lease            # NEVER without explicit ask
git rebase --abort
git rebase --continue
git reset --hard
git clean -fdx
```

## Wrangler / D1 (after rebase resolved)

```powershell
npx wrangler dev --port 8787
npx wrangler d1 execute open-fieldservice-db --local --file=src/server/schema.sql
npx wrangler deploy                    # DO NOT RUN without approval
```

## Recovery

```powershell
# See conflict list
git status

# Inspect a conflicted file
git diff path/to/file

# If user approves abort rebase (returns to pre-rebase branch state — confirm with user)
# git rebase --abort

# Alternative isolated worktree (exists on machine)
# cd C:\dev\tools\travis-ai-agi-assistant.worktrees\main-1
```

## GitHub (read-only ok)

```powershell
gh repo view reevesc88/travis-ai-agi-assistant
gh repo view reevesc88/open-fieldservice
```

## Do not run without approval

- `npm install` / `npm ci` (unless user requests or lockfile fix required)
- `wrangler deploy`
- `git push` / `git push --force`
- `git rebase --abort` / `git reset --hard`
- Deleting anything under `Downloads\` or notes folders
- Reading or echoing `.dev.vars`

## Memory maintenance

```powershell
# Update project-memory after sessions (manual edit)
code project-memory\PROJECT_STATE.md
```

Global index rebuild lives in `C:\Users\calumai\.claude` — see memory-rebuild skill.
