# User Decisions Checklist

Uncheck all unless Calum has **clearly decided** in chat. Agents tick only with explicit user confirmation.

## Build & code

- [ ] Resolve rebase by continuing conflict resolution (not abort)
- [ ] Resolve rebase by aborting and returning to `8fa5b53` on `main`
- [ ] Use worktree `main-1` as temporary dev root while rebase pending
- [ ] Run `npm run build` and fix all errors before any feature work
- [ ] Wire / expose Quotes UI in router (if currently unused)
- [ ] Fix manifest + `styles.css` linkage for production build

## Git & GitHub

- [ ] Push local `main` to `origin` (25 ahead)
- [ ] Pull/reconcile 1 commit behind `origin/main` before push
- [ ] Delete or archive duplicate local folders (Downloads / notes)
- [ ] Clean up GitHub repos (`travis_new`, `open-fieldservice` roles)
- [ ] Remove extra remotes from export copies (Replit)

## System & environment

- [ ] Install / expose `wrangler` globally on PATH
- [ ] Restore DevFleet on port 18801
- [ ] Relocate `awesome-copilot/` and `copilot-sdk/` outside repo
- [ ] Add `project-memory/` to version control (committed)
- [ ] Keep `project-memory/` local-only (gitignored) — **not preferred per pre-restart task**

## Agent behaviour

- [ ] Always offer cheat sheet at session start (workspace default: yes, wait for answer)
- [ ] Agents may run `npm install` when dependencies change
- [ ] Agents may `wrangler deploy` to staging/production when asked
- [ ] Agents may delete duplicate trees after backup confirmation
