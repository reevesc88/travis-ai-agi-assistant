---
name: project-memory-update
description: Workflow command scaffold for project-memory-update in travis-ai-agi-assistant.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /project-memory-update

Use this workflow when working on **project-memory-update** in `travis-ai-agi-assistant`.

## Goal

Updates project memory and documentation files to reflect current state, decisions, next actions, and environment.

## Common Files

- `project-memory/*.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or update markdown files in project-memory/ (e.g., AGENT_INSTRUCTIONS.md, NEXT_ACTIONS.md, ENVIRONMENT_STATUS.md)
- Commit changes to keep project documentation up to date

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.