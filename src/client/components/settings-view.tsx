import { useEffect, useState } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import type { Settings, Subscription, AIStatus } from "../types";
import { Building2, Sparkles, Plug, CreditCard, Check, Calendar, Mail, PhoneCall, MessageSquare, Crown } from "lucide-preact";

const PROFILE_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "business_name", label: "Business name", placeholder: "Your company Ltd" },
  { key: "currency", label: "Currency", placeholder: "GBP" },
  { key: "default_tax_rate", label: "Default VAT rate (%)", placeholder: "20" },
  { key: "target_margin_pct", label: "Target margin (%)", placeholder: "35" },
  { key: "timezone", label: "Timezone", placeholder: "Europe/London" },
];

const INTEGRATIONS: { key: string; label: string; desc: string; icon: typeof Calendar }[] = [
  { key: "integ_calendar", label: "Calendar sync", desc: "Two-way sync with Google / Outlook calendars.", icon: Calendar },
  { key: "integ_email", label: "Email inbox", desc: "Connect a mailbox so Travis can summarise and reply.", icon: Mail },
  { key: "integ_phone", label: "Phone / Receptionist", desc: "Route inbound calls to the AI receptionist.", icon: PhoneCall },
  { key: "integ_sms", label: "SMS", desc: "Send reminders and confirmations by text.", icon: MessageSquare },
];

const ADDONS: { key: string; label: string; desc: string }[] = [
  { key: "addon_receptionist", label: "AI Receptionist", desc: "Premium call answering and routing." },
  { key: "addon_supplier_crawl", label: "Supplier price crawler", desc: "Automated supplier catalogue monitoring." },
  { key: "addon_inbox_ai", label: "Inbox AI replies", desc: "Auto-drafted email and SMS responses." },
];

const PLANS: { value: string; name: string; blurb: string }[] = [
  { value: "starter", name: "Starter", blurb: "Solo trades — scheduling & invoicing." },
  { value: "pro", name: "Pro", blurb: "Small teams — quotes, AI assistant & reports." },
  { value: "scale", name: "Scale", blurb: "Multi-crew — receptionist & all add-ons." },
];

export function SettingsView() {
  const { setError } = useApp();
  const [settings, setSettings] = useState<Settings>({});
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ settings: Settings }>("GET", "/api/settings"),
      api<{ subscription: Subscription | null }>("GET", "/api/subscription"),
      api<AIStatus>("GET", "/api/ai/status"),
    ]).then(([s, sub, ai]) => { setSettings(s.settings); setSubscription(sub.subscription); setAiStatus(ai); })
      .catch((err) => setError((err as Error).message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setVal = (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const toggle = (key: string) => {
    setVal(key, settings[key] === "1" ? "0" : "1");
  };

  const save = async () => {
    setSaving(true);
    try {
      await api("PUT", "/api/settings", settings);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="page">
      <div class="page-header">
        <h1>Settings</h1>
        <div class="page-header-right">
          {saved && <span class="saved-tag"><Check size={13} /> Saved</span>}
          <button class="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>

      <div class="settings-section card">
        <div class="settings-head"><Building2 size={16} /> <h2>Business profile</h2></div>
        <div class="settings-grid">
          {PROFILE_FIELDS.map((f) => (
            <label key={f.key} class="settings-field">
              <span class="settings-field-label">{f.label}</span>
              <input type="text" value={settings[f.key] || ""} placeholder={f.placeholder}
                onInput={(e) => setVal(f.key, (e.target as HTMLInputElement).value)} />
            </label>
          ))}
        </div>
      </div>

      <div class="settings-section card">
        <div class="settings-head"><Sparkles size={16} /> <h2>AI provider</h2></div>
        <div class="settings-row">
          <div>
            <div class="settings-row-title">OpenRouter</div>
            <div class="settings-row-desc">
              {aiStatus?.configured
                ? "A provider key is configured server-side. Live AI responses are enabled."
                : "No key configured — Travis runs in demo mode with mock responses."}
            </div>
          </div>
          <span class={`provider-badge ${aiStatus?.configured ? "live" : "mock"}`}>
            <span class="provider-dot" />{aiStatus?.configured ? "Live" : "Demo mode"}
          </span>
        </div>
        <label class="settings-field">
          <span class="settings-field-label">OpenRouter API key</span>
          <input type="password" value="" placeholder={aiStatus?.configured ? "•••••••• (set server-side)" : "Set OPENROUTER_API_KEY in server secrets"} disabled />
          <span class="settings-hint">The key is stored server-side only and never shown here.</span>
        </label>
        <label class="settings-field">
          <span class="settings-field-label">Model</span>
          <input type="text" value={settings.ai_model || ""} placeholder="openai/gpt-4o-mini"
            onInput={(e) => setVal("ai_model", (e.target as HTMLInputElement).value)} />
        </label>
      </div>

      <div class="settings-section card">
        <div class="settings-head"><Plug size={16} /> <h2>Integrations</h2><span class="provider-badge mock">Placeholder</span></div>
        <div class="settings-list">
          {INTEGRATIONS.map((i) => (
            <div key={i.key} class="settings-toggle-row">
              <div class="settings-toggle-icon"><i.icon size={15} /></div>
              <div class="settings-toggle-body">
                <div class="settings-row-title">{i.label}</div>
                <div class="settings-row-desc">{i.desc}</div>
              </div>
              <button class={`toggle ${settings[i.key] === "1" ? "on" : ""}`} onClick={() => toggle(i.key)} aria-pressed={settings[i.key] === "1"}>
                <span class="toggle-knob" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div class="settings-section card">
        <div class="settings-head"><CreditCard size={16} /> <h2>Subscription & add-ons</h2></div>
        {subscription && (
          <div class="settings-row">
            <div>
              <div class="settings-row-title">Current plan: <span class="plan-name">{subscription.plan}</span></div>
              <div class="settings-row-desc">
                Status: {subscription.status} · {subscription.seats} seats
                {subscription.renews_at ? ` · renews ${subscription.renews_at}` : ""}
              </div>
            </div>
            <span class="provider-badge live"><span class="provider-dot" />{subscription.status}</span>
          </div>
        )}
        <div class="plan-grid">
          {PLANS.map((p) => (
            <div key={p.value} class={`plan-card ${subscription?.plan === p.value ? "current" : ""}`}>
              <div class="plan-card-head">
                <span class="plan-card-name">{p.name}</span>
                {subscription?.plan === p.value && <span class="plan-current-tag"><Check size={11} /> Current</span>}
              </div>
              <div class="plan-card-blurb">{p.blurb}</div>
              <button class="btn btn-sm" disabled title="Plan changes are a placeholder in this demo">
                {subscription?.plan === p.value ? "Active" : "Choose"}
              </button>
            </div>
          ))}
        </div>
        <div class="settings-subhead"><Crown size={13} /> Premium add-ons</div>
        <div class="settings-list">
          {ADDONS.map((a) => (
            <div key={a.key} class="settings-toggle-row">
              <div class="settings-toggle-body">
                <div class="settings-row-title">{a.label}</div>
                <div class="settings-row-desc">{a.desc}</div>
              </div>
              <button class={`toggle ${settings[a.key] === "1" ? "on" : ""}`} onClick={() => toggle(a.key)} aria-pressed={settings[a.key] === "1"}>
                <span class="toggle-knob" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
