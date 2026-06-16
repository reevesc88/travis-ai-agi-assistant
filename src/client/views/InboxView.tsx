import { useState, useEffect, useCallback } from "preact/hooks";
import { Mail, MessageSquare, Sparkles, CheckCheck, Archive, RefreshCw, Inbox, PenSquare, Reply, X, Send, MessageCircle, UserPlus } from "lucide-preact";
import { api } from "../api";
import { useApp } from "../context";
import type { InboxItem, InboxStatus } from "../types";

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "actioned", label: "Actioned" },
  { value: "archived", label: "Archived" },
];

const STATUS_COLORS: Record<InboxStatus, string> = {
  unread: "#f59e0b",
  read: "#60a5fa",
  actioned: "#34d399",
  archived: "#64748b",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

interface ComposeState {
  replyTo?: InboxItem;
}

interface Customer {
  id: number;
  name: string;
  address: string;
}

function ComposeModal({
  replyTo,
  onClose,
  onSent,
}: {
  replyTo?: InboxItem;
  onClose: () => void;
  onSent: (item: InboxItem) => void;
}) {
  const isReply = !!replyTo;
  const defaultChannel = replyTo
    ? (replyTo.source === "sms" ? "sms" : "email")
    : "email";

  const [channel, setChannel] = useState<"email" | "sms">(defaultChannel);
  const [to, setTo] = useState(replyTo?.sender ?? "");
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : ""
  );
  const [body, setBody] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(
    replyTo?.customer_id ?? null
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ customers: Customer[] }>("GET", "/api/customers/all")
      .then((d) => setCustomers(d.customers))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!to.trim()) { setError("Recipient is required"); return; }
    if (!body.trim()) { setError("Message body is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const source = channel === "sms" ? "sms_out" : "email_out";
      const threadId = replyTo ? (replyTo.thread_id ?? replyTo.id) : null;
      const result = await api<{ id: number }>("POST", "/api/inbox", {
        source,
        subject: subject.trim() || `(no subject)`,
        body: body.trim(),
        sender: to.trim(),
        customer_id: customerId,
        thread_id: threadId,
      });
      const newItem: InboxItem = {
        id: result.id,
        source,
        subject: subject.trim() || `(no subject)`,
        body: body.trim(),
        sender: to.trim(),
        status: "actioned",
        customer_id: customerId,
        thread_id: threadId,
        ai_summary: "",
        ai_action: "",
        customer_name: customers.find((c) => c.id === customerId)?.name,
        created_at: new Date().toISOString(),
      };
      onSent(newItem);
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
          <h2>{isReply ? "Reply" : "New Message"}</h2>
          <button class="btn-icon" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div class="form-grid">
            <div class="form-group full-width">
              <label>Channel</label>
              <div class="filter-group" style={{ marginTop: 2 }}>
                <button
                  type="button"
                  class={`filter-btn ${channel === "email" ? "active" : ""}`}
                  onClick={() => setChannel("email")}
                >
                  <Mail size={12} /> Email
                </button>
                <button
                  type="button"
                  class={`filter-btn ${channel === "sms" ? "active" : ""}`}
                  onClick={() => setChannel("sms")}
                >
                  <MessageSquare size={12} /> SMS
                </button>
              </div>
            </div>

            {!isReply && (
              <div class="form-group full-width">
                <label>Customer (optional)</label>
                <select
                  value={customerId ?? ""}
                  onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    setCustomerId(v ? parseInt(v, 10) : null);
                  }}
                >
                  <option value="">— none —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div class="form-group full-width">
              <label>To *</label>
              <input
                type="text"
                value={to}
                onInput={(e) => setTo((e.target as HTMLInputElement).value)}
                placeholder={channel === "sms" ? "Mobile number" : "Email address"}
                required
              />
            </div>

            {channel === "email" && (
              <div class="form-group full-width">
                <label>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onInput={(e) => setSubject((e.target as HTMLInputElement).value)}
                  placeholder="Subject"
                />
              </div>
            )}

            <div class="form-group full-width">
              <label>Message *</label>
              <textarea
                value={body}
                onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
                placeholder="Write your message…"
                rows={5}
                required
              />
            </div>

            {error && <div class="error-inline" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" class="btn-primary" disabled={submitting}>
              <Send size={14} />
              {submitting ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InboxView() {
  const { fetchStats } = useApp();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [threadItems, setThreadItems] = useState<InboxItem[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [linkingCustomer, setLinkingCustomer] = useState(false);
  const [linkCustomerId, setLinkCustomerId] = useState<number | "">("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  const fetchItems = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (status) params.set("status", status);
      const [data, unreadData] = await Promise.all([
        api<{ items: InboxItem[]; total: number }>("GET", `/api/inbox?${params}`),
        status === "unread"
          ? Promise.resolve(null)
          : api<{ items: InboxItem[]; total: number }>("GET", "/api/inbox?status=unread&page=1&limit=1"),
      ]);
      setItems(data.items);
      setUnreadTotal(status === "unread" ? data.total : (unreadData?.total ?? 0));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(statusFilter);
  }, [statusFilter, fetchItems]);


  const updateStatus = useCallback(async (item: InboxItem, newStatus: InboxStatus) => {
    setBusy(true);
    try {
      await api("PUT", `/api/inbox/${item.id}`, { status: newStatus });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
      setSelected(prev => prev?.id === item.id ? { ...prev, status: newStatus } : prev);
      if (item.status === "unread" && newStatus !== "unread") {
        setUnreadTotal(prev => Math.max(0, prev - 1));
        fetchStats().catch(() => {});
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [fetchStats]);

  const markAllRead = useCallback(async () => {
    const unread = items.filter(i => i.status === "unread");
    if (!unread.length) return;
    setBusy(true);
    try {
      await Promise.all(unread.map(i => api("PUT", `/api/inbox/${i.id}`, { status: "read" })));
      setItems(prev => prev.map(i => i.status === "unread" ? { ...i, status: "read" as InboxStatus } : i));
      setSelected(prev => prev?.status === "unread" ? { ...prev, status: "read" as InboxStatus } : prev);
      setUnreadTotal(0);
      fetchStats().catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [items, fetchStats]);

  useEffect(() => {
    api<{ customers: Customer[] }>("GET", "/api/customers/all")
      .then((d) => setCustomers(d.customers))
      .catch(() => {});
  }, []);

  const selectItem = useCallback(async (item: InboxItem) => {
    setSelected(item);
    setThreadItems([]);
    setLinkingCustomer(false);
    setLinkCustomerId("");
    if (item.status === "unread") updateStatus(item, "read");
    setThreadLoading(true);
    try {
      const data = await api<{ items: InboxItem[] }>("GET", `/api/inbox/${item.id}/thread`);
      setThreadItems(data.items);
      const unreadReplies = data.items.filter(r => r.id !== item.id && r.status === "unread");
      if (unreadReplies.length > 0) {
        await Promise.all(unreadReplies.map(r => api("PUT", `/api/inbox/${r.id}`, { status: "read" })));
        setThreadItems(prev => prev.map(r =>
          unreadReplies.some(u => u.id === r.id) ? { ...r, status: "read" as InboxStatus } : r
        ));
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, unread_replies: 0 } : i));
      }
    } catch {
      setThreadItems([]);
    } finally {
      setThreadLoading(false);
    }
  }, [updateStatus]);

  const linkCustomer = useCallback(async () => {
    if (!selected || linkCustomerId === "") return;
    setBusy(true);
    try {
      await api("PUT", `/api/inbox/${selected.id}`, { customer_id: linkCustomerId });
      const customerName = customers.find((c) => c.id === linkCustomerId)?.name;
      const updated = { ...selected, customer_id: linkCustomerId as number, customer_name: customerName };
      setItems(prev => prev.map(i => i.id === selected.id ? updated : i));
      setSelected(updated);
      setLinkingCustomer(false);
      setLinkCustomerId("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [selected, linkCustomerId, customers]);

  const unlinkCustomer = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api("PUT", `/api/inbox/${selected.id}`, { customer_id: null });
      const updated = { ...selected, customer_id: undefined as unknown as number, customer_name: undefined };
      setItems(prev => prev.map(i => i.id === selected.id ? updated : i));
      setSelected(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [selected]);

  const handleSent = useCallback((newItem: InboxItem) => {
    if (newItem.thread_id !== null && newItem.thread_id !== undefined) {
      setThreadItems(prev => [...prev, newItem]);
      setItems(prev => prev.map(i =>
        i.id === newItem.thread_id
          ? { ...i, reply_count: (i.reply_count ?? 0) + 1, latest_at: newItem.created_at }
          : i
      ));
    } else {
      setItems(prev => [newItem, ...prev]);
    }
  }, []);

  const isIncoming = (source: string) => source === "email" || source === "sms";

  return (
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Inbox</h1>
          {unreadTotal > 0 && (
            <span class="inbox-unread-badge">{unreadTotal} unread</span>
          )}
        </div>
        <div class="page-header-actions">
          <button
            class="btn-secondary"
            onClick={markAllRead}
            disabled={busy || unreadTotal === 0}
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
          <button
            class="btn-primary"
            onClick={() => setCompose({})}
          >
            <PenSquare size={14} />
            New message
          </button>
          <button
            class="btn-icon"
            onClick={() => fetchItems(statusFilter)}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={14} class={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-group">
          {FILTER_OPTIONS.map(f => (
            <button
              key={f.value}
              class={`filter-btn ${statusFilter === f.value ? "active" : ""}`}
              onClick={() => { setStatusFilter(f.value); setSelected(null); setThreadItems([]); }}
            >
              {f.label}
              {f.value === "unread" && unreadTotal > 0 && (
                <span class="filter-badge">{unreadTotal}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && <div class="error-inline">{error}</div>}

      <div class="inbox-layout">
        {/* ── List panel ── */}
        <div class="inbox-list card">
          {loading ? (
            <div class="empty-state"><p>Loading…</p></div>
          ) : items.length === 0 ? (
            <div class="empty-state">
              <Inbox size={32} style={{ opacity: 0.4 }} />
              <p>{statusFilter ? `No ${statusFilter} messages` : "Inbox is empty"}</p>
            </div>
          ) : (
            items.map(item => {
              const isOut = item.source === "email_out" || item.source === "sms_out";
              const SourceIcon = (item.source === "sms" || item.source === "sms_out") ? MessageSquare : Mail;
              const isUnread = item.status === "unread";
              const replyCount = item.reply_count ?? 0;
              const unreadReplies = item.unread_replies ?? 0;
              const displayTime = item.latest_at ?? item.created_at;
              return (
                <button
                  key={item.id}
                  class={`inbox-item ${selected?.id === item.id ? "active" : ""} ${isUnread ? "unread" : ""}`}
                  onClick={() => selectItem(item)}
                >
                  <div
                    class="inbox-item-icon"
                    style={{ color: (item.source === "sms" || item.source === "sms_out") ? "#a78bfa" : "#60a5fa", opacity: isOut ? 0.65 : 1 }}
                  >
                    <SourceIcon size={15} />
                  </div>
                  <div class="inbox-item-body">
                    <div class="inbox-item-row">
                      <span class="inbox-item-sender">
                        {isOut && <span style={{ fontSize: 10, color: "var(--text-muted)", marginRight: 4 }}>To:</span>}
                        {item.sender}
                      </span>
                      <span class="inbox-item-time">{formatTime(displayTime)}</span>
                    </div>
                    <div class="inbox-item-subject">{item.subject}</div>
                    <div class="inbox-item-meta-row">
                      {item.ai_summary && (
                        <span class="inbox-item-preview">{item.ai_summary}</span>
                      )}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {unreadReplies > 0 && (
                          <span class="inbox-unread-reply-badge">
                            <MessageCircle size={10} />
                            {unreadReplies} unread
                          </span>
                        )}
                        {replyCount > 0 && unreadReplies === 0 && (
                          <span class="inbox-reply-badge">
                            <MessageCircle size={10} />
                            {replyCount}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  {isUnread && <span class="inbox-unread-dot" />}
                </button>
              );
            })
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected ? (
          <div class="inbox-detail card">
            <div class="inbox-detail-topbar">
              <div class="inbox-detail-meta">
                {(selected.source === "sms" || selected.source === "sms_out")
                  ? <MessageSquare size={13} style={{ color: "#a78bfa" }} />
                  : <Mail size={13} style={{ color: "#60a5fa" }} />}
                <span class="text-muted" style={{ textTransform: "capitalize", fontSize: 12 }}>
                  {selected.source === "email_out" ? "Email (sent)" : selected.source === "sms_out" ? "SMS (sent)" : selected.source}
                </span>
                <span
                  class="status-badge"
                  style={{
                    background: `${STATUS_COLORS[selected.status as InboxStatus]}14`,
                    color: STATUS_COLORS[selected.status as InboxStatus],
                    borderColor: `${STATUS_COLORS[selected.status as InboxStatus]}30`,
                  }}
                >
                  <span
                    class="status-dot"
                    style={{ background: STATUS_COLORS[selected.status as InboxStatus] }}
                  />
                  {selected.status}
                </span>
                {selected.customer_name ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                    <span class="text-muted" style={{ fontSize: 12 }}>· {selected.customer_name}</span>
                    {isIncoming(selected.source) && !linkingCustomer && (
                      <>
                        <button
                          class="btn-ghost"
                          style={{ padding: "1px 4px", display: "inline-flex", alignItems: "center", lineHeight: 1 }}
                          onClick={() => { setLinkingCustomer(true); setLinkCustomerId(selected.customer_id ?? ""); }}
                          type="button"
                          title="Change customer"
                          disabled={busy}
                        >
                          <PenSquare size={11} />
                        </button>
                        <button
                          class="btn-ghost"
                          style={{ padding: "1px 4px", display: "inline-flex", alignItems: "center", lineHeight: 1 }}
                          onClick={unlinkCustomer}
                          type="button"
                          title="Remove customer link"
                          disabled={busy}
                        >
                          <X size={11} />
                        </button>
                      </>
                    )}
                  </span>
                ) : isIncoming(selected.source) && !linkingCustomer && (
                  <button
                    class="btn-ghost"
                    style={{ fontSize: 12, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => setLinkingCustomer(true)}
                    type="button"
                  >
                    <UserPlus size={12} />
                    Link customer
                  </button>
                )}
              </div>
              {linkingCustomer && (
                <div class="inbox-link-customer-row">
                  <select
                    value={linkCustomerId}
                    onChange={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      setLinkCustomerId(v ? parseInt(v, 10) : "");
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">— select customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    class="btn-primary"
                    disabled={busy || linkCustomerId === ""}
                    onClick={linkCustomer}
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    class="btn-secondary"
                    onClick={() => { setLinkingCustomer(false); setLinkCustomerId(""); }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div class="inbox-detail-actions">
                {isIncoming(selected.source) && (
                  <button
                    class="btn-primary"
                    onClick={() => setCompose({ replyTo: selected })}
                  >
                    <Reply size={14} />
                    Reply
                  </button>
                )}
                {selected.status !== "actioned" && (
                  <button
                    class="btn-secondary"
                    disabled={busy}
                    onClick={() => updateStatus(selected, "actioned")}
                  >
                    Mark actioned
                  </button>
                )}
                {selected.status !== "archived" && (
                  <button
                    class="btn-icon"
                    title="Archive"
                    disabled={busy}
                    onClick={() => updateStatus(selected, "archived")}
                  >
                    <Archive size={14} />
                  </button>
                )}
              </div>
            </div>

            <h2 class="inbox-detail-subject">{selected.subject}</h2>
            <div class="inbox-detail-from">
              {isIncoming(selected.source) ? "From" : "To"}: {selected.sender}
            </div>

            {selected.ai_summary && (
              <div class="inbox-ai-card">
                <div class="inbox-ai-label">
                  <Sparkles size={12} />
                  AI Summary
                </div>
                <p class="inbox-ai-text">{selected.ai_summary}</p>
              </div>
            )}

            {selected.ai_action && (
              <div class="inbox-ai-action-row">
                <span class="text-muted" style={{ fontSize: 12 }}>Suggested action:</span>
                <button
                  class="btn-primary"
                  disabled={busy}
                  onClick={() => updateStatus(selected, "actioned")}
                >
                  {selected.ai_action}
                </button>
              </div>
            )}

            {/* ── Thread ── */}
            {threadLoading ? (
              <div class="inbox-thread-loading">Loading conversation…</div>
            ) : threadItems.length > 0 ? (
              <div class="inbox-thread">
                <div class="inbox-thread-label">
                  <MessageCircle size={12} />
                  Conversation ({threadItems.length} message{threadItems.length !== 1 ? "s" : ""})
                </div>
                {threadItems.map((msg, idx) => {
                  const isOut = msg.source === "email_out" || msg.source === "sms_out";
                  const MsgIcon = (msg.source === "sms" || msg.source === "sms_out") ? MessageSquare : Mail;
                  return (
                    <div key={msg.id} class={`inbox-thread-msg ${isOut ? "outgoing" : "incoming"}`}>
                      <div class="inbox-thread-msg-header">
                        <span class="inbox-thread-msg-dir">
                          <MsgIcon size={11} />
                          {isOut ? "Sent" : "Received"}
                        </span>
                        <span class="inbox-thread-msg-sender">{msg.sender}</span>
                        <span class="inbox-thread-msg-time">{formatTime(msg.created_at)}</span>
                      </div>
                      <p class="inbox-thread-msg-body">{msg.body}</p>
                    </div>
                  );
                })}
                <div class="inbox-thread-reply-footer">
                  {(() => {
                    const lastIncoming = [...threadItems].reverse().find(m => isIncoming(m.source));
                    const replyTarget = lastIncoming ?? selected;
                    return (
                      <button
                        class="btn-primary"
                        onClick={() => setCompose({ replyTo: replyTarget })}
                        type="button"
                      >
                        <Reply size={14} />
                        Reply
                      </button>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div class="inbox-detail-body">
                <div class="inbox-detail-body-label">Message</div>
                <p class="inbox-detail-body-text">{selected.body}</p>
              </div>
            )}
          </div>
        ) : (
          <div class="inbox-detail-empty card">
            <div class="empty-state">
              <Inbox size={32} style={{ opacity: 0.3 }} />
              <p>Select a message to read it</p>
            </div>
          </div>
        )}
      </div>

      {compose !== null && (
        <ComposeModal
          replyTo={compose.replyTo}
          onClose={() => setCompose(null)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
