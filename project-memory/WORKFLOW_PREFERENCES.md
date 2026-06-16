# Workflow Preferences

Extracted from consolidation chats (parent: [Travis consolidation](b04e3a8f-f372-4f91-8170-ac463358bd8b)), workspace rules, and explicit pre-restart task. Confidence: **strong** where marked.

## Communication & session

- **Cheat sheet prompt** at session start — wait for yes/no before proceeding. (strong)
- **Scope first** — name project/folder before edits in multi-repo `C:\dev` umbrella. (strong)
- Prefer structured output: intent, scope, plan, result — when helpful, not verbose filler. (medium)

## Safety & approvals

- **No delete without approval** — duplicate exports, notes folders, Downloads copies stay until user decides. (strong)
- **No destructive git** — no force push, hard reset, or abort rebase without explicit ask. (strong)
- **No push / deploy** without explicit approval. (strong)
- **No secrets in docs** — `.dev.vars` exists but values never copied to memory. (strong)

## Consolidation & repos

- **Canonical repo:** `C:\dev\tools\travis-ai-agi-assistant` ↔ `reevesc88/travis-ai-agi-assistant` (full app). (strong)
- Do not edit parallel copies; verify remotes on exports (Replit trees may have extra remotes). (strong)
- GitHub cleanup (skeleton vs full vs empty repos) is a **user decision** — do not delete remote repos. (strong)

## Engineering style

- Small changes; preserve quote components when merging Replit work. (strong)
- Verify with commands (`git status`, build) — do not assume prior session state. (strong)
- `awesome-copilot/` / `copilot-sdk/` stay gitignored unless user relocates. (medium)

## Tooling

- Dev: `npm run dev` → port **8787**, OpenRouter via `.dev.vars`. (strong)
- DevFleet `localhost:18801` was unavailable — do not depend on it. (medium)
- graphify: read `graphify-out/GRAPH_REPORT.md` for architecture questions when graph exists. (medium)

## Artifact choice (workflow-from-chats)

These preferences are encoded as **workflow docs** (`project-memory/`, `.memory/`) rather than new Cursor skills, because they are project-specific and restart-oriented.

## Open / contradicted

- **Rebase vs merge** for Replit history — user has not finalized; see `OPEN_QUESTIONS.md`. (contradicted / pending)
