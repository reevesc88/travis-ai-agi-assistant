import { useState, useEffect, useCallback } from "preact/hooks";
import { PhoneCall, PhoneIncoming, PhoneMissed, Phone, RefreshCw, Plus, X, Clock, User, Briefcase, CheckCircle, CheckSquare, Sparkles } from "lucide-preact";
import { api } from "../api";
import type { ReceptionistCall } from "../types";

const ACTION_META: Record<string, { label: string; color: string }> = {
  booked:   { label: "Booked",   color: "#34d399" },
  callback: { label: "Callback", color: "#f59e0b" },
  spam:     { label: "Spam",     color: "#64748b" },
  note:     { label: "Note",     color: "#60a5fa" },
  resolved: { label: "Resolved", color: "#34d399" },
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, color: "#a78bfa" };
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

const FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "booked", label: "Booked" },
  { value: "callback", label: "Callback" },
  { value: "spam", label: "Spam" },
  { value: "resolved", label: "Resolved" },
];

interface NewCallForm {
  caller_name: string;
  caller_phone: string;
  summary: string;
  action: string;
  customer_id: string;
  job_id: string;
  duration_secs: string;
}

interface CustomerOption {
  id: number;
  name: string;
}

interface JobOption {
  id: number;
  identifier: string;
  customer_name?: string;
}

function NewCallModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (call: ReceptionistCall) => void;
}) {
  const [form, setForm] = useState<NewCallForm>({
    caller_name: "",
    caller_phone: "",
    summary: "",
    action: "booked",
    customer_id: "",
    job_id: "",
    duration_secs: "",
  });
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ customers: CustomerOption[] }>("GET", "/api/customers/all"),
      api<{ jobs: JobOption[] }>("GET", "/api/jobs?limit=200"),
    ])
      .then(([cd, jd]) => {
        setCustomers(cd.customers);
        setJobs(jd.jobs ?? []);
      })
      .catch(() => {});
  }, []);

  const set = (field: keyof NewCallForm) => (e: Event) =>
    setForm((f) => ({ ...f, [field]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value }));

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!form.caller_name.trim()) { setError("Caller name is required"); return; }
    if (!form.summary.trim()) { setError("Summary is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const call = await api<ReceptionistCall>("POST", "/api/receptionist/calls", {
        caller_name: form.caller_name.trim(),
        caller_phone: form.caller_phone.trim(),
        summary: form.summary.trim(),
        action: form.action,
        customer_id: form.customer_id ? parseInt(form.customer_id, 10) : null,
        job_id: form.job_id ? parseInt(form.job_id, 10) : null,
        duration_secs: form.duration_secs ? parseInt(form.duration_secs, 10) : 0,
      });
      onCreated(call);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Log New Call</h2>
          <button class="btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div class="form-grid">
            <div class="form-group">
              <label>Caller name *</label>
              <input type="text" value={form.caller_name} onInput={set("caller_name")} placeholder="Full name or Unknown" required />
            </div>
            <div class="form-group">
              <label>Phone number</label>
              <input type="text" value={form.caller_phone} onInput={set("caller_phone")} placeholder="04xx xxx xxx" />
            </div>
            <div class="form-group full-width">
              <label>Call summary *</label>
              <textarea value={form.summary} onInput={set("summary")} rows={3} placeholder="What was the call about?" required />
            </div>
            <div class="form-group">
              <label>Action taken</label>
              <select value={form.action} onChange={set("action")}>
                <option value="booked">Booked</option>
                <option value="callback">Callback required</option>
                <option value="spam">Spam</option>
                <option value="note">Note only</option>
              </select>
            </div>
            <div class="form-group">
              <label>Duration (seconds)</label>
              <input type="number" value={form.duration_secs} onInput={set("duration_secs")} placeholder="0" min="0" />
            </div>
            <div class="form-group">
              <label>Link to customer</label>
              <select value={form.customer_id} onChange={set("customer_id")}>
                <option value="">— none —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div class="form-group">
              <label>Link to job</label>
              <select value={form.job_id} onChange={set("job_id")}>
                <option value="">— none —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.identifier}{j.customer_name ? ` — ${j.customer_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {error && <div class="error-inline" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" class="btn-primary" disabled={submitting}>
              <PhoneCall size={14} />
              {submitting ? "Saving…" : "Save call"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ReceptionistViewProps {
  navigate: (to: string) => void;
}

export function ReceptionistView({ navigate }: ReceptionistViewProps) {
  const [calls, setCalls] = useState<ReceptionistCall[]>([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [selected, setSelected] = useState<ReceptionistCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ calls: ReceptionistCall[]; total: number }>(
        "GET", "/api/receptionist/calls?page=1&limit=100"
      );
      setCalls(data.calls);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const filtered = actionFilter
    ? calls.filter((c) => c.action === actionFilter)
    : calls;

  const callbackCount = calls.filter((c) => c.action === "callback").length;

  const handleCreated = useCallback((call: ReceptionistCall) => {
    setCalls((prev) => [call, ...prev]);
    setTotal((t) => t + 1);
    setSelected(call);
  }, []);

  const [resolving, setResolving] = useState(false);
  const [resolvingAll, setResolvingAll] = useState(false);

  const handleResolve = useCallback(async () => {
    if (!selected) return;
    setResolving(true);
    try {
      const updated = await api<ReceptionistCall>("PATCH", `/api/receptionist/calls/${selected.id}`, { action: "resolved" });
      setCalls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelected(updated);
    } catch {
    } finally {
      setResolving(false);
    }
  }, [selected]);

  const handleResolveAll = useCallback(async () => {
    const pending = calls.filter((c) => c.action === "callback");
    if (pending.length === 0) return;
    setResolvingAll(true);
    try {
      const results = await Promise.all(
        pending.map((c) =>
          api<ReceptionistCall>("PATCH", `/api/receptionist/calls/${c.id}`, { action: "resolved" })
        )
      );
      const resolvedMap = new Map(results.map((r) => [r.id, r]));
      setCalls((prev) => prev.map((c) => resolvedMap.get(c.id) ?? c));
      setSelected((sel) => (sel && resolvedMap.has(sel.id) ? resolvedMap.get(sel.id)! : sel));
    } catch {
    } finally {
      setResolvingAll(false);
    }
  }, [calls]);

  return (
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Receptionist</h1>
          {callbackCount > 0 && (
            <span class="rcall-callback-badge">{callbackCount} callback{callbackCount > 1 ? "s" : ""} pending</span>
          )}
        </div>
        <div class="page-header-actions">
          <button class="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} />
            New Call
          </button>
          <button class="btn-icon" onClick={fetchCalls} disabled={loading} title="Refresh">
            <RefreshCw size={14} class={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-group">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              class={`filter-btn ${actionFilter === f.value ? "active" : ""}`}
              onClick={() => { setActionFilter(f.value); setSelected(null); }}
            >
              {f.label}
              {f.value === "callback" && callbackCount > 0 && (
                <span class="filter-badge">{callbackCount}</span>
              )}
            </button>
          ))}
        </div>
        <div class="toolbar-actions">
          {actionFilter === "callback" && callbackCount > 0 && (
            <button
              class="btn-secondary rcall-resolve-all-btn"
              onClick={handleResolveAll}
              disabled={resolvingAll}
            >
              <CheckSquare size={13} />
              {resolvingAll ? "Resolving…" : `Resolve all (${callbackCount})`}
            </button>
          )}
          <span class="rcall-total-label">{total} call{total !== 1 ? "s" : ""} total</span>
        </div>
      </div>

      {error && <div class="error-inline">{error}</div>}

      <div class="inbox-layout">
        <div class="inbox-list card">
          {loading ? (
            <div class="empty-state"><p>Loading…</p></div>
          ) : filtered.length === 0 ? (
            <div class="empty-state">
              <Phone size={32} style={{ opacity: 0.4 }} />
              <p>{actionFilter ? `No ${actionFilter} calls` : "No calls logged yet"}</p>
            </div>
          ) : (
            filtered.map((call) => {
              const meta = actionMeta(call.action);
              const isCallback = call.action === "callback";
              return (
                <button
                  key={call.id}
                  class={`inbox-item rcall-item ${selected?.id === call.id ? "active" : ""} ${isCallback ? "rcall-callback" : ""}`}
                  onClick={() => setSelected(call)}
                >
                  <div class="rcall-item-icon" style={{ color: meta.color }}>
                    {isCallback ? <PhoneMissed size={15} /> : <PhoneIncoming size={15} />}
                  </div>
                  <div class="inbox-item-body">
                    <div class="inbox-item-row">
                      <span class="inbox-item-sender">{call.caller_name}</span>
                      <span class="inbox-item-time">{formatTime(call.created_at)}</span>
                    </div>
                    <div class="rcall-item-phone">
                      {call.caller_phone}
                      {call.duration_secs > 0 && (
                        <span class="rcall-list-duration">· {formatDuration(call.duration_secs)}</span>
                      )}
                    </div>
                    <div class="inbox-item-preview" style={{ marginTop: 2 }}>{call.summary}</div>
                  </div>
                  <span
                    class="status-badge rcall-action-badge"
                    style={{
                      background: `${meta.color}14`,
                      color: meta.color,
                      borderColor: `${meta.color}30`,
                    }}
                  >
                    {meta.label}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selected ? (
          <div class="inbox-detail card">
            <div class="inbox-detail-topbar">
              <div class="inbox-detail-meta">
                <PhoneIncoming size={13} style={{ color: "#60a5fa" }} />
                <span class="text-muted" style={{ fontSize: 12 }}>Inbound call</span>
                <span
                  class="status-badge"
                  style={{
                    background: `${actionMeta(selected.action).color}14`,
                    color: actionMeta(selected.action).color,
                    borderColor: `${actionMeta(selected.action).color}30`,
                  }}
                >
                  <span class="status-dot" style={{ background: actionMeta(selected.action).color }} />
                  {actionMeta(selected.action).label}
                </span>
              </div>
              {selected.action === "callback" && (
                <button
                  class="rcall-resolve-btn"
                  onClick={handleResolve}
                  disabled={resolving}
                >
                  <CheckCircle size={13} />
                  {resolving ? "Saving…" : "Mark resolved"}
                </button>
              )}
            </div>

            <h2 class="inbox-detail-subject">{selected.caller_name}</h2>
            <div class="inbox-detail-from">{selected.caller_phone}</div>

            <div class="rcall-detail-meta-row">
              {selected.duration_secs > 0 && (
                <span class="rcall-meta-chip">
                  <Clock size={11} />
                  {formatDuration(selected.duration_secs)}
                </span>
              )}
              <span class="rcall-meta-chip">
                {formatTime(selected.created_at)}
              </span>
            </div>

            <div class="inbox-detail-body" style={{ marginTop: 16 }}>
              <div class="inbox-detail-body-label">Call Summary</div>
              <p class="inbox-detail-body-text">{selected.summary}</p>
            </div>

            {selected.ai_output_summary && (
              <div class="inbox-ai-card">
                <div class="inbox-ai-label">
                  <Sparkles size={12} />
                  AI Summary
                  {selected.ai_model && (
                    <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 4, opacity: 0.7 }}>
                      · {selected.ai_model}
                    </span>
                  )}
                </div>
                <p class="inbox-ai-text">{selected.ai_output_summary}</p>
              </div>
            )}

            {(selected.customer_id || selected.job_id) && (
              <div class="rcall-links">
                {selected.customer_id && (
                  <button
                    class="rcall-link-btn"
                    onClick={() => navigate(`/customers/${selected.customer_id}`)}
                  >
                    <User size={13} />
                    {selected.customer_name ?? `Customer #${selected.customer_id}`}
                  </button>
                )}
                {selected.job_id && (
                  <button
                    class="rcall-link-btn"
                    onClick={() => navigate(`/jobs/${selected.job_id}`)}
                  >
                    <Briefcase size={13} />
                    {selected.job_identifier ?? `Job #${selected.job_id}`}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div class="inbox-detail-empty card">
            <div class="empty-state">
              <PhoneCall size={32} style={{ opacity: 0.3 }} />
              <p>Select a call to view details</p>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewCallModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
