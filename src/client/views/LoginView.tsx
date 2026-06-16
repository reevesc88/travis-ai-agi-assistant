import { useState } from "preact/hooks";
import { api } from "../api";
import { parseTokenPayload } from "../auth";

interface LoginViewProps {
  navigate: (to: string) => void;
}

export function LoginView({ navigate }: LoginViewProps) {
  const [email, setEmail] = useState("owner@travis.app");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ token: string; email: string }>(
        "POST", "/api/auth/login", { email: email.trim(), password }
      );
      localStorage.setItem("travis_token", data.token);
      const claims = parseTokenPayload();
      navigate(claims?.role === "tech" ? "/jobs" : "/dashboard");
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
        <p class="login-subtitle">Sign in to your command centre</p>
        <form onSubmit={handleSubmit} class="login-form">
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
          <div class="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
          </div>
          {error && <div class="error-inline">{error}</div>}
          <button type="submit" class="btn-primary login-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div class="login-forgot">
            <button type="button" class="forgot-password-link" onClick={() => navigate("/forgot-password")}>
              Forgot password?
            </button>
          </div>
        </form>
        <p class="login-hint">Default password: <code>changeme123</code></p>
      </div>
    </div>
  );
}
