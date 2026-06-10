---
name: Quotes risk-adjusted total
description: Why the quote risk-adjusted total is derived client-side, not stored/computed by the server.
---

The quote **base total** is server-authoritative (recomputed on create/update from
locked `cost_at_time` line costs; never trust client sums). The **risk-adjusted
total** is derived purely client-side from that base via a fixed contingency
multiplier keyed on the server-stored `risk_level` (low 1.0 / medium 1.10 / high
1.25), in `src/client/quote-utils.ts`.

**Why:** Risk adjustment is a presentational uplift, not money owed — keeping it
client-side avoids adding a derived column the server must keep in sync, while the
"no client sums" constraint is still honoured because the *base* it multiplies is
server-computed. The builder's confidence/clarity step maps to `risk_level`
(high confidence = low risk).

**How to apply:** If a downstream feature needs the risk-adjusted figure (e.g.
reporting), reuse `riskAdjustedTotal(quote.total, quote.risk_level)` rather than
recomputing or persisting it. If the multiplier policy ever needs to be auditable
per-quote, that's the trigger to move it server-side.
