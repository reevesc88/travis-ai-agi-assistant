# Next Actions

## Before restart (done / in progress)

- [x] Create `project-memory/` with restart kit
- [x] Create `.memory/` topic index
- [x] Record verified git/environment snapshot (rebase conflict state)
- [ ] Commit memory to git — **blocked while rebase conflicts unresolved** (files still on disk)
- [ ] Rebuild `C:\Users\calumai\.claude\MEMORY.md` index (separate repo)

## After restart — do first

1. Open `project-memory/START_HERE_AFTER_RESTART.md`
2. Run `git status` in canonical repo
3. If rebase still active → read `RISKS_AND_BLOCKERS.md` → ask Calum: abort, resolve, or use worktree
4. Offer cheat sheet per session rules
5. Update `ENVIRONMENT_STATUS.md` with fresh command output

## After git is sane

1. `npm run build` — confirm green
2. `npm run dev` — confirm :8787
3. Smoke-test auth/views from Replit merge
4. Verify quote routes / `QuotesView` usage
5. Review `origin/main..main` with user before push

## Do not start until answered

| Item | Blocks |
|------|--------|
| Rebase strategy (abort vs continue vs worktree) | All feature dev on canonical checkout |
| Push approval | Remote sync |
| Delete/archive duplicates | Cleanup work |
| Deploy approval | Any production/staging release |

Safe parallel work while blocked: documentation, `project-memory/` updates, read-only GitHub inspection, planning conflict resolution.

## Suggested first user message after restart

> "I'm back after restart. `git status` shows [rebase/clean]. Read `project-memory/START_HERE_AFTER_RESTART.md` and help me choose rebase strategy."
