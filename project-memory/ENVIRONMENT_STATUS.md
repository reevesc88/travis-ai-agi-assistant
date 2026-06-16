# Environment Status

**Captured:** 2026-06-13 (pre restart)

## OS & shell

| Item | Value |
|------|--------|
| OS | Windows 10.0.26200 (win32) |
| Shell | PowerShell |
| Workspace | `C:\dev\tools\travis-ai-agi-assistant` |

## Runtimes (verified)

| Tool | Version / path |
|------|----------------|
| Node | v24.14.0 (`C:\Program Files\nodejs\node.exe`) |
| npm | 11.9.0 |
| Python | 3.11.15 (Hermes venv: `...\hermes-agent\venv\Scripts\python.exe`) |
| wrangler | **Not on PATH** at snapshot; use `npx wrangler` or project `node_modules` |

## Git (canonical repo)

```
Interactive rebase in progress onto 6049f62
Unmerged paths: 20+ files (both added) — see PROJECT_STATE.md
main @ 8fa5b53 (when not rebasing): ahead 25, behind 1 vs origin/main
origin: https://github.com/reevesc88/travis-ai-agi-assistant
```

## npm / build

- `package.json` scripts: `dev`, `build`
- **Build not re-run** during bootstrap — blocked by rebase conflicts; last known good: passed before rebase per prior session
- `node_modules/` assumed present (no `npm install` run this session)

## Ports & services

| Port | Status at snapshot |
|------|---------------------|
| 8787 | No listener found (`netstat`) |
| 18801 | DevFleet — reported unavailable |

## Secrets & config

| File | Present |
|------|---------|
| `.dev.vars` | **Yes** (OpenRouter — do not read or log contents) |
| `.wrangler/` | Gitignored; temp bundles may exist untracked |

## Broken / missing tools

- DevFleet @ localhost:18801
- `wrangler` global CLI not found (may work via npx)
- **Git rebase conflicts** — primary blocker

## Re-verify after restart

```powershell
cd C:\dev\tools\travis-ai-agi-assistant
git status
node -v && npm -v
Test-Path .dev.vars
netstat -ano | findstr :8787
```

Update this file when any value changes.
