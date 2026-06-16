import { useEffect, useState } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import type { ReceptionistCall } from "../types";
import { PhoneCall, PhoneMissed, Voicemail, AlertTriangle, Crown } from "lucide-preact";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
  { value: "voicemail", label: "Voicemail" },
];

const INTENT_COLORS: Record<string, string> = {
  booking: "#34d399",
  quote: "#60a5fa",
  complaint: "#f87171",
  general: "#94a3b8",
};

function statusIcon(status: ReceptionistCall["status"]) {
  if (status === "missed") return <PhoneMissed size={14} />;
  if (status === "voicemail") return <Voicemail size={14} />;
  return <PhoneCall size={14} />;
}

function fmtDuration(s: number): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function relTime(iso: string): string {
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function Receptionist() {
  const { setError, navigate } = useApp();
  const [calls, setCalls] = useState<ReceptionistCall[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const params = filter ? `?status=${filter}` : "";
    api<{ calls: ReceptionistCall[] }>("GET", `/api/receptionist/calls${params}`)
      .then((d) => setCalls(d.calls))
      .catch((err) => setError((err as Error).message));
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const followUps = calls.filter((c) => c.follow_up_required).length;

  return (
    <div class="page">
      <div class="page-header">
        <h1>AI Receptionist</h1>
        <div class="page-header-right">
          <span class="provider-badge premium"><Crown size={12} /> Premium Add-on</span>
        </div>
      </div>

      <p class="page-intro">
        Travis answers inbound calls, captures intent, and routes follow-ups. Live phone handling is a
        premium add-on — the calls below are seeded demo data.
      </p>

      <div class="mini-stats">
        <div class="mini-stat"><span class="mini-stat-value">{calls.length}</span><span class="mini-stat-label">Calls logged</span></div>
        <div class="mini-stat"><span class="mini-stat-value">{calls.filter((c) => c.status === "completed").length}</span><span class="mini-stat-label">Answered</span></div>
        <div class="mini-stat"><span class="mini-stat-value">{calls.filter((c) => c.status === "missed" || c.status === "voicemail").length}</span><span class="mini-stat-label">Missed / VM</span></div>
        <div class="mini-stat alert"><span class="mini-stat-value">{followUps}</span><span class="mini-stat-label">Need follow-up</span></div>
      </div>

      <div class="toolbar">
        <div class="filter-group">
          {STATUS_FILTERS.map((s) => (
            <button key={s.value} class={`filter-btn ${filter === s.value ? "active" : ""}`} onClick={() => setFilter(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div class="card">
        {calls.length === 0 ? (
          <div class="empty-state"><p>No calls in this view</p></div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>Caller</th>
                <th>Status</th>
                <th>Intent</th>
                <th>Summary</th>
                <th>Customer</th>
                <th>Duration</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const color = INTENT_COLORS[call.intent] || "#94a3b8";
                return (
                  <tr key={call.id} class="table-row">
                    <td>
                      <div class="cell-stack">
                        <span class="text-bold">{call.caller_name || "Unknown"}</span>
                        <span class="text-muted cell-sub">{call.caller_phone}</span>
                      </div>
                    </td>
                    <td>
                      <span class={`call-status ${call.status}`}>{statusIcon(call.status)} {call.status}</span>
                    </td>
                    <td>
                      <span class="status-badge" style={{ background: `${color}14`, color, borderColor: `${color}30` }}>
                        <span class="status-dot" style={{ background: color }} />
                        {call.intent || "general"}
                      </span>
                    </td>
                    <td class="cell-summary">
                      {call.summary}
                      {call.follow_up_required ? (
                        <span class="escalation-flag"><AlertTriangle size={11} /> Follow-up</span>
                      ) : null}
                    </td>
                    <td>
                      {call.customer_name ? (
                        <button class="link-btn" onClick={() => call.customer_id && navigate(`/customers/${call.customer_id}`)}>{call.customer_name}</button>
                      ) : (
                        <span class="text-muted">—</span>
                      )}
                    </td>
                    <td class="text-muted">{fmtDuration(call.duration_seconds)}</td>
                    <td class="text-muted">{relTime(call.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
