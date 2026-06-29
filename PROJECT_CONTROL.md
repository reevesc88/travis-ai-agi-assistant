# Travis AI — Project Control
# Version: v0.1.0
# Last updated: 2026-06-28
# Stack: Preact + Hono + Cloudflare Workers + D1 + R2

---

## What Travis Is

Travis is an AI-powered receipt and invoice management platform for Australian sole traders
and small businesses. It is the flagship product of AI1AU Solutions (ai1auslutions.com).

**Core user problem:** sole traders are drowning in paper receipts and manual bookkeeping.
Travis digitises the entire workflow: upload → parse → categorise → export to Excel for your accountant.

**Digital-first principle:** prefer digital receipts (email, PDF). Photos are fallback only.

**Base codebase:** fork and extend `reevesc88/open-fieldservice` (AGPL-3.0).

---

## Target Users

- Pest control operators, HVAC techs, plumbers, cleaners, landscapers, electricians
- Sole traders and small businesses (1–20 employees)
- Australian — ATO tax categories apply
- Not tech-savvy — UI must be dead simple

---

## MVP Feature Set (29 features)

### Must Ship
1. User accounts (email-based auth)
2. Digital receipt upload (PDF)
3. Image upload fallback (JPG/PNG)
4. Email receipt import (EML/forwarding)
5. R2 file storage
6. D1 metadata storage
7. PDF text extraction
8. OCR placeholder (images → manual review queue)
9. Data parsing (vendor, date, total, GST via Claude API)
10. Line item extraction
11. ATO category auto-assignment
12. Unknown item review queue
13. User correction interface
14. Excel export (xlsx)
15. Export history
16. Basic dashboard (KPI cards)
17. Receipt list view
18. Receipt detail view
19. Category management
20. Settings page
21. Hono REST API (Cloudflare Workers)
22. D1 SQLite schema
23. Security foundation (auth middleware, input validation)
24. Testing plan
25. Risk register
26. Changelog
27. Visual dev dashboard (dashboard.html)
28. Multi-agent oversight (AGENTS.md)
29. Field service management (jobs, customers, invoices — from open-fieldservice)

### Out of Scope v1
- Apple Pay / Google Pay
- Bank account integration
- Accounting software integration (Xero, MYOB)
- ATO direct lodgement
- Enterprise ERP
- Production AI model training

---

## Phase Gate Status

| Phase | Name | Status | Gate Condition |
|-------|------|--------|---------------|
| P0 | Workspace Consolidation | 🔄 In Progress | All source docs read, open-fieldservice audited |
| P1 | Project Setup | ⬜ Not started | Dev environment confirmed running |
| P2 | App Skeleton | ⬜ Not started | All 18 OS components load; Travis routes added |
| P3 | Authentication | ⬜ Not started | Login/logout working; middleware protecting /api/* |
| P4 | Receipt Upload | ⬜ Not started | File lands in R2; metadata in D1 |
| P5 | Receipt Parsing | ⬜ Not started | Structured JSON extracted via Claude API |
| P6 | Line Items | ⬜ Not started | Items visible and editable in UI |
| P7 | Categorisation | ⬜ Not started | ATO categories assigned; user can override |
| P8 | Review Interface | ⬜ Not started | Receipt detail view fully editable |
| P9 | Excel Export | ⬜ Not started | xlsx downloads with correct data |
| P10 | Dashboard | ⬜ Not started | All 4 KPI cards live from D1 |
| P11 | Testing | ⬜ Not started | ≥80% coverage on src/server/ |
| P12 | Integration-Ready | ⬜ Not started | OpenAPI schema published |
| P13 | Documentation | ⬜ Not started | User guide + API reference complete |

---

## Quick Start (Dev)

```bash
# 1. Clone
git clone https://github.com/reevesc88/travis-ai-agi-assistant
cd travis-ai-agi-assistant

# 2. Install
pnpm install

# 3. Configure
cp .env.example .env
# Fill in CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, ANTHROPIC_API_KEY

# 4. Run
pnpm run dev
# API: http://localhost:8787
# UI:  http://localhost:5000
```

---

## Recovery Baseline

If anything breaks: branch `github-working-app-2026-06-16` (SHA `58476a0`) is the last
known-good GitHub state. Do NOT delete this branch.

PC-local commits (28 ahead of GitHub on CALSaitop100): recover on PC with Opus 4.8 + Claude Max.
