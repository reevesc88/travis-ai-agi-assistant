import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { TrendingUp, DollarSign, Briefcase, FileText, Users, BarChart2, Download, Printer, GitPullRequest, Bookmark, X } from "lucide-preact";
import { api } from "../api";
import type { ReportSummary, TrendPoint, TrendDualResponse } from "../types";

type DateRange = "this_week" | "this_month" | "all_time" | "custom";
type Bucket = "day" | "week" | "month";

interface SavedPreset {
  name: string;
  from: string;
  to: string;
}

const PRESETS_KEY = "travis_report_presets";

function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresets(presets: SavedPreset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom" },
];

function getBucket(range: DateRange, customFrom?: string, customTo?: string): Bucket {
  if (range === "this_week") return "day";
  if (range === "this_month") return "week";
  if (range === "custom" && customFrom && customTo) {
    const ms = new Date(customTo).getTime() - new Date(customFrom).getTime();
    const days = ms / 86_400_000;
    if (days <= 14) return "day";
    if (days <= 90) return "week";
    return "month";
  }
  return "month";
}

function getDateParams(range: DateRange, customFrom?: string, customTo?: string): Record<string, string> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  if (range === "this_week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const mon = new Date(now);
    mon.setDate(now.getDate() - diff);
    return { date_from: mon.toISOString().split("T")[0], date_to: today };
  }
  if (range === "this_month") {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return { date_from: `${y}-${m}-01`, date_to: today };
  }
  if (range === "custom" && customFrom && customTo) {
    return { date_from: customFrom, date_to: customTo };
  }
  return {};
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function fmtPeriodLabel(period: string, bucket: Bucket): string {
  if (bucket === "month") {
    const [y, m] = period.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("default", { month: "short" });
  }
  if (bucket === "week") {
    const wk = period.split("W")[1];
    return `W${wk}`;
  }
  // day: "2026-06-09"
  const parts = period.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleString("default", { weekday: "short" }).slice(0, 3);
}

function fmtMoneyRaw(n: number): string {
  return n.toFixed(2);
}

function csvRow(...cells: (string | number)[]): string {
  return cells
    .map(c => {
      const s = String(c);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(",");
}

function exportCsv(
  data: ReportSummary,
  range: DateRange,
  currentTotal: number,
  priorTotal: number,
  changePct: number | null,
  customFrom?: string,
  customTo?: string,
): void {
  const params = getDateParams(range, customFrom, customTo);
  const dateLabel =
    range === "all_time"
      ? "all-time"
      : range === "custom" && customFrom && customTo
        ? `${customFrom}_${customTo}`
        : (params.date_from ?? new Date().toISOString().split("T")[0]).slice(0, 7);

  const periodLabel =
    range === "all_time"
      ? "All Time"
      : range === "custom" && customFrom && customTo
        ? `${customFrom} to ${customTo}`
        : `${params.date_from ?? ""} to ${params.date_to ?? new Date().toISOString().split("T")[0]}`;

  const lines: string[] = [];

  lines.push(csvRow("Report Period", periodLabel));
  lines.push("");

  lines.push("Section,KPIs");
  lines.push(csvRow("Metric", "Value"));
  lines.push(csvRow("Revenue Total", fmtMoneyRaw(data.revenue_total)));
  lines.push(csvRow("Revenue Paid", fmtMoneyRaw(data.revenue_paid)));
  lines.push(csvRow("Revenue Outstanding", fmtMoneyRaw(data.revenue_outstanding)));
  lines.push(csvRow("Revenue Overdue", fmtMoneyRaw(data.revenue_overdue)));
  lines.push(csvRow("Jobs Total", data.jobs_total));
  lines.push(csvRow("Jobs Completed", data.jobs_completed));
  lines.push(csvRow("Jobs Scheduled", data.jobs_scheduled));
  lines.push(csvRow("Quotes Total", data.quotes_total));
  lines.push(csvRow("Quotes Accepted", data.quotes_accepted));
  lines.push(csvRow("Quote Conversion %", data.quotes_conversion_pct));
  lines.push(csvRow("Open Pipeline", fmtMoneyRaw(data.quotes_pipeline_total)));
  lines.push(csvRow("Pipeline - Draft", fmtMoneyRaw(data.quotes_pipeline_draft)));
  lines.push(csvRow("Pipeline - Sent", fmtMoneyRaw(data.quotes_pipeline_sent)));
  lines.push("");

  lines.push("Section,Period Comparison");
  lines.push(csvRow("Metric", "Value"));
  lines.push(csvRow("Current Period Revenue", fmtMoneyRaw(currentTotal)));
  lines.push(csvRow("Prior Period Revenue", fmtMoneyRaw(priorTotal)));
  lines.push(csvRow("Change %", changePct !== null ? changePct.toFixed(1) : "N/A"));
  lines.push("");

  lines.push("Section,Top Technicians");
  lines.push(csvRow("Rank", "Technician", "Jobs Completed", "Revenue"));
  data.top_technicians.forEach((tech, i) => {
    lines.push(csvRow(i + 1, tech.name, tech.jobs_completed, fmtMoneyRaw(Number(tech.revenue))));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report_${dateLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getPrintPeriodLabel(range: DateRange, customFrom?: string, customTo?: string): string {
  const now = new Date();
  if (range === "all_time") return "All Time";
  if (range === "this_month") {
    return `This Month \u2014 ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  }
  if (range === "this_week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const mon = new Date(now);
    mon.setDate(now.getDate() - diff);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fromDay = mon.getDate();
    const toDay = sun.getDate();
    const fromMon = SHORT_MONTHS[mon.getMonth()];
    const toMon = SHORT_MONTHS[sun.getMonth()];
    const year = sun.getFullYear();
    const range_str = mon.getMonth() === sun.getMonth()
      ? `${fromDay}\u2013${toDay} ${fromMon} ${year}`
      : `${fromDay} ${fromMon}\u2013${toDay} ${toMon} ${year}`;
    return `This Week \u2014 ${range_str}`;
  }
  if (range === "custom" && customFrom && customTo) {
    const [fy, fm, fd] = customFrom.split("-").map(Number);
    const [ty, tm, td] = customTo.split("-").map(Number);
    const fromStr = `${fd} ${SHORT_MONTHS[fm - 1]} ${fy}`;
    const toStr = `${td} ${SHORT_MONTHS[tm - 1]} ${ty}`;
    return `Custom \u2014 ${fromStr}\u2013${toStr}`;
  }
  return "";
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div class="report-progress-track">
      <div
        class="report-progress-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color, progress, delta, splitProgress,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof DollarSign;
  color: string;
  progress?: { value: number; max: number };
  delta?: { pct: number; label: string } | null;
  splitProgress?: { draft: number; sent: number };
}) {
  return (
    <div class="report-kpi-card">
      <div class="report-kpi-top">
        <div class="report-kpi-icon" style={{ background: `${color}18`, color }}>
          <Icon size={18} />
        </div>
        <span class="report-kpi-label">{label}</span>
      </div>
      <div class="report-kpi-value" style={{ color }}>{value}</div>
      {delta != null && (
        <div class="report-kpi-delta">
          <span class={`trend-change-badge ${delta.pct > 0 ? "up" : delta.pct < 0 ? "down" : "flat"}`}>
            {delta.pct > 0 ? "+" : ""}{delta.pct.toFixed(1)}%&nbsp;{delta.label}
          </span>
        </div>
      )}
      {sub && <div class="report-kpi-sub">{sub}</div>}
      {progress && (
        <ProgressBar value={progress.value} max={progress.max} color={color} />
      )}
      {splitProgress && (() => {
        const total = splitProgress.draft + splitProgress.sent;
        const draftPct = total > 0 ? Math.round((splitProgress.draft / total) * 100) : 50;
        const sentPct = 100 - draftPct;
        return (
          <div class="pipeline-split">
            <div class="pipeline-split-bar">
              <div class="pipeline-split-draft" style={{ width: `${draftPct}%` }} />
              <div class="pipeline-split-sent" style={{ width: `${sentPct}%` }} />
            </div>
            <div class="pipeline-split-legend">
              <span class="pipeline-split-legend-draft">
                <span class="pipeline-split-dot draft-dot" />
                Draft&nbsp;{fmtMoney(splitProgress.draft)}
              </span>
              <span class="pipeline-split-legend-sent">
                <span class="pipeline-split-dot sent-dot" />
                Sent&nbsp;{fmtMoney(splitProgress.sent)}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function TrendChart({
  invoicePoints, jobPoints, bucket, showInvoices, showJobs,
}: {
  invoicePoints: TrendPoint[];
  jobPoints: TrendPoint[];
  bucket: Bucket;
  showInvoices: boolean;
  showJobs: boolean;
}) {
  const invMap = new Map(invoicePoints.map(p => [p.period, p.revenue_paid]));
  const jobMap = new Map(jobPoints.map(p => [p.period, p.revenue_paid]));
  const allPeriods = Array.from(new Set([...invoicePoints.map(p => p.period), ...jobPoints.map(p => p.period)])).sort();

  const activeInvoice = showInvoices ? invoicePoints : [];
  const activeJobs = showJobs ? jobPoints : [];

  if (activeInvoice.length === 0 && activeJobs.length === 0) {
    return <div class="trend-empty">No data to display — enable at least one series above</div>;
  }
  if (allPeriods.length === 0) {
    return <div class="trend-empty">No data in this period</div>;
  }

  const maxVal = Math.max(
    ...(showInvoices ? invoicePoints.map(p => p.revenue_paid) : [0]),
    ...(showJobs ? jobPoints.map(p => p.revenue_paid) : [0]),
    1,
  );

  return (
    <div class="trend-chart">
      {allPeriods.map(period => {
        const inv = invMap.get(period) ?? 0;
        const job = jobMap.get(period) ?? 0;
        const invH = showInvoices ? Math.max(3, Math.round((inv / maxVal) * 100)) : 0;
        const jobH = showJobs ? Math.max(3, Math.round((job / maxVal) * 100)) : 0;
        const label = fmtPeriodLabel(period, bucket);
        const titleParts: string[] = [];
        if (showInvoices) titleParts.push(`Invoiced: ${fmtMoney(inv)}`);
        if (showJobs) titleParts.push(`Jobs: ${fmtMoney(job)}`);
        return (
          <div key={period} class="trend-bar-wrap" title={`${label} — ${titleParts.join(" | ")}`}>
            <div class="trend-bar-value">
              {showInvoices && inv > 0 ? fmtMoney(inv) : (showJobs && job > 0 ? fmtMoney(job) : "")}
            </div>
            <div class="trend-bar-group">
              {showInvoices && <div class="trend-bar trend-bar-invoice" style={{ height: `${invH}%` }} />}
              {showJobs && <div class="trend-bar trend-bar-jobs" style={{ height: `${jobH}%` }} />}
            </div>
            <div class="trend-bar-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function ReportsView() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [range, setRange] = useState<DateRange>("this_month");
  const [customFrom, setCustomFrom] = useState<string>(firstOfMonth);
  const [customTo, setCustomTo] = useState<string>(today);
  const [showInvoices, setShowInvoices] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [data, setData] = useState<ReportSummary | null>(null);
  const [trendInvoices, setTrendInvoices] = useState<TrendPoint[]>([]);
  const [trendJobs, setTrendJobs] = useState<TrendPoint[]>([]);
  const [changePct, setChangePct] = useState<number | null>(null);
  const [currentTotal, setCurrentTotal] = useState<number>(0);
  const [priorTotal, setPriorTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [presets, setPresets] = useState<SavedPreset[]>(() => loadPresets());
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveFormName, setSaveFormName] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);

  const applyPreset = useCallback((index: number) => {
    const preset = presets[index];
    if (!preset) return;
    setRange("custom");
    setCustomFrom(preset.from);
    setCustomTo(preset.to);
    setActivePresetIndex(index);
    setShowSaveForm(false);
  }, [presets]);

  const deletePreset = useCallback((index: number, e: MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((_, i) => i !== index);
    savePresets(updated);
    setPresets(updated);
    if (activePresetIndex === index) {
      setActivePresetIndex(null);
    } else if (activePresetIndex !== null && activePresetIndex > index) {
      setActivePresetIndex(activePresetIndex - 1);
    }
  }, [presets, activePresetIndex]);

  const commitSavePreset = useCallback(() => {
    const name = saveFormName.trim();
    if (!name || !customFrom || !customTo) return;
    const newPreset: SavedPreset = { name, from: customFrom, to: customTo };
    const updated = [...presets, newPreset];
    savePresets(updated);
    setPresets(updated);
    setActivePresetIndex(updated.length - 1);
    setShowSaveForm(false);
    setSaveFormName("");
  }, [saveFormName, customFrom, customTo, presets]);

  const openSaveForm = useCallback(() => {
    setShowSaveForm(true);
    setSaveFormName("");
    setTimeout(() => saveInputRef.current?.focus(), 0);
  }, []);

  const fetchReport = useCallback(async (r: DateRange, cf: string, ct: string) => {
    if (r === "custom" && (!cf || !ct)) return;
    setLoading(true);
    setError(null);
    try {
      const dateParams = getDateParams(r, cf, ct);
      const params = new URLSearchParams({ ...dateParams, ...(r !== "custom" ? { range: r } : {}) });
      const trendParams = new URLSearchParams({ ...dateParams, bucket: getBucket(r, cf, ct), ...(r !== "custom" ? { range: r } : {}) });
      const [result, trendResult] = await Promise.all([
        api<ReportSummary>("GET", `/api/reports/summary?${params}`),
        api<TrendDualResponse>("GET", `/api/reports/trend?${trendParams}`),
      ]);
      setData(result);
      setTrendInvoices(trendResult.trend_invoices ?? []);
      setTrendJobs(trendResult.trend_jobs ?? []);
      setChangePct(trendResult.change_pct ?? null);
      setCurrentTotal(trendResult.current_total ?? 0);
      setPriorTotal(trendResult.prior_total ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(range, customFrom, customTo);
  }, [range, customFrom, customTo, fetchReport]);

  const jobsPct = data && data.jobs_total > 0
    ? Math.round((data.jobs_completed / data.jobs_total) * 100)
    : 0;

  const bucket = getBucket(range, customFrom, customTo);
  const priorLabel = range === "this_week" ? "vs prior week" : range === "this_month" ? "vs prior month" : range === "all_time" ? "vs prior year" : null;
  const mkDelta = (pct: number | null | undefined) =>
    pct != null && priorLabel ? { pct, label: priorLabel } : null;

  return (
    <div class="page">
      <div class="page-header">
        <h1>Reports<span class="report-print-period">{getPrintPeriodLabel(range, customFrom, customTo)}</span></h1>
        <div class="page-header-right">
          <button
            class="btn btn-secondary report-no-print"
            disabled={!data}
            onClick={() => data && exportCsv(data, range, currentTotal, priorTotal, changePct, customFrom, customTo)}
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            class="btn btn-secondary report-no-print"
            disabled={!data}
            onClick={() => window.print()}
          >
            <Printer size={14} />
            Print PDF
          </button>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-group">
          {DATE_RANGES.map(dr => (
            <button
              key={dr.value}
              class={`filter-btn ${range === dr.value && activePresetIndex === null ? "active" : ""}`}
              onClick={() => { setRange(dr.value); setActivePresetIndex(null); setShowSaveForm(false); }}
            >
              {dr.label}
            </button>
          ))}
          {presets.map((preset, i) => (
            <span key={i} class="preset-filter-item">
              <button
                class={`filter-btn preset-filter-btn ${activePresetIndex === i ? "active" : ""}`}
                onClick={() => applyPreset(i)}
                title={`${preset.from} – ${preset.to}`}
              >
                {preset.name}
              </button>
              <button
                class="preset-filter-delete"
                onClick={(e) => deletePreset(i, e as unknown as MouseEvent)}
                title="Remove preset"
                aria-label={`Remove preset ${preset.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        {range === "custom" && (
          <div class="custom-date-range">
            <label class="custom-date-label">From</label>
            <input
              type="date"
              class="input input-sm"
              value={customFrom}
              max={customTo || today}
              onInput={(e) => { setCustomFrom((e.target as HTMLInputElement).value); setActivePresetIndex(null); }}
            />
            <label class="custom-date-label">To</label>
            <input
              type="date"
              class="input input-sm"
              value={customTo}
              min={customFrom}
              max={today}
              onInput={(e) => { setCustomTo((e.target as HTMLInputElement).value); setActivePresetIndex(null); }}
            />
            {!showSaveForm && (
              <button class="btn btn-ghost btn-xs preset-save-trigger" onClick={openSaveForm}>
                <Bookmark size={12} />
                Save as preset
              </button>
            )}
            {showSaveForm && (
              <span class="preset-save-form">
                <input
                  ref={saveInputRef}
                  type="text"
                  class="input input-sm"
                  placeholder="e.g. Q1 2026"
                  value={saveFormName}
                  maxLength={40}
                  onInput={(e) => setSaveFormName((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitSavePreset();
                    if (e.key === "Escape") { setShowSaveForm(false); setSaveFormName(""); }
                  }}
                  style={{ width: 130 }}
                />
                <button
                  class="btn btn-primary btn-xs"
                  onClick={commitSavePreset}
                  disabled={!saveFormName.trim()}
                >
                  Save
                </button>
                <button
                  class="btn btn-ghost btn-xs"
                  onClick={() => { setShowSaveForm(false); setSaveFormName(""); }}
                >
                  Cancel
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {error && <div class="error-inline">{error}</div>}

      {loading ? (
        <div class="empty-state" style={{ minHeight: 200 }}><p>Loading…</p></div>
      ) : data ? (
        <div class="report-body">

          {/* ── Revenue ── */}
          <div class="report-section">
            <div class="report-section-title">
              <DollarSign size={14} />
              Revenue
            </div>
            <div class="report-kpi-grid">
              <KpiCard
                label="Paid"
                value={fmtMoney(data.revenue_paid)}
                sub={`of ${fmtMoney(data.revenue_total)} total`}
                icon={DollarSign}
                color="#34d399"
                progress={{ value: data.revenue_paid, max: data.revenue_total }}
                delta={mkDelta(data.kpi_paid_change_pct)}
              />
              <KpiCard
                label="Outstanding"
                value={fmtMoney(data.revenue_outstanding)}
                sub="awaiting payment"
                icon={TrendingUp}
                color="#60a5fa"
                delta={mkDelta(data.kpi_outstanding_change_pct)}
              />
              <KpiCard
                label="Overdue"
                value={fmtMoney(data.revenue_overdue)}
                sub="past due date"
                icon={DollarSign}
                color="#f87171"
                delta={mkDelta(data.kpi_overdue_change_pct)}
              />
            </div>
          </div>

          {/* ── Revenue Trend ── */}
          <div class="report-section">
            <div class="report-section-title">
              <BarChart2 size={14} />
              Revenue Trend
              <span class="report-section-subtitle">
                {bucket === "day" ? "daily" : bucket === "week" ? "by week" : "by month"}
              </span>
              {changePct !== null && range !== "custom" && showInvoices && (
                <span class={`trend-change-badge ${changePct > 0 ? "up" : changePct < 0 ? "down" : "flat"}`}>
                  {changePct > 0 ? "+" : ""}{changePct.toFixed(1)}%&nbsp;vs {range === "this_week" ? "prior week" : range === "this_month" ? "prior month" : "prior year"}
                </span>
              )}
              <div class="trend-legend" style={{ marginLeft: "auto" }}>
                <label class={`trend-legend-item${showInvoices ? " active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={showInvoices}
                    onChange={() => setShowInvoices(v => !v)}
                  />
                  <span class="trend-legend-dot trend-legend-invoice" />
                  Invoiced
                </label>
                <label class={`trend-legend-item${showJobs ? " active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={showJobs}
                    onChange={() => setShowJobs(v => !v)}
                  />
                  <span class="trend-legend-dot trend-legend-jobs" />
                  Job Revenue
                </label>
              </div>
            </div>
            <div class="card trend-card">
              <TrendChart
                invoicePoints={trendInvoices}
                jobPoints={trendJobs}
                bucket={bucket}
                showInvoices={showInvoices}
                showJobs={showJobs}
              />
            </div>
          </div>

          {/* ── Performance ── */}
          <div class="report-section">
            <div class="report-section-title">
              <TrendingUp size={14} />
              Performance
            </div>
            <div class="report-kpi-grid">
              <KpiCard
                label="Jobs Completed"
                value={`${data.jobs_completed}`}
                sub={`${jobsPct}% of ${data.jobs_total} total`}
                icon={Briefcase}
                color="#a78bfa"
                progress={{ value: data.jobs_completed, max: data.jobs_total }}
              />
              <KpiCard
                label="Jobs Scheduled"
                value={`${data.jobs_scheduled}`}
                sub="upcoming"
                icon={Briefcase}
                color="#94a3b8"
              />
              <KpiCard
                label="Quote Conversion"
                value={`${data.quotes_conversion_pct}%`}
                sub={`${data.quotes_accepted} of ${data.quotes_total} quotes`}
                icon={FileText}
                color="#f59e0b"
                progress={{ value: data.quotes_accepted, max: data.quotes_total }}
              />
              <KpiCard
                label="Open Pipeline"
                value={fmtMoney(data.quotes_pipeline_total)}
                icon={GitPullRequest}
                color="#c084fc"
                splitProgress={{ draft: data.quotes_pipeline_draft, sent: data.quotes_pipeline_sent }}
              />
            </div>
          </div>

          {/* ── Top Technicians ── */}
          {data.top_technicians.length > 0 && (
            <div class="report-section">
              <div class="report-section-title">
                <Users size={14} />
                Top Technicians
              </div>
              <div class="card">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Technician</th>
                      <th class="text-right">Jobs Completed</th>
                      <th class="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_technicians.map((tech, i) => (
                      <tr key={tech.technician_id} class="table-row">
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span class="report-rank">{i + 1}</span>
                            {tech.name}
                          </div>
                        </td>
                        <td class="text-right">
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            {tech.jobs_completed}
                          </span>
                        </td>
                        <td class="text-right">
                          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                            {fmtMoney(Number(tech.revenue))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.top_technicians.length === 0 && (
            <div class="report-section">
              <div class="report-section-title"><Users size={14} />Top Technicians</div>
              <div class="card">
                <div class="empty-state" style={{ minHeight: 100 }}>
                  <p>No completed jobs in this period</p>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : null}
    </div>
  );
}
