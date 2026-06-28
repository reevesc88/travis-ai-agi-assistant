# CLAUDE.md — Travis AI Field Service Assistant
# Role: Claude Code (Builder Agent) — Tier 2 Project Config
# Last updated: 2026-06-28

## CRITICAL — Read Before Anything Else

**Travis AI has a diverged history on Calum's PC.** Do NOT assume the GitHub main branch is current.

- **Recovery baseline:** branch `github-working-app-2026-06-16` (SHA `58476a0`)
- **28 local commits** exist on `C:\dev\tools\travis-ai-agi-assistant` (CALSaitop100) that are not on GitHub
- **Recovery requires:** PC (CALSaitop100) + Opus 4.8 + Claude Max Pro plan
- **Do not attempt:** Travis recovery, schema changes, or D1 migrations from web sessions

---

## What This App Is

Travis AI is a **field service management app** for Australian tradespeople — pest control, HVAC, plumbing, cleaning, landscaping, and more.

**Stack:** Cloudflare Workers + Hono + D1 SQLite + Preact/Vite

**Flagship product** of AI1AU Solutions (ai1auslutions.com — Calum Reeves).

Competes with: PestPac, ServiceTitan, Jobber, Housecall Pro, Fieldwork.

---

## Architecture

```
travis-ai-agi-assistant/
├── src/
│   └── index.ts          ← Cloudflare Worker entry point
├── frontend/            ← Preact/Vite frontend
├── agent.md             ← Field Service Scheduler template spec
├── .claude/             ← Claude Code skills + commands
├── .codex/              ← Codex agents (explorer, reviewer, docs-researcher)
├── .agents/             ← Agent definitions
├── skills-lock.json     ← ECC skill bundle lock
├── package.json
├── pnpm-lock.yaml
└── vite.config.ts
```

**Worker entry:** `src/index.ts`
**Frontend:** `frontend/`
**Schema:** D1 SQLite — see `schema.sql` (additive migrations only)

---

## Core Features

- Job scheduling (pending → confirmed → in progress → completed)
- Weekly calendar view with technician colour coding
- Customer management + service history
- Technician dispatch and availability
- Service type catalogue with pricing and durations
- Invoicing (draft/sent/paid/overdue)
- Materials tracking per job
- Job checklists
- Dashboard KPIs (today's schedule, revenue, outstanding invoices)

---

## Development Rules

### Database (D1 SQLite)
- **Migrations: additive ONLY** — never drop tables or columns in production
- Always use `ALTER TABLE ADD COLUMN` (never `DROP`, never `RECREATE`)
- Seed data lives in `schema.sql`

### Testing
- **TDD enforced:** write failing test first, then implement
- Never ship untested D1 migrations
- Test worker entry (`src/index.ts`) and frontend separately

### Git
- Feature branches only — never push to main directly
- Conventional commits
- Draft PR on push; un-draft before merging
- **Current safe branch:** `github-working-app-2026-06-16` — use as recovery baseline

### Cloudflare Workers
- No Node.js APIs — Workers runtime only
- Keep bundle size minimal (Workers free tier: 1MB limit)
- Use `wrangler` for local dev and deployment

---

## Branching Status

| Branch | Status | Notes |
|--------|--------|-------|
| `github-working-app-2026-06-16` | Recovery baseline | SHA `58476a0` — last known good GitHub state |
| `main` | Unknown | May be behind PC local commits |
| `claude/skills-integration-plan-i8w75t` | Feature | Skills integration |
| `claude/wave14-pr-merge-tokens-vey8nr` | Wave 14 | CodeRabbit + Copilot configs |

---

## Ecosystem Context

This repo is part of The Conductor ecosystem:
- **Orchestrator:** The Conductor (Base44 app `6a361353388578905fc5e0cd`)
- **Knowledge hub:** reevesc88/jarvis-command-center (read for context)
- **Conductor brain:** reevesc88/conductor-brain (skills, memory, brand)
- **Brand:** `#F97316` Powerline Orange (LOCKED) — see conductor-brain/ai1auslutions/BRAND-GUIDELINES.md

---

## What NOT To Do

- Do not drop or recreate D1 tables
- Do not use Node.js-specific APIs in Worker code
- Do not push to main directly
- Do not attempt Travis recovery from web sessions (PC + Opus 4.8 required)
- Do not start new features before resolving the 28-commit divergence
- Do not hardcode company names — keep template generic, customise via seed data
