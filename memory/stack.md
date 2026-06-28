# Travis AI — Confirmed Stack
# Last updated: 2026-06-28

## Runtime
- Cloudflare Workers (wrangler 4.0)
- Node.js compatibility mode enabled

## Backend
- Hono 4.6.0
- @hono/zod-openapi 0.18.0 (OpenAPI schema auto-generation)
- Zod 3.24.0 (validation)

## Frontend
- Preact 10.25.0
- TypeScript 5.7.0 (strict mode)
- Vite 6.0.0

## Database
- Cloudflare D1 (SQLite) — binding: DB

## File Storage
- Cloudflare R2 — binding: RECEIPTS_BUCKET

## Async Jobs
- Cloudflare Queues
  - travis-parse-queue (receipt parsing)
  - travis-export-queue (xlsx export)

## AI
- Anthropic Claude API (claude-sonnet-4-6) — for receipt parsing, line item extraction, categorisation
- Binding: ANTHROPIC_API_KEY (Workers secret)

## Package Manager
- pnpm

## Build
- Vite 6 (frontend)
- esbuild (Workers bundle via wrangler)

## Dev Ports
- API: http://localhost:8787 (wrangler dev)
- UI: http://localhost:5173 (vite dev)
- Vite proxies /api/* → localhost:8787

## Licence
- open-fieldservice base: AGPL-3.0 (attribution required)
- Travis additions: proprietary (AI1AU Solutions)
