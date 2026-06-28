# Travis AI — Master Task List
# 54 tasks across 14 phases
# Last updated: 2026-06-28
# Stack: Preact + Hono + Cloudflare Workers + D1 + R2

---

## How to Read This File

- Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked
- Priority: P0 = must ship for MVP · P1 = important · P2 = nice to have
- Agent: CC = Claude Code · CX = Codex · AG = Antigravity · HE = Hermes

---

## Phase 0 — Workspace Consolidation

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P0-01 | [ ] | P0 | CC | Read MyBusinessBlox Platform Overview (282k chars — use chunked reading, 350 lines at a time) |
| P0-02 | [ ] | P0 | CC | Read remaining AI coding agent document (117k chars — chunk from line 201 onward) |
| P0-03 | [ ] | P1 | CC | Unzip Cost-Estimation archive and review contents |
| P0-04 | [ ] | P2 | CC | Review 0edd31f9.mkv video for additional product context |
| P0-05 | [x] | P0 | CC | Audit open-fieldservice base repo — captured in memory/open-fieldservice-audit.md |
| P0-06 | [ ] | P0 | CC | Confirm or update Cloudflare stack decision in memory/decisions.md |

---

## Phase 1 — Project Setup

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P1-01 | [ ] | P0 | CC | Confirm repo structure matches Blueprint (src/, frontend/, .claude/, memory/, docs/) |
| P1-02 | [ ] | P0 | CC | Verify wrangler.toml has correct D1 + R2 + Queue bindings |
| P1-03 | [ ] | P0 | CC | Create .env.example with all required env vars documented |
| P1-04 | [ ] | P0 | CC | Verify pnpm run dev starts both Vite (5173) and Wrangler (8787) |
| P1-05 | [ ] | P1 | CC | Set up Vitest for unit tests |
| P1-06 | [ ] | P1 | CC | Set up GitHub Actions CI (pnpm install → pnpm test → wrangler deploy dry-run) |
| P1-07 | [ ] | P1 | CC | Add DECISION_LOG.md entry for every choice made in Phase 0 |
| P1-08 | [ ] | P2 | CX | Review open-fieldservice AGPL-3.0 licence obligations — confirm attribution in README |

---

## Phase 2 — App Skeleton (based on open-fieldservice)

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P2-01 | [ ] | P0 | CC | Merge/adapt open-fieldservice src/server/schema.sql into Travis D1 schema (additive only) |
| P2-02 | [ ] | P0 | CC | Add receipt_uploads, line_items, categories, export_history tables to schema |
| P2-03 | [ ] | P0 | CC | Wire D1 binding in src/index.ts (Hono app entry) |
| P2-04 | [ ] | P0 | CC | Confirm all 18 open-fieldservice Preact components load without errors |
| P2-05 | [ ] | P0 | CC | Add Travis-specific routes to Hono router (prefix /api/v1/) |
| P2-06 | [ ] | P1 | CC | Smoke test: pnpm run dev → open localhost:5173 → confirm sidebar + dashboard render |

---

## Phase 3 — Authentication

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P3-01 | [ ] | P0 | CC | Choose auth strategy — Cloudflare Access (zero-config) vs JWT (custom) — log decision |
| P3-02 | [ ] | P0 | CC | Add users table to D1 schema (id, email, name, created_at) |
| P3-03 | [ ] | P0 | CC | Implement auth middleware in Hono (validate token on all /api/* routes) |
| P3-04 | [ ] | P0 | CC | Add login/logout UI to Preact app (minimal — email + magic link or OAuth) |
| P3-05 | [ ] | P1 | CC | Write auth unit tests (valid token, expired token, missing token) |

---

## Phase 4 — Receipt Upload

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P4-01 | [ ] | P0 | CC | Create R2 bucket (travis-receipts) in wrangler.toml |
| P4-02 | [ ] | P0 | CC | Implement POST /api/v1/receipts/upload — multipart form → R2 → metadata to D1 |
| P4-03 | [ ] | P0 | CC | Build upload UI component (drag-drop + file picker, PDF + image + email EML support) |
| P4-04 | [ ] | P0 | CC | Add receipt_uploads table row on successful upload (id, user_id, filename, r2_key, mime_type, uploaded_at, status) |
| P4-05 | [ ] | P1 | CC | Write upload integration test (mock R2 + D1) |

---

## Phase 5 — Receipt Parsing

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P5-01 | [ ] | P0 | CC | Implement PDF text extraction (Cloudflare Workers supports pdf-parse via WASM) |
| P5-02 | [ ] | P0 | CC | Add OCR placeholder for image receipts — log to D1 with status=needs_ocr for manual review |
| P5-03 | [ ] | P0 | CC | Create Cloudflare Queue (travis-parse-queue) — move parsing off request handler (50ms CPU limit R-07) |
| P5-04 | [ ] | P0 | CC | Queue consumer: extract raw text → call Claude API → store structured JSON in D1 |
| P5-05 | [ ] | P1 | CC | Add parsing status field to receipt_uploads (pending, parsing, parsed, failed) |
| P5-06 | [ ] | P1 | AG | Evaluate Claude API prompt for receipt parsing accuracy (target: vendor, date, total, GST) |

---

## Phase 6 — Line Items

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P6-01 | [ ] | P0 | CC | Add line_items D1 table (id, receipt_id, description, quantity, unit_price, total, category_id) |
| P6-02 | [ ] | P0 | CC | Implement line item extraction in Claude API parsing prompt |
| P6-03 | [ ] | P0 | CC | Build line item review UI — editable table per receipt |
| P6-04 | [ ] | P1 | CC | PUT /api/v1/receipts/:id/line-items — save user corrections |

---

## Phase 7 — Categorisation

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P7-01 | [ ] | P0 | CC | Add categories D1 table (id, name, colour, is_default) — seed with 10 default ATO categories |
| P7-02 | [ ] | P0 | CC | Auto-categorise line items in Claude API parsing prompt |
| P7-03 | [ ] | P0 | CC | Build category management UI (list, add, edit, delete) |
| P7-04 | [ ] | P1 | CC | PUT /api/v1/line-items/:id — save user category correction |

---

## Phase 8 — Review Interface

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P8-01 | [ ] | P0 | CC | Build receipt detail view (vendor, date, total, GST, line items, status badge) |
| P8-02 | [ ] | P0 | CC | Add inline edit for all receipt fields |
| P8-03 | [ ] | P1 | CC | Add receipt list view with search + filter by category + date range |

---

## Phase 9 — Excel Export

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P9-01 | [ ] | P0 | CC | Create Cloudflare Queue (travis-export-queue) — xlsx generation is too heavy for 50ms CPU limit |
| P9-02 | [ ] | P0 | CC | Queue consumer: generate xlsx (ExcelJS via WASM or Cloudflare Worker with streaming) |
| P9-03 | [ ] | P0 | CC | Store generated xlsx in R2, record export in export_history D1 table |
| P9-04 | [ ] | P0 | CC | Build export UI — date range picker, category filter, download button |
| P9-05 | [ ] | P1 | CC | GET /api/v1/exports — list export history with download links |

---

## Phase 10 — Dashboard

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P10-01 | [ ] | P0 | CC | Dashboard KPI cards: receipts this month, total spend, GST claimable, exports generated |
| P10-02 | [ ] | P0 | CC | Spend-by-category chart (Preact + recharts or native SVG) |
| P10-03 | [ ] | P1 | CC | Recent receipts widget (last 5, with status badges) |
| P10-04 | [ ] | P1 | CC | Connect all KPIs to live D1 queries via Hono /api/v1/dashboard/stats |

---

## Phase 11 — Testing

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P11-01 | [ ] | P0 | CC | Unit tests: all Hono route handlers (Vitest + @cloudflare/vitest-pool-workers) |
| P11-02 | [ ] | P0 | CC | Integration tests: upload → parse → categorise → export pipeline |
| P11-03 | [ ] | P1 | AG | E2E tests: Playwright — upload receipt, verify line items, export Excel |
| P11-04 | [ ] | P1 | CC | Coverage threshold ≥80% on src/server/ |

---

## Phase 12 — Integration-Ready

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P12-01 | [ ] | P1 | CC | Add API versioning (all routes under /api/v1/) |
| P12-02 | [ ] | P1 | CC | Auto-generate OpenAPI schema from Hono + Zod definitions |
| P12-03 | [ ] | P2 | CC | Webhook skeleton (POST /api/v1/webhooks) — for future accounting software integration |

---

## Phase 13 — Documentation

| ID | Status | Priority | Agent | Task |
|----|--------|----------|-------|------|
| P13-01 | [ ] | P1 | CC | User guide: how to upload receipts, review, export |
| P13-02 | [ ] | P1 | CC | API reference (auto-generated from OpenAPI) |
| P13-03 | [ ] | P2 | CC | Deployment guide: Cloudflare Workers deploy, D1 migrate, R2 bucket setup |
