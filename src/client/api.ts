export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  const token = localStorage.getItem("travis_token");
  if (token) {
    (opts.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  const text = await r.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server error: ${r.status} ${r.statusText}`);
  }
  if (r.status === 401) {
    if (token) {
      // Existing session expired — clear token and redirect to login
      localStorage.removeItem("travis_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }
    // No existing token — pass through the server's error (e.g. "Invalid email or password")
    throw new Error((data as { error?: string }).error || "Unauthorized");
  }
  if (r.status === 402) {
    const message = (data as { error?: string }).error || "Your trial has ended — upgrade to keep using Travis.";
    window.dispatchEvent(new CustomEvent("travis:trial-expired", { detail: { message } }));
    throw new Error(message);
  }
  if (!r.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}
