- [Schema reapply & idempotency](schema-boot-reapply.md) — schema.sql runs on EVERY boot; all seed must be idempotent (INSERT OR IGNORE + conditional counter bumps).
- [TypeScript is not a build gate](tsc-not-a-gate.md) — tsc --noEmit has pre-existing errors; real gates are vite build (client) + wrangler dev (server).
- [Quotes risk-adjusted total](quotes-risk-adjusted.md) — base total is server-authoritative; risk-adjusted uplift is client-derived via fixed multiplier on risk_level.
<<<<<<< HEAD
=======
- [Rebase INVALID_REFERENCE loop](../skills/rebase-invalid-reference/SKILL.md) — startGitRebase() returns INVALID_REFERENCE from river service; stop after 3 retries, it's platform-side, not code.
- [Wrangler dev TLS + secrets on Replit](wrangler-dev-replit.md) — workerd needs SSL_CERT_FILE and secrets via .dev.vars; see file for workflow command pattern.
>>>>>>> origin/main
