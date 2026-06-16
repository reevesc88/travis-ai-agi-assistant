---
name: agent-skill-addition-or-update
description: Workflow command scaffold for agent-skill-addition-or-update in travis-ai-agi-assistant.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /agent-skill-addition-or-update

Use this workflow when working on **agent-skill-addition-or-update** in `travis-ai-agi-assistant`.

## Goal

Adds or updates one or more agent skills, including documentation, scripts, references, and assets.

## Common Files

- `.agents/skills/*/SKILL.md`
- `.agents/skills/*/README.md`
- `.agents/skills/*/scripts/*`
- `.agents/skills/*/references/*`
- `.agents/skills/*/assets/*`
- `.agents/skills/*/metadata.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update SKILL.md and related documentation files in .agents/skills/<skill-name>/
- Add or update scripts (e.g., Python, JS) in .agents/skills/<skill-name>/scripts/
- Add or update references and supporting assets (images, data, schemas) in .agents/skills/<skill-name>/references/ or assets/
- Update LICENSE.txt and metadata files as needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.