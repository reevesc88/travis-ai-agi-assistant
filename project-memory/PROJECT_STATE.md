# Project State

**Recorded:** 2026-06-16 (git verified live)

## Identity

| Field | Value |
|-------|--------|
| Name | Travis AI Field Service / Open Field Service |
| npm package | `@clawnify/open-fieldservice` |
| Goal | Field-service scheduling app (pest, HVAC, plumbing, etc.) on Cloudflare Workers |
| Canonical path | `C:\dev\tools\travis-ai-agi-assistant` |
| GitHub (full app) | `https://github.com/reevesc88/travis-ai-agi-assistant` |
| GitHub (skeleton) | `reevesc88/open-fieldservice` |
| Stack | Cloudflare Workers + Hono + D1 + Preact/Vite + Wrangler |

## Git status (verified 2026-06-16)

**Live:** On branch `main`, **working tree clean** — no interactive rebase in progress.

- **HEAD:** `700044e` — `fix: fail closed on missing JWT_SECRET and align quote statuses`
- **Prior tip:** `0a0ff42` — `docs: sync project memory before profile migration`
- **Tracking:** `main` **diverged** from `origin/main` — **ahead 28, behind 1** (no merge-base; unrelated histories)
- **`origin/main`:** `6049f62` — `Travis AI field-service app — full codebase` (not in local `main` ancestry)
- **Remote:** `origin` → `https://github.com/reevesc88/travis-ai-agi-assistant`
- **Not pushed** — 26 local commits not on GitHub; push requires explicit approval and a reconcile strategy

### Other local branches (reference)

`develop`, `replit-agent`, multiple `subrepl-*` branches, worktree `main-1` at `C:\dev\tools\travis-ai-agi-assistant.worktrees\main-1`.

## Completed (consolidation arc)

- Replit export merge: auth views, CSS split, trial/gcal integration into canonical tree (per prior session; quote components preserved)
- Prior shell wiring commit: `a089351` (historical)
- `npm run build` had passed on clean tree before rebase (re-verify after rebase)
- `.gitignore` includes: `.dev.vars`, `.wrangler/`, `awesome-copilot/`, `copilot-sdk/`, `graphify-out/`

## Incomplete / broken

- **Git divergence** — local `main` and `origin/main` do not share history; push/pull needs a chosen strategy (not a simple fast-forward)
- Unpushed commits on `main` (26 ahead of `origin/main`)
- Duplicate trees **not** removed: `Downloads\Travis-construction-assistant`, notes-folder copies
- DevFleet unavailable at `localhost:18801`
- `wrangler` CLI not on PATH in verification (may be via `npx wrangler` / local `node_modules`)

## Assumptions (verify after restart)

- OpenRouter via `.dev.vars` (file exists; contents not logged)
- Dev port **8787** was not listening at snapshot time
- Local gitignored bloat on disk: `awesome-copilot/`, `copilot-sdk/`, `.wrangler/tmp/`

## Issues to track

1. Rebase vs merge strategy for Replit history
2. Whether `QuotesView` / quote UI is fully wired post-merge
3. `manifest` / `styles.css` linkage if PWA or static assets involved
4. Whether to push before or after conflict resolution
