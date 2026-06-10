import { useEffect, useRef, useState } from "preact/hooks";
import { useApp } from "../context";
import { Briefcase, Users, CalendarCheck, DollarSign, Clock, CheckCircle, FileText, AlertCircle } from "lucide-preact";
import { StatusBadge } from "./status-badge";
import type { QuoteStatus } from "../types";
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS, riskAdjustedTotal, fmtMoney } from "../quote-utils";

const PIPELINE_STATUSES: QuoteStatus[] = ["draft", "sent", "viewed", "approved"];

function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    prevTarget.current = target;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

export function Dashboard() {
  const { stats, navigate, jobs, quotes } = useApp();

  const todayStr = new Date().toISOString().split("T")[0];
  const todayJobs = jobs.filter((j) => j.scheduled_date === todayStr && j.status !== "cancelled");

  const openQuotes = quotes.filter((q) => PIPELINE_STATUSES.includes(q.status as QuoteStatus));
  const pipeline = PIPELINE_STATUSES.map((status) => {
    const group = openQuotes.filter((q) => q.status === status);
    return {
      status,
      count: group.length,
      base: group.reduce((s, q) => s + q.total, 0),
      risk: group.reduce((s, q) => s + riskAdjustedTotal(q.total, q.risk_level), 0),
    };
  });
  const pipelineRisk = pipeline.reduce((s, p) => s + p.risk, 0);

  const jobCount = useCountUp(stats.jobs);
  const customerCount = useCountUp(stats.customers);
  const todayCount = useCountUp(stats.today_jobs);
  const upcomingCount = useCountUp(stats.upcoming_jobs);
  const completedCount = useCountUp(stats.completed_jobs);
  const revenueCount = useCountUp(stats.revenue);
  const outstandingCount = useCountUp(stats.invoices_outstanding);
  const overdueCount = useCountUp(stats.invoices_overdue);

  return (
    <div class="page">
      <div class="page-header">
        <h1>Dashboard</h1>
      </div>

      <div class="stats-grid">
        <button class="stat-card" onClick={() => navigate("/jobs")}>
          <div class="stat-icon" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", boxShadow: "0 0 12px rgba(59,130,246,0.2)" }}>
            <Briefcase size={20} />
          </div>
          <div class="stat-info">
            <div class="stat-value">{jobCount}</div>
            <div class="stat-label">Total Jobs</div>
          </div>
        </button>
        <button class="stat-card" onClick={() => navigate("/customers")}>
          <div class="stat-icon" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", boxShadow: "0 0 12px rgba(139,92,246,0.2)" }}>
            <Users size={20} />
          </div>
          <div class="stat-info">
            <div class="stat-value">{customerCount}</div>
            <div class="stat-label">Customers</div>
          </div>
        </button>
        <button class="stat-card" onClick={() => navigate("/schedule")}>
          <div class="stat-icon" style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", boxShadow: "0 0 12px rgba(245,158,11,0.2)" }}>
            <Clock size={20} />
          </div>
          <div class="stat-info">
            <div class="stat-value">{todayCount}</div>
            <div class="stat-label">Today's Jobs</div>
          </div>
        </button>
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(6,182,212,0.12)", color: "#22d3ee", boxShadow: "0 0 12px rgba(6,182,212,0.2)" }}>
            <CalendarCheck size={20} />
          </div>
          <div class="stat-info">
            <div class="stat-value">{upcomingCount}</div>
            <div class="stat-label">Upcoming</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", boxShadow: "0 0 12px rgba(52,211,153,0.2)" }}>
            <CheckCircle size={20} />
          </div>
          <div class="stat-info">
            <div class="stat-value">{completedCount}</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", boxShadow: "0 0 12px rgba(52,211,153,0.2)" }}>
            <DollarSign size={20} />
          </div>
          <div class="stat-info">
            <div class="stat-value">${revenueCount.toLocaleString()}</div>
            <div class="stat-label">Revenue</div>
          </div>
        </div>
        <button class="stat-card" onClick={() => navigate("/invoices")}>
          <div class="stat-icon" style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", boxShadow: "0 0 12px rgba(245,158,11,0.2)" }}>
            <FileText size={20} />
          </div>
          <div class="stat-info">
            <div class="stat-value">{outstandingCount}</div>
            <div class="stat-label">Outstanding Invoices</div>
          </div>
        </button>
        {stats.invoices_overdue > 0 && (
          <button class="stat-card" onClick={() => navigate("/invoices")}>
            <div class="stat-icon" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", boxShadow: "0 0 12px rgba(248,113,113,0.2)" }}>
              <AlertCircle size={20} />
            </div>
            <div class="stat-info">
              <div class="stat-value">{overdueCount}</div>
              <div class="stat-label">Overdue</div>
            </div>
          </button>
        )}
      </div>

      {openQuotes.length > 0 && (
        <div class="section">
          <div class="section-head">
            <h2 class="section-title">Quote Pipeline</h2>
            <span class="section-aside">{fmtMoney(pipelineRisk)} risk-adjusted across {openQuotes.length} open</span>
          </div>
          <div class="pipeline-grid">
            {pipeline.map((p) => {
              const color = QUOTE_STATUS_COLORS[p.status];
              return (
                <button key={p.status} class="pipeline-card" onClick={() => navigate("/quotes")}>
                  <div class="pipeline-card-head">
                    <span class="status-badge" style={{ background: `${color}14`, color, borderColor: `${color}30` }}>
                      <span class="status-dot" style={{ background: color }} />
                      {QUOTE_STATUS_LABELS[p.status]}
                    </span>
                    <span class="pipeline-count">{p.count}</span>
                  </div>
                  <div class="pipeline-card-body">
                    <div class="pipeline-figure">
                      <span class="pipeline-figure-label">Base</span>
                      <span class="pipeline-figure-value">{fmtMoney(p.base)}</span>
                    </div>
                    <div class="pipeline-figure">
                      <span class="pipeline-figure-label">Risk-adj.</span>
                      <span class="pipeline-figure-value text-bold">{fmtMoney(p.risk)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {todayJobs.length > 0 && (
        <div class="section">
          <h2 class="section-title">Today's Schedule</h2>
          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>Technician</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todayJobs.map((job) => (
                  <tr key={job.id} class="table-row clickable" onClick={() => navigate(`/jobs/${job.id}`)}>
                    <td class="text-muted">{job.scheduled_time}</td>
                    <td><span class="identifier">{job.identifier}</span></td>
                    <td>{job.customer_name}</td>
                    <td>
                      {job.technician_name ? (
                        <span class="tech-pill" style={{ borderColor: job.technician_color ? `${job.technician_color}50` : "rgba(255,255,255,0.12)", color: job.technician_color || "#94a3b8" }}>
                          <span class="tech-dot" style={{ background: job.technician_color || "#64748b" }} />
                          {job.technician_name}
                        </span>
                      ) : (
                        <span class="text-muted">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
