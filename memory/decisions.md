# Travis AI — Architectural Decisions
# Append-only. Never delete. Mark superseded entries with [SUPERSEDED YYYY-MM-DD].

---

## D-01 — Cloudflare Workers Stack
**Date:** 2026-06-28
**Decision:** Use Cloudflare Workers + Hono + D1 + R2 as the primary stack.
**Rationale:** Already present in the codebase (wrangler.toml, src/server/index.ts, pnpm scripts).
No migration cost. Edge deployment means low latency for Australian users.
**Alternatives considered:** Node.js + Express + PostgreSQL (higher cost, more infra to manage),
Node.js + Fastify + PlanetScale (requires DB migration from D1).
**Status:** LOCKED

---

## D-02 — Preact over React
**Date:** 2026-06-28
**Decision:** Keep Preact as the frontend framework (do not migrate to React).
**Rationale:** Preact is API-compatible with React but ~3KB vs ~40KB. On Cloudflare Workers
(edge), every KB matters for cold-start latency. The open-fieldservice base already uses Preact.
**Alternatives considered:** React (larger bundle), SolidJS (not API-compatible, migration cost).
**Status:** LOCKED

---

## D-03 — D1 SQLite (not PostgreSQL)
**Date:** 2026-06-28
**Decision:** Use Cloudflare D1 (SQLite) as the primary database. Do not use PostgreSQL.
**Rationale:** D1 is the native Cloudflare Workers database. Zero configuration for Workers
binding. No cold connection overhead. AGPL licence on open-fieldservice schema is SQLite-based.
**Constraints:** D1 has 25 writes/second limit (R-02). No stored procedures. LIKE-only full-text
search. For scale, Turso (distributed SQLite) is the natural migration path.
**Status:** LOCKED

---

## D-04 — R2 for File Storage
**Date:** 2026-06-28
**Decision:** Use Cloudflare R2 for all uploaded receipt files (PDF, images, EML).
**Rationale:** Native Cloudflare integration. Zero egress fees (unlike S3). Workers binding
makes reads/writes trivial. Cost: $0.015/GB/month storage + $0.36/million Class A ops.
**Alternatives considered:** AWS S3 (egress fees), Cloudflare KV (not suited for large binaries).
**Status:** LOCKED

---

## D-05 — Auth Strategy
**Date:** TBD — decide in P3-01
**Decision:** PENDING
**Options:**
  A. Cloudflare Access — zero-config, OAuth via CF dashboard, good for internal/beta
  B. Custom JWT — more flexible, required if we do email magic link sign-up
**Status:** OPEN — log here when decided in Phase 3

---

## D-06 — Async Jobs via Cloudflare Queues
**Date:** 2026-06-28
**Decision:** All heavy processing (PDF parsing, Claude API calls, xlsx export) must run
in Cloudflare Queue consumers, NOT in the request handler.
**Rationale:** Workers 50ms CPU limit (R-01). Request handler returns 202 Accepted with
a job ID; the Queue consumer does the work; client polls /api/v1/jobs/:id for status.
**Status:** LOCKED
