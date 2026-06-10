import type { RiskLevel, QuoteStatus } from "./types";

// Confidence/clarity in the job scope maps to a contingency multiplier applied
// on top of the server-computed base total. Lower confidence (higher risk)
// carries a larger contingency so the quoted figure absorbs the unknowns.
export const RISK_MULTIPLIER: Record<RiskLevel, number> = {
  low: 1.0,
  medium: 1.1,
  high: 1.25,
};

export const RISK_OPTIONS: { value: RiskLevel; label: string; blurb: string; pct: string }[] = [
  { value: "low", label: "High confidence", blurb: "Scope is clear, few unknowns.", pct: "+0%" },
  { value: "medium", label: "Some uncertainty", blurb: "A few assumptions to confirm on site.", pct: "+10%" },
  { value: "high", label: "Low confidence", blurb: "Significant unknowns or access risk.", pct: "+25%" },
];

export function riskMultiplier(risk: RiskLevel): number {
  return RISK_MULTIPLIER[risk] ?? 1;
}

// Risk-adjusted total = server base total uplifted by the contingency factor.
export function riskAdjustedTotal(total: number, risk: RiskLevel): number {
  return total * riskMultiplier(risk);
}

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "#94a3b8",
  sent: "#60a5fa",
  viewed: "#22d3ee",
  approved: "#34d399",
  rejected: "#f87171",
  expired: "#a78bfa",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export function fmtMoney(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
