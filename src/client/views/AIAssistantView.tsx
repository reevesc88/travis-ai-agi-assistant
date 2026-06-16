import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { api } from "../api";
import { Bot, Send, Zap, Clock, ChevronLeft, ChevronRight, ListChecks, ChevronDown, ChevronUp } from "lucide-preact";
import type { AIActivity } from "../types";

const AI_MODEL_NAMES: Record<string, string> = {
  "anthropic/claude-3-haiku": "Claude 3 Haiku",
  "anthropic/claude-3.5-haiku": "Claude 3.5 Haiku",
  "google/gemini-flash-1.5": "Gemini Flash 1.5",
  "google/gemini-2.0-flash-lite": "Gemini 2.0 Flash Lite",
  "mistral/mistral-small": "Mistral Small",
  "openai/gpt-4o-mini": "GPT-4o Mini",
};

interface AgentRun {
  started_at: string;
  duration_s: number;
  mode: string;
  status: string;
  exit_code: number;
  inbox_was_empty?: boolean;
  tasks_applied: number;
  tasks_dry_run: number;
  tasks_skipped: number;
  tasks_failed: number;
  stdout?: string | null;
  stderr?: string | null;
}

interface Message {
  role: "user" | "ai";
  text: string;
  source?: string;
  responseMs?: number;
}

const STARTER_PROMPTS = [
  "Which technician has capacity tomorrow?",
  "How many jobs are scheduled this week?",
  "Draft a follow-up email for a customer whose job was completed today.",
  "What's our outstanding invoice value?",
];

const MODULES = ["all", "assistant", "inbox", "quotes", "receptionist"];
const PAGE_SIZE = 20;

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return ts;
  }
}

function ActivityLog({ refreshKey }: { refreshKey: number }) {
  const [module, setModule] = useState("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AIActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mod: string, pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(pg), limit: String(PAGE_SIZE) });
      if (mod !== "all") qs.set("module", mod);
      const data = await api<{ activity: AIActivity[]; total: number }>("GET", `/api/ai/activity?${qs}`);
      setRows(data.activity);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(module, page); }, [module, page, load, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeModule = (mod: string) => {
    setModule(mod);
    setPage(1);
  };

  return (
    <div class="ai-activity-log">
      <div class="ai-activity-toolbar">
        <div class="ai-activity-filters">
          {MODULES.map((m) => (
            <button
              key={m}
              class={`ai-activity-filter-btn${module === m ? " active" : ""}`}
              onClick={() => changeModule(m)}
            >
              {m === "all" ? "All modules" : m}
            </button>
          ))}
        </div>
        <span class="ai-activity-count">{total} record{total !== 1 ? "s" : ""}</span>
      </div>

      {error && <div class="ai-chat-error">{error}</div>}

      <div class="ai-activity-table-wrap">
        <table class="ai-activity-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Module</th>
              <th>Action</th>
              <th>Model</th>
              <th>Tokens</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colspan={6} class="ai-activity-empty">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colspan={6} class="ai-activity-empty">No activity recorded yet. Use the Chat tab to ask Travis AI a question.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td class="ai-activity-ts">{fmt(r.created_at)}</td>
                <td><span class={`ai-activity-module-badge mod-${r.module}`}>{r.module}</span></td>
                <td class="ai-activity-action">{r.action}</td>
                <td class="ai-activity-model">{r.model || "—"}</td>
                <td class="ai-activity-num">{r.tokens_used > 0 ? r.tokens_used : "—"}</td>
                <td class="ai-activity-num">{r.duration_ms > 0 ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div class="ai-activity-pagination">
          <button
            class="ai-activity-page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span class="ai-activity-page-info">Page {page} of {totalPages}</span>
          <button
            class="ai-activity-page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function AgentRunsLog() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ runs: AgentRun[] }>("GET", "/api/agent/runs?limit=50");
      setRuns(data.runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const toggle = (i: number) => setExpanded((prev) => (prev === i ? null : i));

  return (
    <div class="ai-activity-log">
      <div class="ai-activity-toolbar">
        <span class="ai-activity-count">{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
        <button class="ai-activity-page-btn" onClick={load} disabled={loading} style="margin-left:auto">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div class="ai-chat-error">{error}</div>}

      <div class="ai-activity-table-wrap">
        <table class="ai-activity-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Status</th>
              <th>Mode</th>
              <th>Applied</th>
              <th>Skipped</th>
              <th>Failed</th>
              <th>Duration</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && runs.length === 0 && (
              <tr><td colspan={8} class="ai-activity-empty">Loading…</td></tr>
            )}
            {!loading && runs.length === 0 && (
              <tr><td colspan={8} class="ai-activity-empty">No agent runs recorded yet.</td></tr>
            )}
            {runs.map((r, i) => (
              <>
                <tr key={`row-${i}`} class={expanded === i ? "ai-agent-run-row-expanded" : ""}>
                  <td class="ai-activity-ts">{fmt(r.started_at)}</td>
                  <td>
                    <span class={`ai-activity-module-badge mod-${r.status === "ok" ? "inbox" : "receptionist"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td class="ai-activity-model">{r.mode}</td>
                  <td class="ai-activity-num">{r.tasks_applied}</td>
                  <td class="ai-activity-num">{r.tasks_skipped}</td>
                  <td class="ai-activity-num">{r.tasks_failed}</td>
                  <td class="ai-activity-num">{r.duration_s.toFixed(1)}s</td>
                  <td class="ai-activity-num">
                    <button
                      class="ai-agent-log-expand-btn"
                      onClick={() => toggle(i)}
                      aria-expanded={expanded === i}
                      aria-label={expanded === i ? "Collapse log" : "Expand log"}
                      title={expanded === i ? "Collapse log" : "View log"}
                    >
                      {expanded === i ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </td>
                </tr>
                {expanded === i && (
                  <tr key={`detail-${i}`} class="ai-agent-log-detail-row">
                    <td colspan={8} class="ai-agent-log-detail-cell">
                      {r.stdout ? (
                        <div class="ai-agent-log-section">
                          <span class="ai-agent-log-label">stdout</span>
                          <pre class="ai-agent-log-pre">{r.stdout}</pre>
                        </div>
                      ) : (
                        <span class="ai-agent-log-empty">No output captured.</span>
                      )}
                      {r.stderr && (
                        <div class="ai-agent-log-section">
                          <span class="ai-agent-log-label ai-agent-log-label-err">stderr</span>
                          <pre class="ai-agent-log-pre ai-agent-log-pre-err">{r.stderr}</pre>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AIAssistantView() {
  const [tab, setTab] = useState<"chat" | "activity" | "runs">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState("anthropic/claude-3-haiku");
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [activityUpdated, setActivityUpdated] = useState(false);
  const activityUpdatedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api<{ model: string }>("GET", "/api/settings/ai-model")
      .then((r) => setActiveModel(r.model))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => { if (activityUpdatedTimer.current) clearTimeout(activityUpdatedTimer.current); };
  }, []);

  useEffect(() => {
    if (tab === "chat") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, tab]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);

    const t0 = Date.now();
    try {
      const result = await api<{ text: string; source: string }>("POST", "/api/ai/assistant", { prompt: trimmed });
      const responseMs = Date.now() - t0;
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: result.text, source: result.source, responseMs },
      ]);
      setActivityRefreshKey((k) => k + 1);
      setActivityUpdated(true);
      if (activityUpdatedTimer.current) clearTimeout(activityUpdatedTimer.current);
      activityUpdatedTimer.current = setTimeout(() => setActivityUpdated(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div class="ai-chat-root">
      <div class="page-header">
        <div class="page-header-left">
          <Bot size={18} class="page-header-icon" />
          <div>
            <h1 class="page-title">Travis AI</h1>
            <p class="page-subtitle">
              Ask anything about your jobs, customers, quotes, or invoices
              {" · "}
              <span class="ai-active-model-badge">{AI_MODEL_NAMES[activeModel] ?? activeModel}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="ai-tabs">
        <button
          class={`ai-tab-btn${tab === "chat" ? " active" : ""}`}
          onClick={() => setTab("chat")}
        >
          <Bot size={13} /> Chat
        </button>
        <button
          class={`ai-tab-btn${tab === "activity" ? " active" : ""}`}
          onClick={() => { setTab("activity"); setActivityUpdated(false); if (activityUpdatedTimer.current) clearTimeout(activityUpdatedTimer.current); }}
        >
          <Clock size={13} /> Usage History
          {activityUpdated && tab !== "activity" && <span class="ai-tab-updated-dot" title="Updated just now" />}
        </button>
        <button
          class={`ai-tab-btn${tab === "runs" ? " active" : ""}`}
          onClick={() => setTab("runs")}
        >
          <ListChecks size={13} /> Agent Runs
        </button>
      </div>

      {tab === "chat" && (
        <div class="ai-chat-container">
          <div class="ai-chat-thread">
            {messages.length === 0 && !loading && (
              <div class="ai-chat-empty">
                <div class="ai-chat-empty-icon">
                  <Bot size={32} />
                </div>
                <p class="ai-chat-empty-title">How can I help?</p>
                <p class="ai-chat-empty-sub">Try one of these to get started:</p>
                <div class="ai-chat-starters">
                  {STARTER_PROMPTS.map((p) => (
                    <button key={p} class="ai-chat-starter-btn" onClick={() => send(p)}>
                      <Zap size={12} />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} class={`ai-chat-bubble-row ${msg.role === "user" ? "user" : "ai"}`}>
                {msg.role === "ai" && (
                  <div class="ai-chat-avatar">
                    <Bot size={14} />
                  </div>
                )}
                <div class={`ai-chat-bubble ${msg.role === "user" ? "user" : "ai"}`}>
                  <p class="ai-chat-bubble-text">{msg.text}</p>
                  {msg.role === "ai" && (
                    <div class="ai-chat-meta">
                      <span class={`ai-chat-source ${msg.source === "mock" ? "mock" : "live"}`}>
                        {msg.source === "mock" ? "mock" : `live · ${AI_MODEL_NAMES[activeModel] ?? activeModel}`}
                      </span>
                      {msg.responseMs !== undefined && (
                        <span class="ai-chat-time">{(msg.responseMs / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div class="ai-chat-bubble-row ai">
                <div class="ai-chat-avatar">
                  <Bot size={14} />
                </div>
                <div class="ai-chat-bubble ai">
                  <div class="ai-chat-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            {error && <div class="ai-chat-error">{error}</div>}

            <div ref={bottomRef} />
          </div>

          <div class="ai-chat-input-bar">
            <textarea
              ref={inputRef}
              class="ai-chat-input"
              rows={1}
              placeholder="Ask Travis AI anything…"
              value={input}
              onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              class="ai-chat-send-btn"
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div class="ai-activity-container">
          <ActivityLog refreshKey={activityRefreshKey} />
        </div>
      )}

      {tab === "runs" && (
        <div class="ai-activity-container">
          <AgentRunsLog />
        </div>
      )}
    </div>
  );
}
