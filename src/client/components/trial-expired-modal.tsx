import { useState } from "preact/hooks";
import { Zap, ExternalLink } from "lucide-preact";
import { api } from "../api";

interface TrialExpiredModalProps {
  message: string;
  navigate: (to: string) => void;
  onClose: () => void;
}

export function TrialExpiredModal({ message, navigate, onClose }: TrialExpiredModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (plan: "starter" | "pro") => {
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

  return (
    <div class="modal-overlay">
      <div class="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Your trial has ended</h2>
        </div>
        <div style="padding:16px 22px">
          <p style="color:var(--text-muted);margin:0 0 1rem;line-height:1.5">
            {message || "Your trial has ended — upgrade to keep using Travis."}
          </p>
          {error && <p class="settings-billing-error">{error}</p>}
        </div>
        <div class="modal-footer" style="flex-direction:column;align-items:stretch;gap:0.5rem">
          <button
            class={`btn btn-primary${loading === "pro" ? " btn-loading" : ""}`}
            onClick={() => handleUpgrade("pro")}
            disabled={loading !== null}
          >
            <Zap size={13} />
            {loading === "pro" ? "Redirecting…" : "Upgrade to Pro"}
          </button>
          <button
            class={`btn btn-secondary${loading === "starter" ? " btn-loading" : ""}`}
            onClick={() => handleUpgrade("starter")}
            disabled={loading !== null}
          >
            <Zap size={13} />
            {loading === "starter" ? "Redirecting…" : "Upgrade to Starter"}
          </button>
          <button
            class="btn"
            onClick={() => { onClose(); navigate("/settings"); }}
            disabled={loading !== null}
          >
            <ExternalLink size={13} />
            Manage billing in Settings
          </button>
        </div>
      </div>
    </div>
  );
}
