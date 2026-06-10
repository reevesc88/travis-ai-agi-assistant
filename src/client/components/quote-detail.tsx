import { useState } from "preact/hooks";
import { useApp } from "../context";
import { ArrowLeft, Trash2, Briefcase, ArrowRight } from "lucide-preact";
import type { QuoteStatus } from "../types";
import {
  QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS, RISK_OPTIONS,
  riskAdjustedTotal, riskMultiplier, fmtMoney,
} from "../quote-utils";

const ALL_STATUSES: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "rejected", "expired"];

export function QuoteDetail() {
  const { selectedQuote: quote, navigate, updateQuote, deleteQuote, convertQuoteToJob } = useApp();
  const [converting, setConverting] = useState(false);

  if (!quote) return null;

  const color = QUOTE_STATUS_COLORS[(quote.status as QuoteStatus)] || "#6b7280";
  const adjusted = riskAdjustedTotal(quote.total, quote.risk_level);
  const mult = riskMultiplier(quote.risk_level);
  const riskOpt = RISK_OPTIONS.find((o) => o.value === quote.risk_level);

  const handleConvert = async () => {
    setConverting(true);
    try {
      const jobId = await convertQuoteToJob(quote.id);
      navigate(`/jobs/${jobId}`);
    } finally {
      setConverting(false);
    }
  };

  const approveAndConvert = async () => {
    setConverting(true);
    try {
      if (quote.status !== "approved") {
        await updateQuote(quote.id, { status: "approved" });
      }
      const jobId = await convertQuoteToJob(quote.id);
      navigate(`/jobs/${jobId}`);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div class="page">
      <div class="page-header">
        <button class="btn btn-back" onClick={() => navigate("/quotes")}>
          <ArrowLeft size={16} /> Back
        </button>
        <div class="page-header-right">
          <button class="btn btn-danger" onClick={() => deleteQuote(quote.id)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      <div class="detail-layout">
        <div class="detail-main">
          <div class="quote-preview">
            <div class="quote-preview-head">
              <div>
                <span class="identifier-lg">{quote.identifier}</span>
                <h2 class="quote-preview-title">{quote.title || "Untitled Quote"}</h2>
              </div>
              <span class="status-badge" style={{ background: `${color}14`, color, borderColor: `${color}30` }}>
                <span class="status-dot" style={{ background: color }} />
                {QUOTE_STATUS_LABELS[quote.status as QuoteStatus] || quote.status}
              </span>
            </div>

            <div class="detail-meta-grid">
              <div class="detail-meta-item">
                <span class="detail-meta-label">Customer</span>
                <span>{quote.customer_name || "—"}</span>
              </div>
              {quote.valid_until && (
                <div class="detail-meta-item">
                  <span class="detail-meta-label">Valid Until</span>
                  <span>{quote.valid_until}</span>
                </div>
              )}
              {quote.job_id && (
                <div class="detail-meta-item">
                  <span class="detail-meta-label">Linked Job</span>
                  <button class="link-btn" onClick={() => navigate(`/jobs/${quote.job_id}`)}>View job →</button>
                </div>
              )}
            </div>

            <div class="detail-section">
              <h3>Line Items</h3>
              <div class="card">
                <table class="table">
                  <thead>
                    <tr><th>Description</th><th>Type</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {(quote.lines || []).map((line) => (
                      <tr key={line.id} class="table-row">
                        <td>{line.description}</td>
                        <td class="text-muted">{line.kind}</td>
                        <td class="text-right">{line.quantity}</td>
                        <td class="text-right">{fmtMoney(line.unit_price)}</td>
                        <td class="text-right">{fmtMoney(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="quote-totals quote-totals-detail">
              <div class="quote-total-row"><span class="text-muted">Subtotal</span><span>{fmtMoney(quote.subtotal)}</span></div>
              <div class="quote-total-row"><span class="text-muted">Cost</span><span>{fmtMoney(quote.cost_total)}</span></div>
              <div class="quote-total-row"><span class="text-muted">Margin</span><span>{fmtMoney(quote.margin_amount)} ({quote.margin_pct.toFixed(1)}%)</span></div>
              {quote.tax_rate > 0 && <div class="quote-total-row"><span class="text-muted">Tax ({quote.tax_rate}%)</span><span>{fmtMoney(quote.tax_amount)}</span></div>}
              <div class="quote-total-row quote-total-base"><span class="text-bold">Base total</span><span class="text-bold">{fmtMoney(quote.total)}</span></div>
              <div class="quote-total-row quote-total-risk">
                <span>Risk-adjusted (×{mult.toFixed(2)})</span>
                <span class="text-bold">{fmtMoney(adjusted)}</span>
              </div>
            </div>

            {quote.notes && (
              <div class="detail-section">
                <h3>Assumptions & Exclusions</h3>
                <p class="detail-notes" style={{ whiteSpace: "pre-wrap" }}>{quote.notes}</p>
              </div>
            )}

            <p class="text-muted wizard-hint">PDF export coming soon.</p>
          </div>
        </div>

        <div class="detail-sidebar">
          <div class="detail-sidebar-section">
            <h4>Confidence</h4>
            <span class={`risk-pill risk-${quote.risk_level}`}>{riskOpt?.label || quote.risk_level}</span>
            <p class="text-muted" style={{ marginTop: 6, fontSize: 12 }}>{riskOpt?.blurb}</p>
          </div>

          <div class="detail-sidebar-section">
            <h4>Status</h4>
            <div class="status-buttons">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  class={`status-btn ${quote.status === s ? "active" : ""}`}
                  onClick={() => updateQuote(quote.id, { status: s })}
                >
                  {QUOTE_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div class="detail-sidebar-section">
            <h4>Actions</h4>
            {quote.job_id ? (
              <button class="btn full-width" onClick={() => navigate(`/jobs/${quote.job_id}`)}>
                <Briefcase size={14} /> Go to Job
              </button>
            ) : quote.status === "approved" ? (
              <button class="btn btn-primary full-width" disabled={converting} onClick={handleConvert}>
                <Briefcase size={14} /> {converting ? "Creating..." : "Create Job"}
              </button>
            ) : (
              <button class="btn btn-primary full-width" disabled={converting} onClick={approveAndConvert}>
                <ArrowRight size={14} /> {converting ? "Working..." : "Approve & Create Job"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
