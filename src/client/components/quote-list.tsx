import { useState } from "preact/hooks";
import { useApp } from "../context";
import { Pagination } from "./pagination";
import { Trash2, SlidersHorizontal, ChevronDown, Plus } from "lucide-preact";
import type { QuoteStatus } from "../types";
import {
  QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS, RISK_MULTIPLIER,
  riskAdjustedTotal, fmtMoney,
} from "../quote-utils";
import { CreateQuote } from "./create-quote";

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

export function QuoteList() {
  const {
    quotes, quotesPag, setQuotesPage, quotesStatusFilter, setQuotesStatusFilter,
    navigate, deleteQuote, isAgent,
  } = useApp();
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const baseSum = quotes.reduce((s, q) => s + q.total, 0);
  const riskSum = quotes.reduce((s, q) => s + riskAdjustedTotal(q.total, q.risk_level), 0);

  return (
    <div class="page">
      <div class="page-header">
        <h1>Quotes</h1>
        {isAgent && (
          <div class="page-header-right">
            <button class="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New Quote
            </button>
          </div>
        )}
      </div>

      <div class="quote-summary-row">
        <div class="quote-summary-card">
          <span class="quote-summary-label">Pipeline (base)</span>
          <span class="quote-summary-value">{fmtMoney(baseSum)}</span>
        </div>
        <div class="quote-summary-card risk">
          <span class="quote-summary-label">Risk-adjusted</span>
          <span class="quote-summary-value">{fmtMoney(riskSum)}</span>
        </div>
      </div>

      <div class={`toolbar ${showFilters ? "toolbar-open" : ""}`}>
        <button
          class="toolbar-toggle"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={14} /> Filter
          <ChevronDown size={14} class="toolbar-toggle-chevron" />
        </button>
        <div class="filter-group">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              class={`filter-btn ${quotesStatusFilter === s.value ? "active" : ""}`}
              onClick={() => setQuotesStatusFilter(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div class="card">
        {quotes.length === 0 ? (
          <div class="empty-state">
            <p>No quotes yet</p>
            <p class="text-muted">Build a quote to estimate a job before it's scheduled</p>
          </div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>Quote</th>
                <th>Customer</th>
                <th>Title</th>
                <th>Status</th>
                <th>Confidence</th>
                <th class="text-right">Base</th>
                <th class="text-right">Risk-adj.</th>
                {isAgent && <th></th>}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const color = QUOTE_STATUS_COLORS[(q.status as QuoteStatus)] || "#6b7280";
                const adj = riskAdjustedTotal(q.total, q.risk_level);
                const uplift = RISK_MULTIPLIER[q.risk_level] > 1;
                return (
                  <tr key={q.id} class="table-row clickable" onClick={() => navigate(`/quotes/${q.id}`)}>
                    <td><span class="identifier">{q.identifier}</span></td>
                    <td>{q.customer_name || "—"}</td>
                    <td class="text-muted">{q.title || "—"}</td>
                    <td>
                      <span class="status-badge" style={{ background: `${color}14`, color, borderColor: `${color}30` }}>
                        <span class="status-dot" style={{ background: color }} />
                        {QUOTE_STATUS_LABELS[q.status as QuoteStatus] || q.status}
                      </span>
                    </td>
                    <td>
                      <span class={`risk-pill risk-${q.risk_level}`}>{q.risk_level}</span>
                    </td>
                    <td class="text-right">{fmtMoney(q.total)}</td>
                    <td class="text-right text-bold">
                      {fmtMoney(adj)}
                      {uplift && <span class="risk-uplift"> ▲</span>}
                    </td>
                    {isAgent && (
                      <td>
                        <button class="btn-icon danger" onClick={(e) => { e.stopPropagation(); deleteQuote(q.id); }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination pag={quotesPag} setPage={setQuotesPage} />

      {showCreate && <CreateQuote onClose={() => setShowCreate(false)} />}
    </div>
  );
}
