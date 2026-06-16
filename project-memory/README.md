# Project Memory — Travis AI Field Service

Persistent, human- and agent-readable state for `C:\dev\tools\travis-ai-agi-assistant` (`@clawnify/open-fieldservice`).

## Purpose

Survive full machine restarts and new agent sessions without re-discovering git state, duplicate trees, consolidation decisions, or environment setup.

## How agents should use this

1. **Open `START_HERE_AFTER_RESTART.md` first** — every session after a restart or cold start.
2. Read `PROJECT_STATE.md` and `ENVIRONMENT_STATUS.md` for current facts (verify with commands; do not trust stale dates).
3. Follow `AGENT_INSTRUCTIONS.md` and `WORKFLOW_PREFERENCES.md` for standing rules.
4. Check `OPEN_QUESTIONS.md` and `USER_DECISIONS_CHECKLIST.md` before risky actions (push, delete, rebase, deploy).
5. Use `CLI_COMMANDS.md`, `FILES_AND_PATHS.md`, `RISKS_AND_BLOCKERS.md`, and `NEXT_ACTIONS.md` as needed.
6. **Update** `PROJECT_STATE.md`, `ENVIRONMENT_STATUS.md`, and `NEXT_ACTIONS.md` before ending a session.

## Also see

- Workspace graph memory: `.memory/index.md` (topic index, minimal entries)
- Global Claude index: `C:\Users\calumai\.claude\MEMORY.md`

## Last updated

2026-06-13 — pre-restart memory bootstrap (interactive rebase in progress; see `PROJECT_STATE.md`).
