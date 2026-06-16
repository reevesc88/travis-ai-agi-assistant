# Open Questions

Checkbox format. Resolve with Calum after restart. **Safe default** = what agents should do if unanswered.

---

## Git & history

- [ ] **Rebase in progress:** abort, continue resolving, or use worktree `main-1` for feature work?
  - **Why it matters:** Entire tree has dozens of "both added" conflicts; build/dev blocked on canonical checkout.
  - **Safe default:** Do not run `rebase --abort` or `push`; read conflicts; propose resolution plan; no code changes until strategy chosen.

- [ ] **Push 25 commits on `main` to `origin`?**
  - **Why it matters:** Local work not on GitHub; also 1 commit behind remote.
  - **Safe default:** Do not push; document `git log origin/main..main` for user review.

- [ ] **Rebase vs merge** for integrating Replit export history going forward?
  - **Why it matters:** Current rebase may replay many old commits and re-trigger conflicts.
  - **Safe default:** Prefer documenting current state; ask before starting new history rewrite.

---

## Duplicates & cleanup

- [ ] **Archive or delete** `C:\Users\calumai\Downloads\Travis-construction-assistant` and notes-folder copies?
  - **Why it matters:** Confusion about which tree is canonical; risk of editing wrong copy.
  - **Safe default:** **Keep all copies; do not delete.** Edit only `C:\dev\tools\travis-ai-agi-assistant`.

- [ ] **GitHub repo cleanup:** keep `open-fieldservice` as skeleton, archive `travis_new`, rename anything?
  - **Why it matters:** Three repos (`travis-ai-agi-assistant`, `open-fieldservice`, `travis_new`) with different completeness.
  - **Safe default:** No remote deletes; no force push; document purposes in `FILES_AND_PATHS.md`.

---

## Repo layout & tooling

- [ ] **Move `awesome-copilot/` and `copilot-sdk/`** out of repo root to another path?
  - **Why it matters:** Large gitignored dirs; disk bloat; may confuse agents.
  - **Safe default:** Leave in place, gitignored; do not commit.

- [ ] **`QuotesView` unused?** Is quotes UI fully routed and reachable post-merge?
  - **Why it matters:** Merge preserved quote components; routing may be incomplete.
  - **Safe default:** Grep for `QuotesView` / quote routes before removing anything.

- [ ] **`manifest` / `styles.css`:** PWA manifest and split CSS — correct link order and entry in `index.html` / Vite?
  - **Why it matters:** Replit merge split styles; broken manifest hurts install/branding.
  - **Safe default:** Inspect `index.html` and built assets after rebase; no deletes.

---

## Operations

- [ ] **DevFleet** at `localhost:18801` — fix, ignore, or replace?
  - **Why it matters:** Was unavailable during consolidation.
  - **Safe default:** Do not block Travis work on DevFleet.

- [ ] **Commit `project-memory/` to git** — already intended; confirm after rebase resolved?
  - **Why it matters:** Persistence across clones; rebase may block commit until conflicts fixed.
  - **Safe default:** Files on disk survive restart even if commit delayed.
