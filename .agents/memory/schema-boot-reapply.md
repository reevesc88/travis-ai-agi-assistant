---
name: Schema reapply & idempotency
description: Why src/server/schema.sql must stay idempotent in this repo
---

The "Start application" workflow runs `wrangler d1 execute open-fieldservice-db --local --file=src/server/schema.sql` before starting the servers — i.e. the FULL schema + seed re-runs on every workflow boot against a persistent local D1.

**Rule:** every statement in schema.sql must be safe to run repeatedly.
- Tables: `CREATE TABLE IF NOT EXISTS`.
- Seed rows: `INSERT OR IGNORE` with explicit ids so re-runs don't duplicate.
- `_meta` counters (job/invoice/quote_counter): bump with a CONDITIONAL update
  (`UPDATE _meta SET value=N WHERE key=... AND CAST(value AS INTEGER) < N`) so a
  re-run never lowers a counter past records created at runtime.
- Demo dates: use `date('now', +/-N days)` so the seeded demo always looks current.

**Why:** a non-idempotent seed corrupts the demo DB on the second boot (duplicate
rows, counter collisions with runtime-created records). Verified by running the
schema file twice and confirming stable counts/counters.

**How to apply:** any time you add tables or seed data, keep this pattern; test by
executing the schema file twice in a row.
