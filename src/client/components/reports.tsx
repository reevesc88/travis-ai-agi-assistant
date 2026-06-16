import { useEffect, useState } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import type { ReportSummary, SupplierProduct } from "../types";
import { fmtMoney } from "../quote-utils";
import { DollarSign, Target, CheckCircle, FileText, TrendingUp, TrendingDown, Percent, Download, Activity } from "lucide-preact";

interface HealthSignal { label: string; tone: "good" | "warn" | "bad"; detail: string }

function buildHealth(r: ReportSummary, priceUp: number): HealthSignal[] {
  const signals: HealthSignal[] = [];
  signals.push(r.quotes_win_rate >= 50
    ? { label: "Win rate healthy", tone: "good", detail: `${r.quotes_win_rate}% of closed quotes approved.` }
    : { label: "Win rate low", tone: "warn", detail: `${r.quotes_win_rate}% of closed quotes approved — review pricing.` });
  signals.push(r.avg_margin_pct >= 35
    ? { label: "Margins on target", tone: "good", detail: `Average quote margin ${r.avg_margin_pct}% meets the 35% target.` }
    : { label: "Margins under target", tone: "warn", detail: `Average margin ${r.avg_margin_pct}% is below the 35% target.` });
  signals.push(r.revenue_overdue > 0
    ? { label: "Overdue invoices", tone: "bad", detail: `${fmtMoney(r.revenue_overdue)} overdue — chase outstanding payments.` }
    : { label: "No overdue invoices", tone: "good", detail: "All issued invoices are within terms." });
  signals.push(priceUp > 0
    ? { label: "Supplier prices rising", tone: "warn", detail: `${priceUp} tracked items increased — re-check open quotes.` }
    : { label: "Supplier prices stable", tone: "good", detail: "No upward supplier price movement detected." });
  return signals;
}

export function Reports() {
  const { setError } = useApp();
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);

  useEffect(() => {
    Promise.all([
      api<ReportSummary>("GET", "/api/reports"),
      api<{ products: SupplierProduct[] }>("GET", "/api/supplier-pricing"),
    ]).then(([r, p]) => { setReport(r); setProducts(p.products); })
      .catch((err) => setError((err as Error).message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!report) {
    return <div class="page"><div class="page-header"><h1>Reports</h1></div><div class="card"><div class="empty-state"><p>Loading report…</p></div></div></div>;
  }

  const priceUp = products.filter((p) => (p.change_pct || 0) > 0).length;
  const priceDown = products.filter((p) => (p.change_pct || 0) < 0).length;
  const health = buildHealth(report, priceUp);
  const maxMonth = Math.max(1, ...report.revenue_by_month.map((m) => m.total));

  return (
    <div class="page">
      <div class="page-header">
        <h1>Reports</h1>
        <div class="page-header-right">
          <button class="btn" title="Export is a placeholder in this demo" disabled><Download size={14} /> Export PDF</button>
          <button class="btn" title="Export is a placeholder in this demo" disabled><Download size={14} /> Export CSV</button>
        </div>
      </div>

      <p class="page-intro">Business health computed from your live seeded data. Export buttons are placeholders.</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}><DollarSign size={20} /></div>
          <div class="stat-info"><div class="stat-value">{fmtMoney(report.revenue_paid)}</div><div class="stat-label">Revenue (paid)</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}><FileText size={20} /></div>
          <div class="stat-info"><div class="stat-value">{fmtMoney(report.revenue_outstanding)}</div><div class="stat-label">Outstanding</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}><FileText size={20} /></div>
          <div class="stat-info"><div class="stat-value">{fmtMoney(report.revenue_overdue)}</div><div class="stat-label">Overdue</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}><Target size={20} /></div>
          <div class="stat-info"><div class="stat-value">{report.quotes_win_rate}%</div><div class="stat-label">Quote win rate</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}><Percent size={20} /></div>
          <div class="stat-info"><div class="stat-value">{report.avg_margin_pct}%</div><div class="stat-label">Avg margin</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}><CheckCircle size={20} /></div>
          <div class="stat-info"><div class="stat-value">{report.jobs_completed}</div><div class="stat-label">Jobs completed</div></div>
        </div>
      </div>

      <div class="report-cols">
        <div class="section">
          <h2 class="section-title">Revenue by month</h2>
          <div class="card chart-card">
            {report.revenue_by_month.length === 0 ? (
              <div class="empty-state"><p>No revenue data yet</p></div>
            ) : (
              <div class="bar-chart">
                {report.revenue_by_month.map((m) => (
                  <div key={m.month} class="bar-col">
                    <div class="bar-track">
                      <div class="bar-fill" style={{ height: `${Math.round((m.total / maxMonth) * 100)}%` }} title={fmtMoney(m.total)} />
                    </div>
                    <span class="bar-label">{m.month.slice(5)}</span>
                    <span class="bar-value">{fmtMoney(m.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">Quote pipeline & supplier movement</h2>
          <div class="card detail-meta-grid" style={{ margin: 0 }}>
            <div class="detail-meta-item"><span class="detail-meta-label">Quotes total</span>{report.quotes_total}</div>
            <div class="detail-meta-item"><span class="detail-meta-label">Approved</span>{report.quotes_approved}</div>
            <div class="detail-meta-item"><span class="detail-meta-label">Jobs upcoming</span>{report.jobs_upcoming}</div>
            <div class="detail-meta-item"><span class="detail-meta-label">Price rises</span><span class="change-pill up"><TrendingUp size={11} /> {priceUp}</span></div>
            <div class="detail-meta-item"><span class="detail-meta-label">Price drops</span><span class="change-pill down"><TrendingDown size={11} /> {priceDown}</span></div>
            <div class="detail-meta-item"><span class="detail-meta-label">Tracked items</span>{products.length}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <h2 class="section-title"><Activity size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Business health</h2>
        </div>
        <div class="health-grid">
          {health.map((h) => (
            <div key={h.label} class={`health-card ${h.tone}`}>
              <span class="health-dot" />
              <div class="health-body">
                <div class="health-label">{h.label}</div>
                <div class="health-detail">{h.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
