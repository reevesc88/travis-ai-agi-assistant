# Travis AI — Risk Register
# Last updated: 2026-06-28
# 8 risks identified

---

## Risk Matrix

| ID | Risk | Severity | Probability | Impact | Mitigation | Owner | Status |
|----|------|----------|-------------|--------|------------|-------|--------|
| R-01 | Workers CPU 50ms limit blocks parsing/export | HIGH | CERTAIN | Critical | Cloudflare Queues for async jobs (P5-03, P9-01) | CC | Open |
| R-02 | D1 write limit (25/sec) under load | HIGH | MEDIUM | High | db.batch() + transactions; queue-based writes; rate limiting | CC | Open |
| R-03 | OCR accuracy on handwritten/low-res receipts | HIGH | HIGH | High | Manual review queue; OCR placeholder in P5-02; evaluate 3rd party OCR in Phase 11 | AG | Open |
| R-04 | R2 storage costs at scale | MEDIUM | LOW | Medium | Set lifecycle rules; compress files; cap upload size at 10MB | CC | Open |
| R-05 | Auth complexity — Cloudflare Access vs JWT | MEDIUM | MEDIUM | High | Decision in P3-01; document in memory/decisions.md | CC | Open |
| R-06 | Excel generation memory in Workers runtime | HIGH | MEDIUM | High | Queue-based async export (P9-01); streaming xlsx generation | CC | Open |
| R-07 | Cold start latency on Workers free tier | MEDIUM | MEDIUM | Medium | Keep bundle <1MB; lazy imports; consider paid plan for production | CC | Open |
| R-08 | Multi-tenancy data isolation | HIGH | LOW | Critical | Row-level D1 queries always filter by user_id; middleware enforces it | CC | Open |

---

## Risk Detail

### R-01 — Workers CPU 50ms Limit
**Description:** Cloudflare Workers limits each request to 50ms CPU time. PDF parsing,
Claude API calls, and Excel generation all exceed this limit.

**Mitigation:** All heavy tasks go through Cloudflare Queues:
- Receipt parsing → `travis-parse-queue`
- Excel export → `travis-export-queue`
- API endpoint returns 202 Accepted with job ID; client polls for completion

**Test:** Verify queue consumers process within 15min and return results to D1.

---

### R-02 — D1 Write Limit
**Description:** D1 SQLite has a 25 writes/second limit per database on free tier.
High-volume receipt uploads could hit this under load.

**Mitigation:** Use `db.batch()` and transactions to group writes. Offload bulk inserts to
Queue consumers where possible. If limit is persistently hit in production, evaluate
Turso (distributed SQLite) or upgrade the D1 plan. Note: D1 is accessed via a Workers
binding (no TCP connections), so connection pooling and Hyperdrive do not apply here.

---

### R-03 — OCR Accuracy
**Description:** Cloudflare Workers cannot run Tesseract or heavy OCR. Image receipts
(JPG/PNG) will have lower extraction accuracy than PDFs.

**Mitigation:** Phase 5 — image receipts get status `needs_ocr` and go to manual review
queue. Evaluate external OCR service (AWS Textract, Google Document AI) in Phase 11.

---

### R-04 — R2 Storage Costs
**Description:** R2 is cheap but not free at scale. A sole trader uploading 50 receipts/day
with an average 2MB each = 100MB/day = 3GB/month per user.

**Mitigation:** Compress uploads at intake (WebP for images, compressed PDF for PDFs).
Set 90-day lifecycle rule for raw uploads; keep parsed data in D1 indefinitely.

---

### R-05 — Auth Strategy
**Description:** Cloudflare Access (zero-config for internal tools) vs custom JWT
(more flexible, requires key management) is undecided.

**Mitigation:** Decide in P3-01. Preference is Cloudflare Access for MVP (faster to ship);
migrate to custom JWT if B2C distribution is required.

---

### R-06 — Excel Generation Memory
**Description:** xlsx libraries (ExcelJS, SheetJS) require significant memory (50–200MB)
for large exports. Workers runtime has a 128MB memory limit.

**Mitigation:** Queue-based export (P9-01). If memory is still an issue, stream the xlsx
line-by-line using a streaming xlsx writer.

---

### R-07 — Cold Start Latency
**Description:** Workers on free tier may cold start in 50–200ms on first request. This
is noticeable to users.

**Mitigation:** Keep Worker bundle <1MB (Preact helps — 3KB vs React 40KB). Upgrade to
Workers Paid plan ($5/month) for production to eliminate cold starts.

---

### R-08 — Multi-tenancy Data Isolation
**Description:** Travis is a multi-user SaaS. Every D1 query MUST filter by user_id to
prevent data leaks between accounts.

**Mitigation:** Auth middleware in Phase 3 attaches `ctx.user` to every request.
All D1 queries in route handlers use `WHERE user_id = ?` with `ctx.user.id`.
Codex to review every D1 query in Phase 2 PR for this pattern.
