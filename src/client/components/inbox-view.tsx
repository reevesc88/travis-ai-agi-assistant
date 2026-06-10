import { useEffect, useState } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import type { InboxItem } from "../types";
import { Mail, MessageSquare, Check, CheckCheck, Reply } from "lucide-preact";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "actioned", label: "Actioned" },
];

const CATEGORY_LABELS: Record<string, string> = {
  quote_request: "Quote request",
  invoice: "Invoice",
  scheduling: "Scheduling",
  supplier: "Supplier",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  quote_request: "#60a5fa",
  invoice: "#34d399",
  scheduling: "#fbbf24",
  supplier: "#a78bfa",
  other: "#94a3b8",
};

// Suggested actions derived from the detected category. Clearly labelled as
// AI suggestions; sending real replies is a placeholder in this demo.
const SUGGESTED_REPLY: Record<string, string> = {
  quote_request: "Draft & send the requested quote with itemised labour and materials.",
  invoice: "Acknowledge payment / send a polite reminder with the invoice link.",
  scheduling: "Offer the next available slot and confirm the appointment.",
  supplier: "Review affected open quotes for the new pricing.",
  other: "Review and route to the right module.",
};

function relTime(iso: string): string {
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function InboxView() {
  const { setError, navigate } = useApp();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [filter, setFilter] = useState("");

  const load = async (status: string) => {
    try {
      const params = status ? `?status=${status}` : "";
      const d = await api<{ items: InboxItem[] }>("GET", `/api/inbox${params}`);
      setItems(d.items);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => { load(filter); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (id: number, status: string) => {
    try {
      await api("PUT", `/api/inbox/${id}`, { status });
      await load(filter);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const unread = items.filter((i) => i.status === "unread").length;

  return (
    <div class="page">
      <div class="page-header">
        <h1>AI Inbox</h1>
      </div>

      <p class="page-intro">
        Travis summarises incoming email and SMS, detects the action needed, and suggests a reply.
        Live email/SMS sync is a placeholder — items below are seeded demo data.
      </p>

      <div class="mini-stats">
        <div class="mini-stat alert"><span class="mini-stat-value">{unread}</span><span class="mini-stat-label">Unread</span></div>
        <div class="mini-stat"><span class="mini-stat-value">{items.filter((i) => i.status === "actioned").length}</span><span class="mini-stat-label">Actioned</span></div>
        <div class="mini-stat"><span class="mini-stat-value">{items.length}</span><span class="mini-stat-label">Total</span></div>
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

      {items.length === 0 ? (
        <div class="card"><div class="empty-state"><p>No messages in this view</p></div></div>
      ) : (
        <div class="inbox-list">
          {items.map((item) => {
            const color = CATEGORY_COLORS[item.category] || "#94a3b8";
            return (
              <div key={item.id} class={`inbox-card ${item.status === "unread" ? "unread" : ""}`}>
                <div class="inbox-card-head">
                  <span class="inbox-source">
                    {item.source === "sms" ? <MessageSquare size={13} /> : <Mail size={13} />}
                    {item.sender}
                  </span>
                  <span class="status-badge" style={{ background: `${color}14`, color, borderColor: `${color}30` }}>
                    <span class="status-dot" style={{ background: color }} />
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  {item.status === "unread" && <span class="inbox-unread-dot" title="Unread" />}
                  <span class="inbox-time">{relTime(item.received_at)}</span>
                </div>
                <div class="inbox-subject">{item.subject}</div>
                <div class="inbox-summary"><strong>AI summary:</strong> {item.summary}</div>
                <div class="inbox-suggestion">
                  <Reply size={12} /> <strong>Suggested action:</strong> {SUGGESTED_REPLY[item.category] || SUGGESTED_REPLY.other}
                </div>
                <div class="inbox-card-foot">
                  {item.customer_name ? (
                    <button class="link-btn" onClick={() => item.customer_id && navigate(`/customers/${item.customer_id}`)}>
                      {item.customer_name}
                    </button>
                  ) : (
                    <span class="text-muted">No linked customer</span>
                  )}
                  <div class="action-btns">
                    {item.status === "unread" && (
                      <button class="btn btn-sm" onClick={() => setStatus(item.id, "read")}><Check size={13} /> Mark read</button>
                    )}
                    {item.status !== "actioned" && (
                      <button class="btn btn-sm btn-primary" onClick={() => setStatus(item.id, "actioned")}><CheckCheck size={13} /> Mark actioned</button>
                    )}
                    {item.status === "actioned" && <span class="actioned-tag"><CheckCheck size={13} /> Actioned</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
