import { useState } from "preact/hooks";

interface ResetPasswordViewProps {
  token: string;
  navigate: (to: string) => void;
}

export function ResetPasswordView({ token, navigate }: ResetPasswordViewProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-mark">⚡</div>
          <span class="login-logo-name">Travis</span>
        </div>
        <p class="login-subtitle">Choose a new password</p>

        {done ? (
          <div class="forgot-password-success">
            <p class="forgot-password-instructions">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button class="btn-primary login-submit" onClick={() => navigate("/login")}>
              Sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="login-form">
            <div class="form-group">
              <label>New password</label>
              <input
                type="password"
                value={newPassword}
                onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
                placeholder="At least 8 characters"
                required
                autocomplete="new-password"
                minLength={8}
              />
            </div>
            <div class="form-group">
              <label>Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
                placeholder="Repeat password"
                required
                autocomplete="new-password"
              />
            </div>
            {error && <div class="error-inline">{error}</div>}
            <button type="submit" class="btn-primary login-submit" disabled={loading}>
              {loading ? "Saving…" : "Set new password"}
            </button>
            <button
              type="button"
              class="forgot-password-back"
              onClick={() => navigate("/login")}
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
