---
name: Wrangler dev TLS + secrets on Replit
description: Two required fixes for wrangler dev in the Replit/NixOS environment — TLS cert trust and secret injection via .dev.vars.
---

# Wrangler dev on Replit: TLS and Secrets

## Problem 1 — TLS cert not trusted
workerd (Cloudflare's local runtime) uses its own TLS stack and fails with:
`kj/compat/tls.c++:269: failed: TLS peer's certificate is not trusted; reason = unable to get local issuer certificate`

This blocks ALL outbound HTTPS calls from workers in dev mode.

**Fix:** set `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt` in the environment when launching `wrangler dev`.

## Problem 2 — Secrets not available in workerd
Replit secrets (env vars) are NOT automatically forwarded into the workerd runtime. Only Node.js process env is populated. workerd reads secrets from a `.dev.vars` file (key=value format, like .env).

**Fix:** write `.dev.vars` from the env at startup, before wrangler starts.

## Correct Workflow Command Pattern

```bash
echo "OPENROUTER_API_KEY=$OPENROUTER_API_KEY" > .dev.vars && \
  pnpm wrangler d1 execute open-fieldservice-db --local --file=src/server/schema.sql && \
  SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt concurrently -n ui,api -c cyan,green \
    "vite --host 0.0.0.0 --port 5000" \
    "SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt wrangler dev --port 8787"
```

Add each secret as a separate `echo` or use `printf` for multiple:
```bash
printf "OPENROUTER_API_KEY=$OPENROUTER_API_KEY\nOTHER_KEY=$OTHER_KEY\n" > .dev.vars
```

## .gitignore
`.dev.vars` must be in `.gitignore` — it contains secret values written at boot.

**Why:** workerd isolates its environment from the Node.js host process. The `.dev.vars` file is the only supported injection point for secrets in wrangler dev. The TLS fix is needed because NixOS puts its CA bundle at a path workerd doesn't scan by default.
