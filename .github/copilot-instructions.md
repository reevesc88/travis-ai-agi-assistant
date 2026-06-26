# GitHub Copilot Instructions — travis-ai-agi-assistant

## What this is
Travis AI — a field service management app for Australian tradespeople.

## Stack
- Runtime: Cloudflare Workers + Hono framework
- Database: D1 SQLite (Cloudflare)
- Frontend: Preact + Vite
- Entry point: `src/index.ts`
- Frontend root: `frontend/`

## Owner
Calum Reeves (@reevesc88), AI1AU Solutions, Perth WA.

## Coding conventions
- TypeScript throughout
- D1 migrations: additive only — never drop or rename columns in production
- TDD workflow: failing test first, then implementation, then verify coverage
- No hardcoded data — wire everything to real D1 endpoints

## Critical note
28 local commits exist on the PC that are NOT on GitHub.
Do not attempt to reconcile history remotely — PC access required.

## Do not
- Add DROP TABLE or DROP COLUMN to any D1 migration
- Push to main directly
- Add hardcoded dummy data to production code
- Commit secrets or API keys
