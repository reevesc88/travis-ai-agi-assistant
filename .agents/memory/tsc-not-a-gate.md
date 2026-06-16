---
name: TypeScript is not a build gate
description: tsc --noEmit is not clean in this repo and is not the release gate
---

`npx tsc --noEmit` reports pre-existing errors (all in `src/server/index.ts`) that
are NOT a regression signal on their own:
- `Cannot find name 'D1Database'` — Cloudflare Workers types aren't in tsconfig lib/types.
- Many `JSONRespondReturn ... Record<string,unknown> not assignable` errors — the
  whole server uses `query<Record<string,unknown>>()` then `c.json(row, 200)` against
  zod-openapi typed response schemas, which TS flags. This is a project-wide pattern.

**Why:** the server ships via `wrangler dev` (esbuild, no typecheck) and the client
via `vite build`; tsc has never been clean here, so it's not the gate.

**How to apply:** to judge whether YOUR change is safe, group tsc errors by file
(`tsc --noEmit 2>&1 | grep -oE '^src/[^(]+' | sort | uniq -c`) and confirm your new
files add zero errors and you didn't introduce a NEW class of error in index.ts.
The actual pass criteria: `pnpm build` succeeds + workflow boots + endpoints respond.
Follow the existing `Record<string,unknown>` route pattern for consistency rather
than "fixing" the typing in isolation.
