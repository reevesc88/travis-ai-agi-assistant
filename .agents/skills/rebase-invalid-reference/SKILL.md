---
name: rebase-invalid-reference
description: Handle the situation where startGitRebase() fails repeatedly with INVALID_REFERENCE from the Replit river service. Use when the rebase callback keeps returning "Error in river service (git - rebaseOnMainRepl), code: INVALID_REFERENCE" regardless of how many retries are attempted.
---

# Rebase INVALID_REFERENCE Loop

## Symptom

Every call to `startGitRebase()` fails immediately with:

```
Error: Error in river service (git - rebaseOnMainRepl), code: INVALID_REFERENCE,
message: {"url":"git+ssh://git@ssh.worf.replit.dev:/home/runner/workspace"}
```

This happens even when:
- The working tree is clean (`git status` shows nothing to commit)
- No rebase is locally in progress (no `.git/rebase-merge` or `.git/rebase-apply` directories)
- The notebook is restarted (`restart: true`)
- Many retries are attempted across multiple sessions

## Root Cause

This is a **Replit platform-side infrastructure failure**. The river service cannot resolve the SSH remote at `git+ssh://git@ssh.worf.replit.dev:/home/runner/workspace`. It is not a code problem and cannot be fixed by retrying or changing files.

Accumulation of stale `subrepl-*` remotes (all pointing to the same SSH URL) in the repo's git config is a common symptom — visible via `git remote -v`.

## What NOT to Do

- **Do not retry `startGitRebase()` more than 3–4 times.** It will never succeed during a platform outage. Each retry wastes time and context.
- Do not attempt to manually push/fetch to the `subrepl-*` remotes — they require platform-managed SSH certificates.
- Do not call `markRebaseCompleted({ success: true })` spuriously to "unblock" — it may signal a completed rebase that never ran, causing downstream inconsistency.

## Checklist: Is This Really a Platform Issue?

Run these before concluding it's infrastructure:

```bash
git status
ls .git/rebase-merge 2>/dev/null || echo "No rebase-merge"
ls .git/rebase-apply 2>/dev/null || echo "No rebase-apply"
git remote -v
```

If the tree is clean, there's no rebase state, and all `subrepl-*` remotes point to the same SSH URL — it is the platform issue.

## Resolution Options

### Option A — Wait and retry later
The SSH routing issue is transient. Stop retrying, inform the user, and try again in a new session or after the user refreshes/restarts their Replit environment.

### Option B — Abort and report to user
If the task is blocked and can't proceed:

```js
const result = await markRebaseCompleted({ success: false });
console.log(result);
```

Then tell the user:
> "The Replit git infrastructure (river service) is returning INVALID_REFERENCE for the SSH remote used to fetch the main branch. This is a platform-side issue — no code changes are needed. You can try: (1) refreshing this Replit tab, (2) closing and reopening the project, or (3) contacting Replit support if it persists."

### Option C — Verify the code is good and mark complete separately
If all the actual task work (code changes, tests, etc.) is confirmed done and the only blocker is the rebase infrastructure:
1. Confirm with `git log --oneline -10` that commits look correct
2. Confirm `vite build` passes
3. Write `.local/.commit_message`
4. Call `mark_task_complete` — the platform may still commit the work even if the rebase infra is broken

## Context From This Project

This loop was first encountered during the "Add Travis AI & operations pages" task. The six new page components (`ai-assistant.tsx`, `receptionist.tsx`, `inbox-view.tsx`, `suppliers.tsx`, `reports.tsx`, `settings-view.tsx`) were all implemented correctly and `vite build` passed. The `startGitRebase()` call failed on every attempt — dozens of times across two sessions — with INVALID_REFERENCE. The code itself was never the problem.
