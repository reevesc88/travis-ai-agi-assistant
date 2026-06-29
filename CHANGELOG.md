# Travis AI — Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added
- Productivity system: TASKS.md (66 tasks, 14 phases), PROJECT_CONTROL.md, AGENTS.md, RISK_REGISTER.md
- Memory system: memory/decisions.md, memory/stack.md, memory/open-fieldservice-audit.md
- Visual dev dashboard: dashboard.html
- Agent handover log: AGENT_HANDOVER.md
- Branch claude/travis-productivity-system-yvvcxi from recovery baseline (SHA 58476a0)

### Fixed
- Corrected Vite dev server port from 5173 to 5000 across all docs
- Corrected Worker entrypoint from src/index.ts to src/server/index.ts
- Fixed task count header (66, not 54)
- Fixed RISK_REGISTER.md R-02 mitigation (removed incorrect connection-pooling/Hyperdrive references)

---

## [0.1.0] — 2026-06-16

### Added
- Initial working app on branch github-working-app-2026-06-16 (SHA 58476a0)
- Preact + Hono + Cloudflare Workers + D1 stack confirmed
- open-fieldservice base integrated: 18 Preact components, 30+ API endpoints
- Field service features: jobs, customers, technicians, invoices, materials, schedule view
- D1 SQLite schema: 10 tables (customers, technicians, service_types, jobs, job_notes,
  job_checklist, materials, job_materials, invoices, invoice_lines)
- Agent mode UI (?agent query param) for AI-optimised access
- wrangler.toml configured for Cloudflare Workers deployment

---

## Version Roadmap

| Version | Target | Milestone |
|---------|--------|----------|
| 0.1.0 | 2026-06-16 | Recovery baseline — field service skeleton |
| 0.2.0 | TBD | Phase 3 complete — auth working |
| 0.3.0 | TBD | Phase 5 complete — receipts parsing via Claude API |
| 0.4.0 | TBD | Phase 9 complete — Excel export working |
| 1.0.0 | TBD | All 14 phases complete — MVP shipped |
