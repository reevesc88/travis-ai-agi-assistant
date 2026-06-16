import { useEffect, useState } from "preact/hooks";
import { AlertTriangle, X, Zap } from "lucide-preact";
import { api } from "../api";
import type { Subscription } from "../types";

const DISMISS_KEY = "travis_trial_warning_dismissed";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

function isDismissedLocally(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  return !isNaN(ts) && Date.now() - ts < DISMISS_TTL_MS;
}

export function daysUntil(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(isoDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface Props {
  navigate: (to: string) => void;
}

export function TrialWarningBanner({ navigate }: Props) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ subscription: Subscription }>("GET", "/api/subscription")
      .then(({ subscription: sub }) => {
        if (sub.plan !== "trial" || !sub.trial_ends_at) {
          localStorage.removeItem(DISMISS_KEY);
          return;
        }
        if (isDismissedLocally()) {
          setDismissed(true);
          return;
        }
        const days = daysUntil(sub.trial_ends_at);
        if (days >= 0 && days <= 3) setDaysLeft(days);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const upgrade = async (plan: "starter" | "pro") => {
    setLoading(plan);
    setError(null);
    try {
      const { url } = await api<{ url: string }>("POST", "/api/billing/checkout", {
        plan,
        success_url: window.location.origin + "/settings",
        cancel_url: window.location.origin + "/settings",
      });
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  };

  if (dismissed || daysLeft === null) return null;

  const label =
    daysLeft === 0
      ? "Your trial expires today."
      : daysLeft === 1
      ? "1 day left on your trial."
      : `${daysLeft} days left on your trial.`;

  return (
    <div class="trial-warning-banner" role="alert">
      <AlertTriangle size={15} class="trial-warning-icon" />
      <span class="trial-warning-text">{label} Upgrade to keep access.</span>
      {error && <span class="trial-warning-error">{error}</span>}
      <button
        class={`btn btn-primary btn-xs${loading === "pro" ? " btn-loading" : ""}`}
        onClick={() => upgrade("pro")}
        disabled={loading !== null}
      >
        <Zap size={12} />
        {loading === "pro" ? "…" : "Upgrade"}
      </button>
      <button
        class="trial-warning-settings"
        onClick={() => { dismiss(); navigate("/settings"); }}
        title="Billing settings"
      >
        Plans
      </button>
      <button class="trial-warning-close" onClick={dismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
