import { useEffect, useRef, useState } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import type { AIActivity, AIStatus } from "../types";
import { Sparkles, Send, Bot, User, FileSignature, FileText, PhoneCall, Lightbulb, CircleCheck, CircleDashed, CircleX, Hammer, ChevronDown, ChevronUp } from "lucide-preact";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  source?: "openrouter" | "mock";
}

interface BuildStep {
  step: number;
  title: string;
  detail: string;
  code?: string;
}

interface BuildResult {
  steps: BuildStep[];
  summary: string;
  source: "anthropic" | "mock";
  model: string;
}

const EXAMPLE_PROMPTS = [
  "Draft a quote for a combi boiler install",
  "What invoices are overdue this week?",
  "Summarise today's receptionist calls",
  "Which open quotes are below my target margin?",
];

const BUILD_EXAMPLES = [
  "Add a parts/materials inventory module with stock levels and reorder alerts",
  "Build a job scheduling calendar with engineer assignment and postcode routing",
  "Create a customer portal for viewing quotes and approving work",
  "Add a recurring maintenance contract feature with auto-invoice generation",
];

const ACTIVITY_ICONS: Record<AIActivity["kind"], typeof Sparkles> = {
  quote_draft: FileSignature,
  invoice_chase: FileText,
  call_summary: PhoneCall,
  insight: Lightbulb,
  assistant: Bot,
};

function relTime(iso: string): string {
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function BuildStepCard({ s }: { s: BuildStep }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="build-step">
      <button class="build-step-header" onClick={() => setOpen((v) => !v)}>
        <span class="build-step-num">{s.step}</span>
        <span class="build-step-title">{s.title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div class="build-step-body">
          <p>{s.detail}</p>
          {s.code && <pre class="build-step-code"><code>{s.code}</code></pre>}
        </div>
      )}
    </div>
  );
}

export function AIAssistant() {
  const { setError } = useApp();
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [activity, setActivity] = useState<AIActivity[]>([]);
  const [tab, setTab] = useState<"chat" | "build">("chat");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // Build state
  const [buildTask, setBuildTask] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);

  const loadActivity = async () => {
    try {
      const data = await api<{ activity: AIActivity[] }>("GET", "/api/ai/activity?limit=12");
      setActivity(data.activity);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    api<AIStatus & { claude?: boolean }>("GET", "/api/ai/status").then(setStatus).catch((err) => setError((err as Error).message));
    loadActivity();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (prompt: string) => {
    const text = prompt.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await api<{ reply: string; source: "openrouter" | "mock"; model: string }>(
        "POST", "/api/ai/assistant", { prompt: text }
      );
      setMessages((m) => [...m, { role: "assistant", content: res.reply, source: res.source }]);
      loadActivity();
    } catch (err) {
      setError((err as Error).message);
      setMessages((m) => [...m, { role: "assistant", content: `I couldn't complete that request: ${(err as Error).message}`, source: undefined }]);
    } finally {
      setSending(false);
    }
  };

  const runBuild = async (task: string) => {
    const text = task.trim();
    if (!text || building) return;
    setBuildTask(text);
    setBuilding(true);
    setBuildResult(null);
    try {
      const res = await api<BuildResult>("POST", "/api/ai/build", { task: text });
      setBuildResult(res);
      loadActivity();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div class="page">
      <div class="page-header">
        <h1>AI Assistant</h1>
        <div class="page-header-right">
          {status && (
            <span class={`provider-badge ${status.configured ? "live" : "mock"}`}>
              <span class="provider-dot" />
              {status.configured ? "Live · OpenRouter" : "Demo mode · mock responses"}
            </span>
          )}
        </div>
      </div>

      <div class="assistant-tabs">
        <button class={`assistant-tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
          <Bot size={14} /> Chat
        </button>
        <button class={`assistant-tab ${tab === "build" ? "active" : ""}`} onClick={() => setTab("build")}>
          <Hammer size={14} /> Autonomous Builder
        </button>
      </div>

      <div class="assistant-layout">
        {tab === "chat" ? (
          <div class="assistant-main card">
            <div class="assistant-thread" ref={threadRef}>
              {messages.length === 0 ? (
                <div class="assistant-welcome">
                  <div class="assistant-welcome-icon"><Sparkles size={26} /></div>
                  <h2>Meet Travis</h2>
                  <p class="text-muted">Your AI co-worker. Ask about quotes, invoices, scheduling and calls — answers are logged to the activity feed.</p>
                  <div class="assistant-examples">
                    {EXAMPLE_PROMPTS.map((p) => (
                      <button key={p} class="assistant-example" onClick={() => send(p)}>{p}</button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} class={`chat-msg ${m.role}`}>
                    <div class="chat-avatar">{m.role === "user" ? <User size={15} /> : <Bot size={15} />}</div>
                    <div class="chat-bubble">
                      <div class="chat-text">{m.content}</div>
                      {m.role === "assistant" && m.source && (
                        <div class="chat-source">{m.source === "openrouter" ? "OpenRouter" : "Demo response"}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div class="chat-msg assistant">
                  <div class="chat-avatar"><Bot size={15} /></div>
                  <div class="chat-bubble"><div class="chat-typing"><span /><span /><span /></div></div>
                </div>
              )}
            </div>
            <form
              class="assistant-input"
              onSubmit={(e) => { e.preventDefault(); send(input); }}
            >
              <input
                type="text"
                placeholder="Ask Travis anything…"
                value={input}
                onInput={(e) => setInput((e.target as HTMLInputElement).value)}
                disabled={sending}
              />
              <button type="submit" class="btn btn-primary" disabled={sending || !input.trim()}>
                <Send size={14} /> Send
              </button>
            </form>
          </div>
        ) : (
          <div class="assistant-main card">
            <div class="build-intro">
              <div class="assistant-welcome-icon"><Hammer size={22} /></div>
              <h3>Autonomous Builder</h3>
              <p class="text-muted">Describe a feature or module and Claude (claude-opus-4-8) will produce a step-by-step implementation plan tailored to this stack.</p>
            </div>

            {!buildResult && !building && (
              <div class="assistant-examples" style={{ marginBottom: 16 }}>
                {BUILD_EXAMPLES.map((p) => (
                  <button key={p} class="assistant-example" onClick={() => runBuild(p)}>{p}</button>
                ))}
              </div>
            )}

            <form
              class="assistant-input"
              onSubmit={(e) => { e.preventDefault(); runBuild(buildTask); }}
            >
              <input
                type="text"
                placeholder="Describe a feature to build…"
                value={buildTask}
                onInput={(e) => setBuildTask((e.target as HTMLInputElement).value)}
                disabled={building}
              />
              <button type="submit" class="btn btn-primary" disabled={building || !buildTask.trim()}>
                {building ? <><CircleDashed size={14} /> Building…</> : <><Hammer size={14} /> Build</>}
              </button>
            </form>

            {building && (
              <div class="build-loading">
                <div class="chat-typing" style={{ margin: "0 auto" }}><span /><span /><span /></div>
                <p class="text-muted" style={{ marginTop: 8, fontSize: 13 }}>Claude is planning the implementation…</p>
              </div>
            )}

            {buildResult && (
              <div class="build-result">
                <div class="build-summary">
                  <CircleCheck size={15} style={{ color: "var(--color-green-600, #16a34a)" }} />
                  <span>{buildResult.summary}</span>
                  <span class="chat-source" style={{ marginLeft: "auto" }}>
                    {buildResult.source === "anthropic" ? `Claude · ${buildResult.model}` : "Demo plan"}
                  </span>
                </div>
                <div class="build-steps">
                  {buildResult.steps.map((s) => <BuildStepCard key={s.step} s={s} />)}
                </div>
                <button class="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => { setBuildResult(null); setBuildTask(""); }}>
                  Plan another feature
                </button>
              </div>
            )}
          </div>
        )}

        <div class="assistant-side">
          <div class="detail-sidebar-section">
            <h4>Recent AI Activity</h4>
            {activity.length === 0 ? (
              <p class="text-muted" style={{ fontSize: 13 }}>No activity yet</p>
            ) : (
              <div class="activity-list">
                {activity.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.kind] || Bot;
                  return (
                    <div key={a.id} class="activity-item">
                      <div class="activity-icon"><Icon size={14} /></div>
                      <div class="activity-body">
                        <div class="activity-title">{a.title}</div>
                        <div class="activity-detail">{a.detail}</div>
                        <div class="activity-foot">
                          <span class={`activity-status ${a.status}`}>
                            {a.status === "completed" ? <CircleCheck size={11} /> : a.status === "pending" ? <CircleDashed size={11} /> : <CircleX size={11} />}
                            {a.status}
                          </span>
                          <span class="activity-time">{relTime(a.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
