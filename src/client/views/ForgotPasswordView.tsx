import { useState } from "preact/hooks";

interface ForgotPasswordViewProps {
  navigate: (to: string) => void;
}

export function ForgotPasswordView({ navigate }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Always show the same message — don't reveal whether the email exists
      setSubmitted(true);
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
        <p class="login-subtitle">Reset your password</p>

        {submitted ? (
          <div class="forgot-password-success">
            <p class="forgot-password-instructions">
              If that email is registered, a password reset link has been sent to your inbox.
              Check your email and follow the link to set a new password.
            </p>
            <button class="forgot-password-back" onClick={() => navigate("/login")}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="login-form">
            <p class="forgot-password-instructions">
              Enter your account email and we'll send you a password reset link.
            </p>
            <div class="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                placeholder="owner@travis.app"
                required
                autocomplete="email"
              />
            </div>
            <button type="submit" class="btn-primary login-submit" disabled={loading}>
              {loading ? "Submitting…" : "Submit request"}
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
