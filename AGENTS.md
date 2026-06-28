# Travis AI — Multi-Agent Coordination Rules
# Last updated: 2026-06-28

---

## Agent Roster

| Agent | ID | Role | Tools | Model |
|-------|----|------|-------|-------|
| Claude Code | CC | Builder / Implementation | GitHub MCP, Cloudflare MCP, filesystem | claude-sonnet-4-6 |
| Codex | CX | Code review, docs | GitHub | openai-codex |
| Antigravity | AG | E2E testing, evaluation | Playwright, browser | — |
| Hermes | HE | Memory, orchestration, research | GBrain, Gmail, Drive | NousResearch |
| The Conductor | TC | Orchestrator | Base44, all MCPs | Base44 superagent |

**Claude Code is the Builder agent.** It does not act as orchestrator.
Tasks that require cross-system coordination go to The Conductor.

---

## Operating Rules

### All Agents
1. Read PROJECT_CONTROL.md and TASK_TRACKER status before starting any task
2. Claim a task by setting status to `[~]` in TASKS.md before working
3. Write to AGENT_HANDOVER.md if blocked or handing off
4. Never push to main or github-working-app-2026-06-16 directly
5. All work on feature branches; PRs required before merge
6. Never drop or recreate D1 tables — additive migrations only

### Claude Code (Builder)
- May: read/write files, run git ops, call GitHub MCP, call Cloudflare MCP
- May NOT: act as orchestrator, delete branches without confirmation, commit secrets
- Must: write failing test before implementing any feature (TDD)
- Must: update TASKS.md task status on completion
- Must: write new durable facts to memory/ files immediately

### Codex (Reviewer)
- Reviews PRs opened by Claude Code
- Flags security issues, logic errors, D1 migration risks
- Does not push code directly — comments on PRs only

### Antigravity (QA)
- Runs E2E tests in Phase 11 and on every PR to main
- Uses Playwright against local dev (localhost:5173) or staging Workers URL
- Reports failures as GitHub issues

### Hermes (Memory / Research)
- Maintains memory/ files and GBrain index
- Reads source documents (MyBusinessBlox overview, AI coding doc) on request
- Research tasks: competitor analysis, ATO tax category research, pricing

---

## Handover Protocol

When Claude Code is blocked or a task exceeds scope, write to AGENT_HANDOVER.md:

```
---
HANDOVER: [date] [FROM] → [TO]
Task: [task ID and description]
Status: [what was done]
Blocker: [what is needed]
Files changed: [list]
Next action: [specific recommended action]
---
```

---

## Task Claiming Protocol

1. Pick the next `[ ]` task from TASKS.md in the current phase
2. Change `[ ]` to `[~]` and add your agent ID in the Agent column
3. Complete the task
4. Change `[~]` to `[x]`
5. Commit with message format: `feat(P{phase}-{id}): {description}`

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `github-working-app-2026-06-16` | Recovery baseline — NEVER modify |
| `main` | Production — PRs only, no direct push |
| `claude/travis-productivity-system-yvvcxi` | Current dev branch |
| `claude/*` | Feature branches created by Claude Code |

---

## Conflict Resolution

If two agents disagree on an approach:
1. Log both positions in memory/decisions.md
2. Escalate to The Conductor (Base44 superagent ID: 6a361353388578905fc5e0cd)
3. Conductor decision is final and must be logged with rationale
