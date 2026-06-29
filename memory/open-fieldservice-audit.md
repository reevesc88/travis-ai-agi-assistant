# open-fieldservice Repo Audit
# Audited: 2026-06-28 by Claude Code (P0-05)
# Repo: reevesc88/open-fieldservice
# Licence: AGPL-3.0

---

## Purpose

Production-ready, open-source field service management platform.
Alternative to PestPac, ServiceTitan, FieldWork, Jobber, Housecall Pro.
Vertical-agnostic: pest control, HVAC, plumbing, cleaning, landscaping, electrical, pool,
appliance repair, locksmith, painting, roofing, garage door.

---

## Tech Stack (confirmed identical to Travis)

| Layer | Technology |
|-------|------------|
| Frontend | Preact 10.25.0, TypeScript 5.7.0, Vite 6.0.0 |
| Backend | Hono 4.6.0, @hono/zod-openapi 0.18.0 |
| Database | SQLite via @clawnify/db (local) / D1 (Cloudflare) |
| Runtime | Cloudflare Workers (wrangler 4.0) |
| Package mgr | pnpm |

---

## Directory Structure

```text
open-fieldservice/
├── src/
│   ├── client/          ← Preact frontend
│   └── server/          ← Hono REST API
│       ├── index.ts     ← 45.5 KB — full API implementation
│       ├── schema.sql   ← 6.3 KB — all table definitions
│       └── db.ts        ← SQLite wrapper
├── index.html
├── manifest.json
├── package.json
├── wrangler.toml
├── tsconfig.json
├── vite.config.ts
├── agent.md             ← Agent-optimised usage docs
└── clawnify.json
```

---

## D1 Schema (10 tables)

| Table | Purpose |
|-------|--------|
| customers | CRM: contact info, address, service history link |
| technicians | Staff: name, colour code, availability |
| service_types | Catalogue: name, duration, price, category |
| jobs | Core entity: customer, tech, service, status, dates |
| job_notes | Activity log: timestamped notes per job |
| job_checklist | Inspection items per job |
| materials | Inventory: name, unit, unit cost |
| job_materials | M2M: materials used per job |
| invoices | Billing: status (draft/sent/paid/overdue), amounts |
| invoice_lines | Line items on each invoice |

**Travis will ADD to this schema** (never drop/recreate):
- users, receipt_uploads, line_items, categories, export_history

---

## Preact Components (18 files)

### Layout
- sidebar.tsx — navigation
- dashboard.tsx — KPI cards and summary
- error-banner.tsx
- pagination.tsx

### Jobs
- job-list.tsx, job-row.tsx, job-detail.tsx, create-job.tsx

### Customers
- customer-list.tsx, customer-detail.tsx, create-customer.tsx

### Technicians
- technician-list.tsx, create-technician.tsx

### Services
- service-type-list.tsx, create-service-type.tsx

### Invoices
- invoice-list.tsx, invoice-detail.tsx

### Materials
- material-list.tsx

### UI
- status-badge.tsx, schedule-view.tsx

### Core Hooks
- use-app.ts (17.9 KB) — all state management and CRUD operations
- use-router.ts (1.2 KB) — pushState URL routing

---

## API Endpoints (30+)

All in src/server/index.ts (45.5 KB). Key groups:

| Group | Endpoints |
|-------|----------|
| Stats | GET /api/stats |
| Schedule | GET /api/schedule |
| Jobs | CRUD + notes + checklist + materials |
| Customers | CRUD + service history |
| Technicians | CRUD |
| Service Types | CRUD |
| Invoices | CRUD + line items |
| Materials | CRUD |

---

## Agent Mode

Query param `?agent` activates AI-optimised UI:
- Explicit delete/action buttons always visible
- Large click targets
- All controls accessible without drag interactions

**Travis should preserve this.** AI agents (Antigravity) will use it for E2E testing.

---

## Key Integration Notes for Travis

1. **Do not delete any existing tables** — additive migrations only (D1 constraint + AGPL)
2. **AGPL-3.0 licence** — must keep attribution in README and footer
3. **use-app.ts is the state layer** — Travis receipt features should follow the same hook pattern
4. **Vite proxy** — /api/* already proxied to :8787 in vite.config.ts; Travis API routes follow same pattern
5. **Agent mode** — preserve ?agent param for QA automation

---

## Branches

- main (SHA: 0147eaf) = master (SHA: 0147eaf) — same commit, two branch names
