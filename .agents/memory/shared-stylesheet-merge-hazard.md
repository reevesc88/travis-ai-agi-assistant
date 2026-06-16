---
name: Shared stylesheet merge hazard
description: Why the single src/client/styles.css keeps breaking after parallel task merges, and how to check.
---

The whole client app uses ONE stylesheet: `src/client/styles.css` (imported once in `src/client/main.tsx`). The landing page relies entirely on `.lp-*` classes defined there; there is no separate landing CSS file.

**What went wrong (observed):** a parallel schedule task merged its version of `styles.css` and (a) dropped the entire "Travis — Marketing Landing Page" `.lp-*` block, leaving the landing page completely unstyled, and (b) left an unclosed brace (`.schedule-swipe-hint` missing its `}`), which swallowed every rule after it in the cascade — so even re-added landing styles wouldn't apply.

**Why this matters:** because everything lives in one file, two agents editing styles in isolated environments produce merge results that can silently delete sibling sections or corrupt brace balance. A unstyled page or a "my CSS isn't applying" symptom is usually this, not your own edit.

**How to apply / checklist after any merge or edit touching styles.css:**
- Brace balance must match: `echo "$(grep -o '{' src/client/styles.css | wc -l) $(grep -o '}' src/client/styles.css | wc -l)"` — the two numbers must be equal. An off-by-one means an unclosed rule is eating the cascade.
- Confirm landing styles still exist: `grep -c "lp-" src/client/styles.css` should be ~160+, not 0.
- To recover a lost block, pull it from the last good commit, e.g. `git show <commit>:src/client/styles.css | sed -n '<start>,<end>p'` and re-append. The landing block is delimited by the `/* Travis — Marketing Landing Page */` banner comment through EOF.
- If a symptom is "page renders as plain HTML / default link + button styling," suspect an unclosed brace earlier in the file, not a missing class.
