import { useEffect, useState } from "preact/hooks";
import type { Settings, Subscription } from "../types";
import { Save, Building2, SlidersHorizontal, CreditCard, CheckCircle, ExternalLink, Zap, Calendar, Link2, Link2Off, KeyRound, AtSign, Bot, Users, UserPlus, Trash2, RefreshCw } from "lucide-preact";
import { api } from "../api";
import { daysUntil } from "../components/trial-warning-banner";

const AI_MODEL_TIERS = [
  {
    label: "Fast & Cheap",
    models: [
      { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku" },
      { id: "google/gemini-flash-1.5", name: "Gemini Flash 1.5" },
      { id: "google/gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
      { id: "mistral/mistral-small", name: "Mistral Small" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
    ],
  },
  {
    label: "Balanced",
    models: [
      { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku" },
    ],
  },
];

export function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ configured: boolean; key_valid: boolean | null; missing: string[] } | null>(null);
  const [stripeChecking, setStripeChecking] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState("");
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalError, setGcalError] = useState<string | null>(null);
  const [gcalSuccess, setGcalSuccess] = useState(false);
  const [gcalCalendars, setGcalCalendars] = useState<{ id: string; summary: string; primary: boolean }[]>([]);
  const [gcalCalendarId, setGcalCalendarId] = useState("primary");
  const [gcalCalLoading, setGcalCalLoading] = useState(false);
  const [gcalCalSaved, setGcalCalSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [updatedEmail, setUpdatedEmail] = useState("");
  const [resetTargetEmail, setResetTargetEmail] = useState("");
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [resetLinkLoading, setResetLinkLoading] = useState(false);
  const [resetLinkError, setResetLinkError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [checkoutCancelled, setCheckoutCancelled] = useState(false);
  const [aiModel, setAiModel] = useState("anthropic/claude-3-haiku");
  const [aiModelSaving, setAiModelSaving] = useState(false);
  const [aiModelSaved, setAiModelSaved] = useState(false);
  const [aiModelError, setAiModelError] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<{ id: number; email: string; role: string; created_at: string }[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"owner" | "tech">("tech");
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSuccess, setAddUserSuccess] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [userResetLinks, setUserResetLinks] = useState<Record<number, string>>({});
  const [userResetErrors, setUserResetErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    // Parse current user ID from JWT so we can prevent self-deletion
    const token = localStorage.getItem("travis_token") ?? "";
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload.sub) setCurrentUserId(Number(payload.sub));
      } catch { /* ignore */ }
    }

    Promise.all([
      api<{ settings: Settings }>("GET", "/api/settings"),
      api<{ subscription: Subscription }>("GET", "/api/subscription"),
      api<{ connected: boolean; email: string; calendar_id: string }>("GET", "/api/integrations/google/status"),
      api<{ configured: boolean; key_valid: boolean | null; missing: string[] }>("GET", "/api/billing/status"),
      api<{ model: string }>("GET", "/api/settings/ai-model"),
    ]).then(([s, b, g, stripe, aiM]) => {
      setSettings(s.settings);
      setSub(b.subscription);
      setGcalConnected(g.connected);
      setGcalEmail(g.email);
      setGcalCalendarId(g.calendar_id || "primary");
      if (g.connected) loadCalendars();
      setStripeStatus(stripe);
      setAiModel(aiM.model);
    }).catch((e) => setError((e as Error).message));

    api<{ users: { id: number; email: string; role: string; created_at: string }[] }>("GET", "/api/users")
      .then((r) => setTeamUsers(r.users))
      .catch(() => { /* non-owner users won't have access — silently skip */ });
    // Check for OAuth callback result in URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal_connected") === "1") {
      setGcalSuccess(true);
      window.history.replaceState({}, "", "/settings");
      api<{ connected: boolean; email: string; calendar_id: string }>("GET", "/api/integrations/google/status")
        .then((g) => {
          setGcalConnected(g.connected);
          setGcalEmail(g.email);
          setGcalCalendarId(g.calendar_id || "primary");
          if (g.connected) loadCalendars();
        })
        .catch(() => {});
    } else if (params.get("gcal_error")) {
      setGcalError(`Google Calendar connection failed: ${params.get("gcal_error")}`);
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("checkout") === "success") {
      const plan = params.get("plan");
      const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "your new plan";
      setCheckoutSuccess(`Your subscription is now active — welcome to ${planLabel}!`);
      window.history.replaceState({}, "", "/settings");
      api<{ subscription: Subscription }>("GET", "/api/subscription")
        .then((b) => setSub(b.subscription))
        .catch(() => {});
      setTimeout(() => setCheckoutSuccess(null), 6000);
    } else if (params.get("checkout") === "cancelled") {
      setCheckoutCancelled(true);
      window.history.replaceState({}, "", "/settings");
      setTimeout(() => setCheckoutCancelled(false), 5000);
    }
  }, []);

  const update = (field: keyof Settings, value: string | number) => {
    setSettings((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      await api<{ ok: boolean }>("PUT", "/api/settings", {
        company_name: settings.company_name,
        company_phone: settings.company_phone,
        company_email: settings.company_email,
        company_address: settings.company_address,
        company_logo_url: settings.company_logo_url,
        tax_rate: settings.tax_rate,
        currency: settings.currency,
        timezone: settings.timezone,
        invoice_prefix: settings.invoice_prefix,
        job_prefix: settings.job_prefix,
        quote_prefix: settings.quote_prefix,
        inbox_agent_interval_hours: settings.inbox_agent_interval_hours,
        from_email: settings.from_email,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async (plan: "starter" | "pro") => {
    setBillingLoading(plan);
    setBillingError(null);
    try {
      const { url } = await api<{ url: string }>("POST", "/api/billing/checkout", {
        plan,
        success_url: window.location.origin + `/settings?checkout=success&plan=${plan}`,
        cancel_url: window.location.origin + "/settings?checkout=cancelled",
      });
      window.location.href = url;
    } catch (e) {
      setBillingError((e as Error).message);
    } finally {
      setBillingLoading(null);
    }
  };

  const handleSwitchPlan = async (plan: "starter" | "pro") => {
    setBillingLoading(`switch-${plan}`);
    setBillingError(null);
    try {
      const { subscription } = await api<{ subscription: Subscription }>("POST", "/api/billing/switch-plan", { plan });
      setSub(subscription);
      const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
      setCheckoutSuccess(`Your plan is now ${planLabel}.`);
    } catch (e) {
      setBillingError((e as Error).message);
    } finally {
      setBillingLoading(null);
    }
  };

  const loadCalendars = async () => {
    setGcalCalLoading(true);
    try {
      const res = await api<{ calendars: { id: string; summary: string; primary: boolean }[]; selected: string }>(
        "GET", "/api/integrations/google/calendars"
      );
      setGcalCalendars(res.calendars);
      setGcalCalendarId(res.selected || "primary");
    } catch {
      /* non-fatal — picker just won't show */
    } finally {
      setGcalCalLoading(false);
    }
  };

  const handleSelectCalendar = async (calendarId: string) => {
    setGcalCalendarId(calendarId);
    setGcalCalSaved(false);
    setGcalError(null);
    try {
      await api<{ ok: boolean }>("PUT", "/api/integrations/google/calendar", { calendar_id: calendarId });
      setGcalCalSaved(true);
      setTimeout(() => setGcalCalSaved(false), 3000);
    } catch (e) {
      setGcalError((e as Error).message);
    }
  };

  const handleConnectGoogle = async () => {
    setGcalLoading(true);
    setGcalError(null);
    try {
      const { url } = await api<{ url: string }>("GET", "/api/integrations/google/auth-url");
      window.location.href = url;
    } catch (e) {
      setGcalError((e as Error).message);
      setGcalLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setGcalLoading(true);
    setGcalError(null);
    try {
      await api<{ ok: boolean }>("DELETE", "/api/integrations/google");
      setGcalConnected(false);
      setGcalEmail("");
      setGcalCalendars([]);
      setGcalCalendarId("primary");
    } catch (e) {
      setGcalError((e as Error).message);
    } finally {
      setGcalLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading("portal");
    setBillingError(null);
    try {
      const { url } = await api<{ url: string }>("POST", "/api/billing/portal", {
        return_url: window.location.origin + "/settings",
      });
      window.location.href = url;
    } catch (e) {
      setBillingError((e as Error).message);
    } finally {
      setBillingLoading(null);
    }
  };

  const recheckStripeStatus = async () => {
    setStripeChecking(true);
    try {
      const stripe = await api<{ configured: boolean; key_valid: boolean | null; missing: string[] }>("GET", "/api/billing/status");
      setStripeStatus(stripe);
    } catch {
    } finally {
      setStripeChecking(false);
    }
  };

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    setPwLoading(true);
    try {
      await api<{ ok: boolean }>("POST", "/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError((err as Error).message);
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangeEmail = async (e: Event) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(false);
    if (!newEmail.trim()) {
      setEmailError("Please enter a new email address.");
      return;
    }
    setEmailLoading(true);
    try {
      const confirmed = newEmail.trim().toLowerCase();
      const res = await api<{ ok: boolean; token: string }>("POST", "/api/auth/change-email", {
        new_email: confirmed,
        current_password: emailCurrentPassword,
      });
      localStorage.setItem("travis_token", res.token);
      setUpdatedEmail(confirmed);
      setEmailSuccess(true);
      setNewEmail("");
      setEmailCurrentPassword("");
      setTimeout(() => setEmailSuccess(false), 4000);
    } catch (err) {
      setEmailError((err as Error).message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSaveAIModel = async () => {
    setAiModelSaving(true);
    setAiModelError(null);
    setAiModelSaved(false);
    try {
      await api<{ ok: boolean }>("PUT", "/api/settings/ai-model", { model: aiModel });
      setAiModelSaved(true);
      setTimeout(() => setAiModelSaved(false), 3000);
    } catch (e) {
      setAiModelError((e as Error).message);
    } finally {
      setAiModelSaving(false);
    }
  };

  const handleAddUser = async (e: Event) => {
    e.preventDefault();
    setAddUserError(null);
    setAddUserSuccess(false);
    setAddUserLoading(true);
    try {
      const created = await api<{ id: number; email: string; role: string; created_at: string }>(
        "POST", "/api/users", { email: newUserEmail.trim(), password: newUserPassword, role: newUserRole }
      );
      setTeamUsers((prev) => [...prev, created]);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("tech");
      setAddUserSuccess(true);
      setTimeout(() => setAddUserSuccess(false), 3000);
    } catch (err) {
      setAddUserError((err as Error).message);
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    setTeamError(null);
    setTeamLoading(true);
    setDeletingUserId(id);
    try {
      await api<{ ok: boolean }>("DELETE", `/api/users/${id}`);
      setTeamUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setTeamError((err as Error).message);
    } finally {
      setTeamLoading(false);
      setDeletingUserId(null);
    }
  };

  const handleUserPasswordReset = async (userId: number, email: string) => {
    setResettingUserId(userId);
    setUserResetErrors((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    setUserResetLinks((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    try {
      const res = await api<{ ok: boolean; reset_link: string }>("POST", "/api/auth/admin-reset", { email });
      setUserResetLinks((prev) => ({ ...prev, [userId]: res.reset_link }));
    } catch (err) {
      setUserResetErrors((prev) => ({ ...prev, [userId]: (err as Error).message }));
    } finally {
      setResettingUserId(null);
    }
  };

  const handleGenerateResetLink = async () => {
    setResetLinkLoading(true);
    setResetLinkError(null);
    setResetLinkSent(false);
    try {
      const body = resetTargetEmail.trim() ? { email: resetTargetEmail.trim() } : {};
      await api<{ ok: boolean }>("POST", "/api/auth/admin-reset", body);
      setResetLinkSent(true);
    } catch (err) {
      setResetLinkError((err as Error).message);
    } finally {
      setResetLinkLoading(false);
    }
  };

  if (!settings) {
    return <div class="loading-text">{error ? `Error: ${error}` : "Loading settings…"}</div>;
  }

  return (
    <div class="settings-view">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Company profile and business configuration</p>
        </div>
        <div class="page-header-right">
          <button
            class={`btn btn-primary${saving ? " btn-loading" : ""}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saved ? "Saved" : saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div class="settings-error">{error}</div>
      )}

      {checkoutSuccess && (
        <div class="settings-success">{checkoutSuccess}</div>
      )}

      {checkoutCancelled && (
        <div class="settings-info">Checkout cancelled — no changes were made.</div>
      )}

      {saved && (
        <div class="settings-success">Settings saved successfully.</div>
      )}

      <div class="settings-sections">
        <section class="settings-section">
          <div class="settings-section-header">
            <Building2 size={16} />
            <h2>Company Profile</h2>
          </div>
          <div class="settings-fields">
            <div class="form-group full-width">
              <label>Business Name</label>
              <input
                type="text"
                value={settings.company_name}
                onInput={(e) => update("company_name", (e.target as HTMLInputElement).value)}
                placeholder="My Business"
              />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={settings.company_phone}
                onInput={(e) => update("company_phone", (e.target as HTMLInputElement).value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input
                type="email"
                value={settings.company_email}
                onInput={(e) => update("company_email", (e.target as HTMLInputElement).value)}
                placeholder="hello@mybusiness.com"
              />
            </div>
            <div class="form-group full-width">
              <label>Address</label>
              <input
                type="text"
                value={settings.company_address}
                onInput={(e) => update("company_address", (e.target as HTMLInputElement).value)}
                placeholder="123 Main St, City, State 12345"
              />
            </div>
            <div class="form-group full-width">
              <label>Logo URL</label>
              <input
                type="url"
                value={settings.company_logo_url}
                onInput={(e) => update("company_logo_url", (e.target as HTMLInputElement).value)}
                placeholder="https://example.com/logo.png"
              />
              <p class="settings-field-hint">
                Paste a publicly accessible image URL. The logo will appear at the top-left of printed quotes.
                Leave blank to show the business name instead.
              </p>
              {settings.company_logo_url && (
                <img
                  src={settings.company_logo_url}
                  alt="Logo preview"
                  style={{ maxHeight: "60px", maxWidth: "200px", marginTop: "8px", borderRadius: "4px", border: "1px solid var(--color-border, #e2e8f0)", padding: "4px", background: "#fff" }}
                />
              )}
            </div>
            <div class="form-group full-width">
              <label>Email sender address</label>
              <input
                type="email"
                value={settings.from_email}
                onInput={(e) => update("from_email", (e.target as HTMLInputElement).value)}
                placeholder="noreply@yourdomain.com"
              />
              <p class="settings-field-hint">
                Used as the "From" address for password reset emails. Must be a domain verified in Resend.
                Falls back to the <code>FROM_EMAIL</code> Worker secret if left blank.
              </p>
            </div>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <SlidersHorizontal size={16} />
            <h2>Business Configuration</h2>
          </div>
          <div class="settings-fields">
            <div class="form-group">
              <label>Default Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.tax_rate}
                onInput={(e) => update("tax_rate", parseFloat((e.target as HTMLInputElement).value) || 0)}
              />
            </div>
            <div class="form-group">
              <label>Currency</label>
              <select
                value={settings.currency}
                onChange={(e) => update("currency", (e.target as HTMLSelectElement).value)}
              >
                <option value="AUD">AUD — Australian Dollar</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="NZD">NZD — New Zealand Dollar</option>
              </select>
            </div>
            <div class="form-group full-width">
              <label>Timezone</label>
              <select
                value={settings.timezone}
                onChange={(e) => update("timezone", (e.target as HTMLSelectElement).value)}
              >
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                <option value="Australia/Melbourne">Australia/Melbourne (AEST)</option>
                <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                <option value="Australia/Perth">Australia/Perth (AWST)</option>
                <option value="Australia/Adelaide">Australia/Adelaide (ACST)</option>
                <option value="Pacific/Auckland">Pacific/Auckland (NZST)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Chicago">America/Chicago (CST)</option>
                <option value="America/Denver">America/Denver (MST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
          </div>

          <div class="settings-subsection-title">Inbox Agent</div>
          <p class="settings-hint">How often the inbox organiser runs automatically in the background.</p>
          <div class="settings-fields">
            <div class="form-group">
              <label>Run every</label>
              <select
                value={String(settings.inbox_agent_interval_hours ?? 1)}
                onChange={(e) => update("inbox_agent_interval_hours", parseFloat((e.target as HTMLSelectElement).value))}
              >
                <option value="1">1 hour</option>
                <option value="6">6 hours</option>
                <option value="24">24 hours (daily)</option>
              </select>
            </div>
          </div>

          <div class="settings-subsection-title">Identifier Prefixes</div>
          <p class="settings-hint">These prefixes appear before the number on jobs, invoices, and quotes (e.g. JOB-1, INV-5, QUO-3).</p>
          <div class="settings-fields">
            <div class="form-group">
              <label>Job Prefix</label>
              <input
                type="text"
                maxLength={10}
                value={settings.job_prefix}
                onInput={(e) => update("job_prefix", (e.target as HTMLInputElement).value.toUpperCase())}
                placeholder="JOB"
              />
            </div>
            <div class="form-group">
              <label>Invoice Prefix</label>
              <input
                type="text"
                maxLength={10}
                value={settings.invoice_prefix}
                onInput={(e) => update("invoice_prefix", (e.target as HTMLInputElement).value.toUpperCase())}
                placeholder="INV"
              />
            </div>
            <div class="form-group">
              <label>Quote Prefix</label>
              <input
                type="text"
                maxLength={10}
                value={settings.quote_prefix}
                onInput={(e) => update("quote_prefix", (e.target as HTMLInputElement).value.toUpperCase())}
                placeholder="QUO"
              />
            </div>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <Bot size={16} />
            <h2>AI Model</h2>
          </div>
          <p class="settings-hint">Choose which AI model Travis uses for all AI features — chat, quote drafts, and inbox summaries. Changes take effect immediately.</p>
          <div class="settings-fields">
            <div class="form-group full-width">
              <label>Active model</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel((e.target as HTMLSelectElement).value)}
              >
                {AI_MODEL_TIERS.map((tier) => (
                  <optgroup key={tier.label} label={tier.label}>
                    {tier.models.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div class="form-group full-width">
              {aiModelError && <p class="settings-billing-error">{aiModelError}</p>}
              {aiModelSaved && (
                <p style="color:var(--success);font-size:0.85rem;margin:0.25rem 0 0">AI model updated.</p>
              )}
              <div class="settings-billing-actions">
                <button
                  class={`btn btn-primary${aiModelSaving ? " btn-loading" : ""}`}
                  onClick={handleSaveAIModel}
                  disabled={aiModelSaving}
                >
                  <Save size={13} />
                  {aiModelSaving ? "Saving…" : "Save AI Model"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {sub && (
          <section class="settings-section">
            <div class="settings-section-header">
              <CreditCard size={16} />
              <h2>Subscription</h2>
            </div>
            <div class="settings-billing-card">
              <div class="settings-billing-row">
                <span class="settings-billing-label">Plan</span>
                <span class={`settings-plan-badge settings-plan-${sub.plan}`}>
                  {sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}
                </span>
              </div>
              <div class="settings-billing-row">
                <span class="settings-billing-label">Status</span>
                <span class={`settings-status-badge settings-status-${sub.status}`}>
                  {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                </span>
              </div>
              {sub.trial_ends_at && (() => {
                const days = daysUntil(sub.trial_ends_at!);
                const urgent = days >= 0 && days <= 3;
                const label =
                  days === 0
                    ? "Expires today"
                    : days === 1
                    ? "1 day left"
                    : `${days} days left`;
                return (
                  <>
                    <div class="settings-billing-row">
                      <span class="settings-billing-label">Trial ends</span>
                      <span class="settings-billing-value">{sub.trial_ends_at}</span>
                    </div>
                    {urgent && (
                      <div class="settings-trial-expiry-warning">
                        <span>{label} on your trial — upgrade to keep access.</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {sub.renewal_date && (
                <div class="settings-billing-row">
                  <span class="settings-billing-label">Renewal date</span>
                  <span class="settings-billing-value">{sub.renewal_date}</span>
                </div>
              )}
              {stripeStatus && stripeStatus.configured && stripeStatus.key_valid === true && (
                <div class="settings-stripe-connected">
                  <CheckCircle size={14} />
                  <span>Stripe connected</span>
                  <button
                    class={`btn btn-ghost settings-stripe-recheck${stripeChecking ? " btn-loading" : ""}`}
                    onClick={recheckStripeStatus}
                    disabled={stripeChecking}
                    title="Re-check Stripe connection"
                  >
                    <RefreshCw size={13} />
                    {stripeChecking ? "Checking…" : "Re-check"}
                  </button>
                </div>
              )}
              {stripeStatus && stripeStatus.configured && stripeStatus.key_valid === false && (
                <div class="settings-stripe-notice">
                  <p class="settings-stripe-notice-title">Stripe key invalid</p>
                  <p class="settings-stripe-notice-text">
                    All secrets are set but the Stripe API rejected the key. Verify that
                    <code>STRIPE_SECRET_KEY</code> is correct in your Cloudflare Worker secrets.
                  </p>
                  <button
                    class={`btn btn-secondary${stripeChecking ? " btn-loading" : ""}`}
                    onClick={recheckStripeStatus}
                    disabled={stripeChecking}
                  >
                    <RefreshCw size={13} />
                    {stripeChecking ? "Checking…" : "Re-check"}
                  </button>
                </div>
              )}
              {stripeStatus && !stripeStatus.configured && (
                <div class="settings-stripe-notice">
                  <p class="settings-stripe-notice-title">Stripe is not connected</p>
                  <p class="settings-stripe-notice-text">
                    Upgrade and Manage Billing are disabled until Stripe is connected.
                    Create your Starter and Pro products in the Stripe Dashboard, add a
                    webhook, then set the required Cloudflare Worker secrets. Full steps
                    are in <code>STRIPE_SETUP.md</code>.
                  </p>
                  {stripeStatus.missing.length > 0 && (
                    <p class="settings-stripe-notice-text">
                      Missing:{" "}
                      {stripeStatus.missing.map((k, i) => (
                        <><code key={k}>{k}</code>{i < stripeStatus.missing.length - 1 ? ", " : ""}</>
                      ))}
                    </p>
                  )}
                  <div class="settings-stripe-notice-actions">
                    <a
                      class="btn btn-secondary"
                      href="https://dashboard.stripe.com/products"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={13} />
                      Open Stripe Dashboard
                    </a>
                    <button
                      class={`btn btn-secondary${stripeChecking ? " btn-loading" : ""}`}
                      onClick={recheckStripeStatus}
                      disabled={stripeChecking}
                    >
                      <RefreshCw size={13} />
                      {stripeChecking ? "Checking…" : "Re-check"}
                    </button>
                  </div>
                </div>
              )}
              {billingError && (
                <p class="settings-billing-error">{billingError}</p>
              )}
              <div class="settings-billing-actions">
                {(sub.plan === "trial" || sub.status !== "active") && (
                  <>
                    <button
                      class={`btn btn-secondary${billingLoading === "starter" ? " btn-loading" : ""}`}
                      onClick={() => handleUpgrade("starter")}
                      disabled={billingLoading !== null || !stripeStatus?.configured || stripeStatus?.key_valid === false}
                    >
                      <Zap size={13} />
                      {billingLoading === "starter" ? "Redirecting…" : "Upgrade to Starter"}
                    </button>
                    <button
                      class={`btn btn-primary${billingLoading === "pro" ? " btn-loading" : ""}`}
                      onClick={() => handleUpgrade("pro")}
                      disabled={billingLoading !== null || !stripeStatus?.configured || stripeStatus?.key_valid === false}
                    >
                      <Zap size={13} />
                      {billingLoading === "pro" ? "Redirecting…" : "Upgrade to Pro"}
                    </button>
                  </>
                )}
                {sub.status === "active" && (sub.plan === "starter" || sub.plan === "pro") && (
                  <button
                    class={`btn btn-primary${billingLoading === (sub.plan === "starter" ? "switch-pro" : "switch-starter") ? " btn-loading" : ""}`}
                    onClick={() => handleSwitchPlan(sub.plan === "starter" ? "pro" : "starter")}
                    disabled={billingLoading !== null || sub.stripe_configured === false}
                  >
                    <Zap size={13} />
                    {billingLoading === (sub.plan === "starter" ? "switch-pro" : "switch-starter")
                      ? "Switching…"
                      : sub.plan === "starter" ? "Switch to Pro" : "Switch to Starter"}
                  </button>
                )}
                {sub.stripe_customer_id && (
                  <button
                    class={`btn btn-secondary${billingLoading === "portal" ? " btn-loading" : ""}`}
                    onClick={handleManageBilling}
                    disabled={billingLoading !== null || !stripeStatus?.configured || stripeStatus?.key_valid === false}
                  >
                    <ExternalLink size={13} />
                    {billingLoading === "portal" ? "Redirecting…" : "Manage Billing"}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <section class="settings-section">
          <div class="settings-section-header">
            <Calendar size={16} />
            <h2>Integrations</h2>
          </div>
          <div class="settings-billing-card">
            <div class="settings-billing-row">
              <span class="settings-billing-label">Google Calendar</span>
              {gcalConnected ? (
                <span class="settings-status-badge settings-status-active">Connected</span>
              ) : (
                <span class="settings-status-badge settings-status-cancelled">Not connected</span>
              )}
            </div>
            {gcalConnected && gcalEmail && (
              <div class="settings-billing-row">
                <span class="settings-billing-label">Account</span>
                <span class="settings-billing-value">{gcalEmail}</span>
              </div>
            )}
            {gcalConnected && (
              <div class="settings-billing-row" style="flex-direction:column;align-items:stretch;gap:0.4rem">
                <div class="form-group">
                  <label>Sync jobs to calendar</label>
                  <select
                    value={gcalCalendarId}
                    disabled={gcalCalLoading || gcalCalendars.length === 0}
                    onChange={(e) => handleSelectCalendar((e.target as HTMLSelectElement).value)}
                  >
                    {gcalCalLoading && gcalCalendars.length === 0 && (
                      <option value={gcalCalendarId}>Loading calendars…</option>
                    )}
                    {gcalCalendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.summary}{cal.primary ? " (primary)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {gcalCalSaved && (
                  <span style="color:var(--success);font-size:0.8rem">Calendar updated.</span>
                )}
              </div>
            )}
            {gcalConnected && (
              <div class="settings-billing-row">
                <span class="settings-billing-label" style="font-size:0.8rem;color:var(--text-muted)">
                  Jobs are synced automatically when created, updated, or deleted.
                </span>
              </div>
            )}
            {gcalError && <p class="settings-billing-error">{gcalError}</p>}
            {gcalSuccess && (
              <p style="color:var(--success);font-size:0.85rem;margin:0.25rem 0 0">
                Google Calendar connected successfully.
              </p>
            )}
            <div class="settings-billing-actions">
              {gcalConnected ? (
                <button
                  class={`btn btn-secondary${gcalLoading ? " btn-loading" : ""}`}
                  onClick={handleDisconnectGoogle}
                  disabled={gcalLoading}
                >
                  <Link2Off size={13} />
                  {gcalLoading ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : (
                <button
                  class={`btn btn-secondary${gcalLoading ? " btn-loading" : ""}`}
                  onClick={handleConnectGoogle}
                  disabled={gcalLoading}
                >
                  <Link2 size={13} />
                  {gcalLoading ? "Redirecting…" : "Connect Google Calendar"}
                </button>
              )}
            </div>
          </div>
        </section>

        {teamUsers.length > 0 && (
          <section class="settings-section">
            <div class="settings-section-header">
              <Users size={16} />
              <h2>Team</h2>
            </div>
            <p class="settings-hint">Manage who can log in to Travis. Only owners can add or remove accounts.</p>
            <div class="settings-billing-card">
              {teamUsers.map((u) => (
                <div key={u.id}>
                  <div class="settings-billing-row" style="gap:0.5rem">
                    <span class="settings-billing-value" style="flex:1;word-break:break-all">{u.email}</span>
                    <span class={`settings-plan-badge settings-plan-${u.role === "owner" ? "pro" : "starter"}`} style="text-transform:capitalize">{u.role}</span>
                    <button
                      class={`btn btn-secondary${resettingUserId === u.id ? " btn-loading" : ""}`}
                      title={`Send password reset link for ${u.email}`}
                      disabled={resettingUserId === u.id}
                      onClick={() => handleUserPasswordReset(u.id, u.email)}
                      style="padding:4px 8px;min-width:unset;font-size:0.78rem"
                    >
                      <RefreshCw size={12} />
                      {resettingUserId === u.id ? "Sending…" : "Reset password"}
                    </button>
                    <button
                      class="btn btn-icon btn-danger-ghost"
                      title={u.id === currentUserId ? "Cannot remove your own account" : `Remove ${u.email}`}
                      disabled={u.id === currentUserId || (teamLoading && deletingUserId === u.id)}
                      onClick={() => handleDeleteUser(u.id)}
                      style="padding:4px 6px;min-width:unset"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {userResetErrors[u.id] && (
                    <p class="settings-billing-error" style="margin:4px 0 0;font-size:0.8rem">{userResetErrors[u.id]}</p>
                  )}
                  {userResetLinks[u.id] && (
                    <div style="margin:6px 0 4px;padding:6px 8px;background:var(--surface-2,#1e2430);border-radius:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                      <span style="font-size:0.75rem;color:var(--text-muted)">Reset link (share with staff):</span>
                      <code style="font-size:0.72rem;word-break:break-all;flex:1;color:var(--text-secondary)">{userResetLinks[u.id]}</code>
                      <button
                        class="btn btn-icon"
                        style="padding:2px 6px;min-width:unset;font-size:0.72rem"
                        onClick={() => navigator.clipboard.writeText(userResetLinks[u.id])}
                        title="Copy link"
                      >Copy</button>
                    </div>
                  )}
                </div>
              ))}
              {teamError && <p class="settings-billing-error">{teamError}</p>}
            </div>

            <div class="settings-subsection-title" style="margin-top:1rem">Add staff login</div>
            <form class="settings-fields" onSubmit={handleAddUser}>
              <div class="form-group">
                <label>Email</label>
                <input
                  type="email"
                  autocomplete="off"
                  value={newUserEmail}
                  onInput={(e) => setNewUserEmail((e.target as HTMLInputElement).value)}
                  placeholder="staff@example.com"
                  required
                />
              </div>
              <div class="form-group">
                <label>Initial password</label>
                <input
                  type="password"
                  autocomplete="new-password"
                  value={newUserPassword}
                  onInput={(e) => setNewUserPassword((e.target as HTMLInputElement).value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
              <div class="form-group">
                <label>Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole((e.target as HTMLSelectElement).value as "owner" | "tech")}
                >
                  <option value="tech">Tech (field staff)</option>
                  <option value="owner">Owner (full access)</option>
                </select>
              </div>
              <div class="form-group full-width">
                {addUserError && <p class="settings-billing-error">{addUserError}</p>}
                {addUserSuccess && (
                  <p style="color:var(--success);font-size:0.85rem;margin:0.25rem 0 0">Staff login created.</p>
                )}
                <div class="settings-billing-actions">
                  <button
                    type="submit"
                    class={`btn btn-primary${addUserLoading ? " btn-loading" : ""}`}
                    disabled={addUserLoading || !newUserEmail || !newUserPassword}
                  >
                    <UserPlus size={13} />
                    {addUserLoading ? "Adding…" : "Add Login"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        <section class="settings-section">
          <div class="settings-section-header">
            <AtSign size={16} />
            <h2>Change Email</h2>
          </div>
          <form class="settings-fields" onSubmit={handleChangeEmail}>
            <div class="form-group">
              <label>New Email Address</label>
              <input
                type="email"
                autocomplete="email"
                value={newEmail}
                onInput={(e) => setNewEmail((e.target as HTMLInputElement).value)}
                placeholder="new@example.com"
              />
            </div>
            <div class="form-group">
              <label>Current Password</label>
              <input
                type="password"
                autocomplete="current-password"
                value={emailCurrentPassword}
                onInput={(e) => setEmailCurrentPassword((e.target as HTMLInputElement).value)}
                placeholder="Confirm with your password"
              />
            </div>
            <div class="form-group full-width">
              {emailError && <p class="settings-billing-error">{emailError}</p>}
              {emailSuccess && (
                <p style="color:var(--success);font-size:0.85rem;margin:0.25rem 0 0">
                  Email updated. You are now signed in as {updatedEmail}.
                </p>
              )}
              <div class="settings-billing-actions">
                <button
                  type="submit"
                  class={`btn btn-primary${emailLoading ? " btn-loading" : ""}`}
                  disabled={emailLoading || !newEmail || !emailCurrentPassword}
                >
                  <AtSign size={13} />
                  {emailLoading ? "Updating…" : "Update Email"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section class="settings-section">
          <div class="settings-section-header">
            <KeyRound size={16} />
            <h2>Change Password</h2>
          </div>
          <form class="settings-fields" onSubmit={handleChangePassword}>
            <div class="form-group full-width">
              <label>Current Password</label>
              <input
                type="password"
                autocomplete="current-password"
                value={currentPassword}
                onInput={(e) => setCurrentPassword((e.target as HTMLInputElement).value)}
                placeholder="Enter your current password"
              />
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input
                type="password"
                autocomplete="new-password"
                value={newPassword}
                onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                autocomplete="new-password"
                value={confirmPassword}
                onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                placeholder="Re-enter new password"
              />
            </div>
            <div class="form-group full-width">
              {pwError && <p class="settings-billing-error">{pwError}</p>}
              {pwSuccess && (
                <p style="color:var(--success);font-size:0.85rem;margin:0.25rem 0 0">
                  Password changed successfully.
                </p>
              )}
              <div class="settings-billing-actions">
                <button
                  type="submit"
                  class={`btn btn-primary${pwLoading ? " btn-loading" : ""}`}
                  disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
                >
                  <KeyRound size={13} />
                  {pwLoading ? "Updating…" : "Update Password"}
                </button>
              </div>
            </div>
          </form>
          <div class="settings-fields settings-reset-link-row">
            <div class="form-group full-width">
              <label>Send Password Reset Email</label>
              <p class="settings-field-hint">
                Generates a one-time reset link (valid 1 hour) and emails it directly to the account holder.
                Leave the email blank to send to yourself, or enter another account's email.
              </p>
            </div>
            <div class="form-group full-width">
              <label>Account email (leave blank for yourself)</label>
              <input
                type="email"
                value={resetTargetEmail}
                onInput={(e) => setResetTargetEmail((e.target as HTMLInputElement).value)}
                placeholder="owner@travis.app"
                autocomplete="off"
              />
            </div>
            <div class="form-group full-width">
              {resetLinkError && <p class="settings-billing-error">{resetLinkError}</p>}
              {resetLinkSent && (
                <p class="settings-field-hint" style="color:var(--color-success,#16a34a);margin:4px 0 8px;">
                  Reset email sent — check the inbox of the account holder.
                </p>
              )}
              <div class="settings-billing-actions">
                <button
                  type="button"
                  class={`btn btn-secondary${resetLinkLoading ? " btn-loading" : ""}`}
                  disabled={resetLinkLoading}
                  onClick={handleGenerateResetLink}
                >
                  <KeyRound size={13} />
                  {resetLinkLoading ? "Sending…" : "Send reset email"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
