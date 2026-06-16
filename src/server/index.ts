import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { initDB, query, get, run } from "./db.js";
import { aiComplete, assertAIEnv, ALLOWED_MODELS, DEFAULT_MODEL } from "./ai.js";
import { createOrUpdateCalendarEvent, deleteCalendarEvent, storeGoogleTokens, listGoogleCalendars, getSelectedCalendarId, setSelectedCalendarId, resyncJobsToNewCalendar } from "./integrations/google-calendar.js";

type Env = {
  Bindings: {
    DB: D1Database;
    OPENROUTER_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    MOCK_AI?: string;
    JWT_SECRET?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_PRICE_STARTER?: string;
    STRIPE_PRICE_PRO?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    RESEND_API_KEY?: string;
    FROM_EMAIL?: string;
    APP_BASE_URL?: string;
  };
  Variables: { user: Record<string, unknown> };
};

const app = new OpenAPIHono<Env>();

// Module-level flags so column migrations only run once per worker instance.
let _settingsV2Migrated = false;
let _settingsV3Migrated = false;
let _settingsV4Migrated = false;
let _inboxThreadMigrated = false;
let _quotesSourceMigrated = false;
let _quotesCanonicalMigrated = false;

app.use("*", async (c, next) => {
  initDB(c.env);
  assertAIEnv(c.env);
  if (!_settingsV2Migrated) {
    // Idempotent migration: add inbox_agent_interval_hours column if missing (existing DBs).
    const col = await get<{ name: string }>(
      "SELECT name FROM pragma_table_info('settings') WHERE name = 'inbox_agent_interval_hours'"
    ).catch(() => null);
    if (!col) {
      await run("ALTER TABLE settings ADD COLUMN inbox_agent_interval_hours REAL NOT NULL DEFAULT 1").catch(() => {});
    }
    const aiModelCol = await get<{ name: string }>(
      "SELECT name FROM pragma_table_info('settings') WHERE name = 'ai_model'"
    ).catch(() => null);
    if (!aiModelCol) {
      await run("ALTER TABLE settings ADD COLUMN ai_model TEXT NOT NULL DEFAULT 'anthropic/claude-3-haiku'").catch(() => {});
    }
    _settingsV2Migrated = true;
  }
  if (!_settingsV3Migrated) {
    // Idempotent migration: add from_email column to settings if missing (existing DBs).
    const fromEmailCol = await get<{ name: string }>(
      "SELECT name FROM pragma_table_info('settings') WHERE name = 'from_email'"
    ).catch(() => null);
    if (!fromEmailCol) {
      await run("ALTER TABLE settings ADD COLUMN from_email TEXT NOT NULL DEFAULT ''").catch(() => {});
    }
    _settingsV3Migrated = true;
  }
  if (!_settingsV4Migrated) {
    // Idempotent migration: add company_logo_url column to settings if missing (existing DBs).
    const logoCol = await get<{ name: string }>(
      "SELECT name FROM pragma_table_info('settings') WHERE name = 'company_logo_url'"
    ).catch(() => null);
    if (!logoCol) {
      await run("ALTER TABLE settings ADD COLUMN company_logo_url TEXT NOT NULL DEFAULT ''").catch(() => {});
    }
    _settingsV4Migrated = true;
  }
  if (!_inboxThreadMigrated) {
    // Idempotent migration: add thread_id column to inbox_items if missing (existing DBs).
    const col = await get<{ name: string }>(
      "SELECT name FROM pragma_table_info('inbox_items') WHERE name = 'thread_id'"
    ).catch(() => null);
    if (!col) {
      await run("ALTER TABLE inbox_items ADD COLUMN thread_id INTEGER REFERENCES inbox_items(id) ON DELETE SET NULL").catch(() => {});
    }
    // Create index now that column exists.
    await run("CREATE INDEX IF NOT EXISTS idx_inbox_thread ON inbox_items(thread_id)").catch(() => {});
    // Idempotent: set thread_id for seeded reply rows (safe to run every boot after column exists).
    await run("UPDATE inbox_items SET thread_id = 1 WHERE id = 6 AND thread_id IS NULL").catch(() => {});
    await run("UPDATE inbox_items SET thread_id = 1 WHERE id = 7 AND thread_id IS NULL").catch(() => {});
    await run("UPDATE inbox_items SET thread_id = 2 WHERE id = 8 AND thread_id IS NULL").catch(() => {});
    _inboxThreadMigrated = true;
  }
  if (!_quotesSourceMigrated) {
    // Idempotent migration: add source_quote_id column to quotes if missing (existing DBs).
    const col = await get<{ name: string }>(
      "SELECT name FROM pragma_table_info('quotes') WHERE name = 'source_quote_id'"
    ).catch(() => null);
    if (!col) {
      await run("ALTER TABLE quotes ADD COLUMN source_quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL").catch(() => {});
    }
    await run("CREATE INDEX IF NOT EXISTS idx_quotes_source_quote ON quotes(source_quote_id)").catch(() => {});
    _quotesSourceMigrated = true;
  }
  if (!_quotesCanonicalMigrated) {
    const quoteCols: [string, string][] = [
      ["title", "TEXT DEFAULT ''"],
      ["cost_total", "REAL NOT NULL DEFAULT 0"],
      ["margin_amount", "REAL NOT NULL DEFAULT 0"],
      ["risk_level", "TEXT NOT NULL DEFAULT 'low'"],
      ["sent_at", "TEXT DEFAULT ''"],
      ["approved_at", "TEXT DEFAULT ''"],
    ];
    for (const [name, ddl] of quoteCols) {
      const col = await get<{ name: string }>(
        `SELECT name FROM pragma_table_info('quotes') WHERE name = '${name}'`
      ).catch(() => null);
      if (!col) {
        await run(`ALTER TABLE quotes ADD COLUMN ${name} ${ddl}`).catch(() => {});
      }
    }
    const lineCols: [string, string][] = [
      ["kind", "TEXT NOT NULL DEFAULT 'labor'"],
      ["material_id", "INTEGER REFERENCES materials(id) ON DELETE SET NULL"],
      ["supplier_product_id", "INTEGER REFERENCES supplier_products(id) ON DELETE SET NULL"],
      ["sort_order", "INTEGER NOT NULL DEFAULT 0"],
    ];
    for (const [name, ddl] of lineCols) {
      const col = await get<{ name: string }>(
        `SELECT name FROM pragma_table_info('quote_lines') WHERE name = '${name}'`
      ).catch(() => null);
      if (!col) {
        await run(`ALTER TABLE quote_lines ADD COLUMN ${name} ${ddl}`).catch(() => {});
      }
    }
    _quotesCanonicalMigrated = true;
  }
  await next();
});

// ── Shared Schemas ─────────────────────────────────────────────────

const ErrorSchema = z.object({ error: z.string() }).openapi("Error");
const OkSchema = z.object({ ok: z.boolean() }).openapi("Ok");

// ── Email helper (Resend) ───────────────────────────────────────────
async function sendResetEmail(opts: {
  resendApiKey: string;
  from: string;
  to: string;
  resetLink: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${opts.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: "Reset your Travis password",
      html: `<p>Hello,</p>
<p>A password reset was requested for your Travis account. Click the link below to set a new password. This link expires in 1 hour.</p>
<p><a href="${opts.resetLink}">${opts.resetLink}</a></p>
<p>If you did not request a password reset, you can safely ignore this email.</p>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

const CustomerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  notes: z.string(),
  job_count: z.number().int().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi("Customer");

const TechnicianSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  color: z.string(),
  active: z.number().int(),
  job_count: z.number().int().optional(),
  created_at: z.string(),
}).openapi("Technician");

const ServiceTypeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  default_duration: z.number().int(),
  default_price: z.number(),
  color: z.string(),
  created_at: z.string(),
}).openapi("ServiceType");

const JobNoteSchema = z.object({
  id: z.number().int(),
  job_id: z.number().int(),
  content: z.string(),
  created_at: z.string(),
}).openapi("JobNote");

const JobSchema = z.object({
  id: z.number().int(),
  identifier: z.string(),
  customer_id: z.number().int(),
  technician_id: z.number().int().nullable(),
  service_type_id: z.number().int().nullable(),
  status: z.string(),
  priority: z.string(),
  scheduled_date: z.string(),
  scheduled_time: z.string(),
  duration: z.number().int(),
  price: z.number(),
  address: z.string(),
  notes: z.string(),
  completion_notes: z.string(),
  is_recurring: z.number().int(),
  recurrence_interval: z.string(),
  next_recurrence_date: z.string(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  technician_name: z.string().nullable().optional(),
  technician_color: z.string().nullable().optional(),
  service_type_name: z.string().nullable().optional(),
  service_type_color: z.string().nullable().optional(),
  gcal_event_id: z.string().nullable().optional(),
  job_notes: z.array(JobNoteSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi("Job");

const IdParam = z.object({ id: z.string().openapi({ description: "Resource ID" }) });

// ── Auth utilities ────────────────────────────────────────────────

const DEV_JWT_SECRET = "travis-dev-secret-change-in-production";
const JWT_EXPIRY_SECS = 7 * 24 * 60 * 60; // 7 days

/** Dev fallback only when MOCK_AI=1; production must set JWT_SECRET or fail closed. */
function resolveJwtSecret(env: { JWT_SECRET?: string; MOCK_AI?: string }): string | null {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.MOCK_AI === "1") return DEV_JWT_SECRET;
  return null;
}

function b64url(buf: ArrayBuffer): string {
  let s = ""; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(str: string): string {
  let s = ""; new TextEncoder().encode(str).forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Uint8Array {
  const p = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(atob(p), c => c.charCodeAt(0));
}

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const h = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const b = b64urlStr(JSON.stringify(payload));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${h}.${b}`));
  return `${h}.${b}.${b64url(sig)}`;
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [h, b, sig] = token.split(".");
    if (!h || !b || !sig) return null;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig),
      new TextEncoder().encode(`${h}.${b}`));
    if (!ok) return null;
    const payload = JSON.parse(atob(b.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const [, salt, expected] = parts;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password),
    "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" },
    key, 256
  );
  return b64url(bits) === expected;
}

async function hashPassword(password: string): Promise<string> {
  const salt = b64url(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password),
    "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" },
    key, 256
  );
  return `pbkdf2$${salt}$${b64url(bits)}`;
}

// ── Auth middleware ───────────────────────────────────────────────

app.use("/api/*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth/") || c.req.path === "/api/billing/webhook" || c.req.path === "/api/integrations/google/callback" || c.req.path === "/api/agent/interval") return next();
  const effectiveSecret = resolveJwtSecret(c.env);
  if (!effectiveSecret) {
    return c.json({ error: "Server misconfigured: JWT_SECRET is not set" }, 500);
  }
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const payload = await verifyJWT(token, effectiveSecret);
  if (!payload) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", payload);
  // Trial expiry enforcement — billing and subscription routes are always accessible
  // so expired users can still pay to restore access
  const isBillingOrSubPath = c.req.path.startsWith("/api/billing/") || c.req.path === "/api/subscription";
  if (!isBillingOrSubPath) {
    const sub = await get<{ plan: string; trial_ends_at: string }>(
      "SELECT plan, trial_ends_at FROM subscription WHERE id = 1"
    );
    const today = new Date().toISOString().split("T")[0];
    if (sub?.plan === "trial" && sub.trial_ends_at && sub.trial_ends_at < today) {
      return c.json({ error: "Trial expired. Please upgrade your plan to continue." }, 402);
    }
  }
  return next();
});

// ── Auth endpoints ─────────────────────────────────────────────────

app.openapi(createRoute({
  method: "post",
  path: "/api/auth/login",
  request: {
    body: { content: { "application/json": { schema: z.object({ email: z.string(), password: z.string() }) } } },
  },
  responses: {
    200: { description: "OK", content: { "application/json": { schema: z.object({ token: z.string(), email: z.string() }) } } },
    401: { description: "Invalid credentials", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const { email, password } = c.req.valid("json");
  const user = await get<{ id: number; email: string; password_hash: string; role: string }>(
    "SELECT id, email, password_hash, role FROM users WHERE email = ?", [email.toLowerCase().trim()]
  );
  if (!user) return c.json({ error: "Invalid email or password" }, 401);
  if (!(await verifyPassword(password, user.password_hash))) return c.json({ error: "Invalid email or password" }, 401);
  const secret = resolveJwtSecret(c.env);
  if (!secret) {
    return c.json({ error: "Server misconfigured: JWT_SECRET is not set" }, 500);
  }
  const now = Math.floor(Date.now() / 1000);
  const token = await signJWT(
    { sub: String(user.id), email: user.email, role: user.role, iat: now, exp: now + JWT_EXPIRY_SECS },
    secret
  );
  return c.json({ token, email: user.email }, 200);
});

app.openapi(createRoute({
  method: "post",
  path: "/api/auth/logout",
  responses: {
    200: { description: "Logged out", content: { "application/json": { schema: OkSchema } } },
  },
}), (c) => c.json({ ok: true }, 200));

app.openapi(createRoute({
  method: "post",
  path: "/api/auth/change-password",
  request: {
    body: { content: { "application/json": { schema: z.object({
      current_password: z.string(),
      new_password: z.string().min(8),
    }) } } },
  },
  responses: {
    200: { description: "Password changed", content: { "application/json": { schema: OkSchema } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ErrorSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  // This route bypasses the global auth middleware (/api/auth/*), so verify the JWT here.
  const effectiveSecret = resolveJwtSecret(c.env);
  if (!effectiveSecret) {
    return c.json({ error: "Server misconfigured: JWT_SECRET is not set" }, 500);
  }
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const payload = await verifyJWT(token, effectiveSecret);
  if (!payload || typeof payload.sub !== "string") return c.json({ error: "Unauthorized" }, 401);

  const { current_password, new_password } = c.req.valid("json");
  const user = await get<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE id = ?", [payload.sub]
  );
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!(await verifyPassword(current_password, user.password_hash))) {
    return c.json({ error: "Current password is incorrect" }, 400);
  }
  const newHash = await hashPassword(new_password);
  await run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);
  return c.json({ ok: true }, 200);
});

app.openapi(createRoute({
  method: "post",
  path: "/api/auth/change-email",
  request: {
    body: { content: { "application/json": { schema: z.object({
      new_email: z.string().email(),
      current_password: z.string(),
    }) } } },
  },
  responses: {
    200: { description: "Email changed", content: { "application/json": { schema: z.object({ ok: z.boolean(), token: z.string() }) } } },
    400: { description: "Invalid request", content: { "application/json": { schema: ErrorSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
    409: { description: "Email already in use", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const effectiveSecret = resolveJwtSecret(c.env);
  if (!effectiveSecret) {
    return c.json({ error: "Server misconfigured: JWT_SECRET is not set" }, 500);
  }
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const payload = await verifyJWT(token, effectiveSecret);
  if (!payload || typeof payload.sub !== "string") return c.json({ error: "Unauthorized" }, 401);

  const { new_email, current_password } = c.req.valid("json");
  const normalizedEmail = new_email.toLowerCase().trim();

  const user = await get<{ id: number; email: string; password_hash: string; role: string }>(
    "SELECT id, email, password_hash, role FROM users WHERE id = ?", [payload.sub]
  );
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!(await verifyPassword(current_password, user.password_hash))) {
    return c.json({ error: "Current password is incorrect" }, 400);
  }
  if (normalizedEmail === user.email.toLowerCase()) {
    return c.json({ error: "New email must be different from current email" }, 400);
  }
  const existing = await get<{ id: number }>("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
  if (existing) return c.json({ error: "That email address is already in use" }, 409);

  await run("UPDATE users SET email = ? WHERE id = ?", [normalizedEmail, user.id]);

  const now = Math.floor(Date.now() / 1000);
  const newToken = await signJWT(
    { sub: String(user.id), email: normalizedEmail, role: user.role, iat: now, exp: now + JWT_EXPIRY_SECS },
    effectiveSecret
  );
  return c.json({ ok: true, token: newToken }, 200);
});

app.openapi(createRoute({
  method: "post",
  path: "/api/auth/forgot-password",
  request: {
    body: { content: { "application/json": { schema: z.object({ email: z.string() }) } } },
  },
  responses: {
    200: { description: "Request acknowledged", content: { "application/json": { schema: OkSchema } } },
  },
}), async (c) => {
  const { email } = c.req.valid("json");
  // Look up user silently — never reveal whether the email exists
  const user = await get<{ id: number }>(
    "SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]
  );
  if (user) {
    // Expire any existing tokens for this user
    await run("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id]);
    // Generate a secure random token (32 bytes → 64 hex chars)
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
    // Token valid for 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await run(
      "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
      [token, user.id, expiresAt]
    );
    // Send reset link by email — silently suppress delivery errors so the
    // response never reveals whether the address is registered.
    const resendApiKey = c.env.RESEND_API_KEY;
    const appBaseUrl = c.env.APP_BASE_URL;
    if (!resendApiKey) {
      console.warn("[forgot-password] RESEND_API_KEY not configured — reset email not sent");
    } else if (!appBaseUrl) {
      console.warn("[forgot-password] APP_BASE_URL not configured — reset email not sent");
    } else {
      const resetLink = `${appBaseUrl.replace(/\/$/, "")}/reset-password/${token}`;
      const settingsRow = await get<{ from_email: string; company_name: string }>(
        "SELECT from_email, company_name FROM settings WHERE id = 1"
      ).catch(() => null);
      const fromEmail = settingsRow?.from_email || c.env.FROM_EMAIL || `noreply@travis.app`;
      const fromLabel = settingsRow?.company_name ? `${settingsRow.company_name} <${fromEmail}>` : fromEmail;
      await sendResetEmail({ resendApiKey, from: fromLabel, to: email.toLowerCase().trim(), resetLink })
        .catch((err) => console.error("[forgot-password] email send failed:", err));
    }
  }
  // Always return ok — never leak whether the email exists
  return c.json({ ok: true }, 200);
});

const AdminResetSchema = z.object({ ok: z.boolean(), reset_link: z.string() }).openapi("AdminReset");

// Owner-only: generate a password reset link for any registered user.
// Requires a valid JWT with role=owner — call this from within the authenticated app (Settings page).
// Body: { email?: string } — omit to generate for the current user, or supply any email to target another account.
app.openapi(createRoute({
  method: "post",
  path: "/api/auth/admin-reset",
  request: {
    body: { content: { "application/json": { schema: z.object({ email: z.string().optional() }) } } },
  },
  responses: {
    200: { description: "Reset link generated", content: { "application/json": { schema: AdminResetSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden — owner role required", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "User not found", content: { "application/json": { schema: ErrorSchema } } },
    500: { description: "APP_BASE_URL not configured", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const effectiveSecret = resolveJwtSecret(c.env);
  if (!effectiveSecret) {
    return c.json({ error: "Server misconfigured: JWT_SECRET is not set" }, 500);
  }
  const authHeader = c.req.header("Authorization") ?? "";
  const jwtToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!jwtToken) return c.json({ error: "Unauthorized" }, 401);
  const payload = await verifyJWT(jwtToken, effectiveSecret);
  if (!payload || typeof payload.sub !== "string") return c.json({ error: "Unauthorized" }, 401);
  // Require owner role
  if (payload.role !== "owner") return c.json({ error: "Forbidden: owner role required to generate reset links" }, 403);

  const resendApiKey = c.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return c.json({ error: "Email delivery is not configured — set the RESEND_API_KEY Worker secret" }, 500);
  }

  const { email } = c.req.valid("json");
  let targetUserId: string;
  let targetEmail: string;
  if (email) {
    // Target a specific user by email (e.g. a locked-out owner targeted by another admin session)
    const targetUser = await get<{ id: number }>(
      "SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]
    );
    if (!targetUser) return c.json({ error: "No account found for that email address" }, 404);
    targetUserId = String(targetUser.id);
    targetEmail = email.toLowerCase().trim();
  } else {
    // Default: generate a link for the currently authenticated user
    targetUserId = payload.sub;
    const selfUser = await get<{ email: string }>("SELECT email FROM users WHERE id = ?", [targetUserId]);
    if (!selfUser) return c.json({ error: "Authenticated user not found" }, 404);
    targetEmail = selfUser.email;
  }

  // Expire any prior tokens for the target user
  await run("DELETE FROM password_reset_tokens WHERE user_id = ?", [targetUserId]);
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const resetToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await run(
    "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
    [resetToken, targetUserId, expiresAt]
  );
  const appBaseUrl = c.env.APP_BASE_URL;
  if (!appBaseUrl) {
    return c.json({ error: "APP_BASE_URL is not configured — set it as a Worker secret so reset links point to the correct domain" }, 500);
  }
  const resetLink = `${appBaseUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

  const settingsRow = await get<{ from_email: string; company_name: string }>(
    "SELECT from_email, company_name FROM settings WHERE id = 1"
  ).catch(() => null);
  const fromEmail = settingsRow?.from_email || c.env.FROM_EMAIL || `noreply@travis.app`;
  const fromLabel = settingsRow?.company_name ? `${settingsRow.company_name} <${fromEmail}>` : fromEmail;

  await sendResetEmail({ resendApiKey, from: fromLabel, to: targetEmail, resetLink });
  return c.json({ ok: true, reset_link: resetLink }, 200);
});

app.openapi(createRoute({
  method: "post",
  path: "/api/auth/reset-password",
  request: {
    body: { content: { "application/json": { schema: z.object({
      token: z.string(),
      new_password: z.string().min(8),
    }) } } },
  },
  responses: {
    200: { description: "Password reset", content: { "application/json": { schema: OkSchema } } },
    400: { description: "Invalid or expired token", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const { token, new_password } = c.req.valid("json");
  const row = await get<{ user_id: number; expires_at: string }>(
    "SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?", [token]
  );
  if (!row) return c.json({ error: "Invalid or expired reset link" }, 400);
  if (new Date(row.expires_at) < new Date()) {
    await run("DELETE FROM password_reset_tokens WHERE token = ?", [token]);
    return c.json({ error: "Reset link has expired — please request a new one" }, 400);
  }
  const newHash = await hashPassword(new_password);
  await run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, row.user_id]);
  await run("DELETE FROM password_reset_tokens WHERE token = ?", [token]);
  return c.json({ ok: true }, 200);
});

// ── User management (owner-only) ────────────────────────────────────

app.openapi(createRoute({
  method: "get",
  path: "/api/users",
  responses: {
    200: { description: "User list", content: { "application/json": { schema: z.object({ users: z.array(z.object({ id: z.number(), email: z.string(), role: z.string(), created_at: z.string() })) }) } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const user = c.get("user") as { role?: string } | undefined;
  if (user?.role !== "owner") return c.json({ error: "Forbidden: owner role required" }, 403);
  const users = await query<{ id: number; email: string; role: string; created_at: string }>(
    "SELECT id, email, role, created_at FROM users ORDER BY id ASC"
  );
  return c.json({ users }, 200);
});

app.openapi(createRoute({
  method: "post",
  path: "/api/users",
  request: {
    body: { content: { "application/json": { schema: z.object({
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["owner", "tech"]),
    }) } } },
  },
  responses: {
    201: { description: "User created", content: { "application/json": { schema: z.object({ id: z.number(), email: z.string(), role: z.string(), created_at: z.string() }) } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    409: { description: "Email already in use", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const user = c.get("user") as { role?: string } | undefined;
  if (user?.role !== "owner") return c.json({ error: "Forbidden: owner role required" }, 403);
  const { email, password, role } = c.req.valid("json");
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await get<{ id: number }>("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
  if (existing) return c.json({ error: "That email address is already in use" }, 409);
  const hash = await hashPassword(password);
  await run(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
    [normalizedEmail, hash, role]
  );
  const newId = await get<{ id: number }>("SELECT last_insert_rowid() as id");
  const created = await get<{ id: number; email: string; role: string; created_at: string }>(
    "SELECT id, email, role, created_at FROM users WHERE id = ?", [newId!.id]
  );
  return c.json(created!, 201);
});

app.openapi(createRoute({
  method: "delete",
  path: "/api/users/:id",
  responses: {
    200: { description: "User deleted", content: { "application/json": { schema: OkSchema } } },
    400: { description: "Cannot delete self", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const callerUser = c.get("user") as { sub?: string; role?: string } | undefined;
  if (callerUser?.role !== "owner") return c.json({ error: "Forbidden: owner role required" }, 403);
  const id = parseInt(c.req.param("id"), 10);
  if (String(id) === callerUser?.sub) return c.json({ error: "You cannot delete your own account" }, 400);
  const existing = await get<{ id: number }>("SELECT id FROM users WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "User not found" }, 404);
  await run("DELETE FROM users WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Helpers ────────────────────────────────────────────────────────

async function nextIdentifier(): Promise<string> {
  const prefix = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'identifier_prefix'");
  const counter = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'job_counter'");
  const next = parseInt(counter?.value || "0", 10) + 1;
  await run("UPDATE _meta SET value = ? WHERE key = 'job_counter'", [String(next)]);
  return `${prefix?.value || "JOB"}-${next}`;
}

async function nextInvoiceIdentifier(): Promise<string> {
  const prefix = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'invoice_prefix'");
  const counter = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'invoice_counter'");
  const next = parseInt(counter?.value || "0", 10) + 1;
  await run("UPDATE _meta SET value = ? WHERE key = 'invoice_counter'", [String(next)]);
  return `${prefix?.value || "INV"}-${next}`;
}

// ── Stats ──────────────────────────────────────────────────────────

const getStats = createRoute({
  method: "get",
  path: "/api/stats",
  responses: {
    200: {
      description: "Dashboard stats",
      content: { "application/json": { schema: z.object({
        jobs: z.number().int(),
        customers: z.number().int(),
        technicians: z.number().int(),
        service_types: z.number().int(),
        today_jobs: z.number().int(),
        upcoming_jobs: z.number().int(),
        completed_jobs: z.number().int(),
        revenue: z.number(),
        invoices_outstanding: z.number(),
        invoices_overdue: z.number(),
        inbox_unread: z.number().int(),
        quotes_open: z.number().int(),
        quotes_value: z.number(),
        stale_supplier_prices: z.number().int(),
      }) } },
    },
  },
});

app.openapi(getStats, async (c) => {
  const jobs = await get<{ count: number }>("SELECT COUNT(*) as count FROM jobs");
  const customers = await get<{ count: number }>("SELECT COUNT(*) as count FROM customers");
  const technicians = await get<{ count: number }>("SELECT COUNT(*) as count FROM technicians WHERE active = 1");
  const serviceTypes = await get<{ count: number }>("SELECT COUNT(*) as count FROM service_types");
  const today = new Date().toISOString().split("T")[0];
  const todayJobs = await get<{ count: number }>("SELECT COUNT(*) as count FROM jobs WHERE scheduled_date = ?", [today]);
  const upcomingJobs = await get<{ count: number }>("SELECT COUNT(*) as count FROM jobs WHERE status IN ('scheduled', 'confirmed') AND scheduled_date >= ?", [today]);
  const completedJobs = await get<{ count: number }>("SELECT COUNT(*) as count FROM jobs WHERE status = 'completed'");
  const revenue = await get<{ total: number }>("SELECT COALESCE(SUM(price), 0) as total FROM jobs WHERE status = 'completed'");
  const quotesOpen = await get<{ count: number }>("SELECT COUNT(*) as count FROM quotes WHERE status IN ('draft', 'sent')");
  const quotesValue = await get<{ total: number }>("SELECT COALESCE(SUM(total), 0) as total FROM quotes WHERE status IN ('draft', 'sent')");
  return c.json({
    jobs: jobs?.count || 0,
    customers: customers?.count || 0,
    technicians: technicians?.count || 0,
    service_types: serviceTypes?.count || 0,
    today_jobs: todayJobs?.count || 0,
    upcoming_jobs: upcomingJobs?.count || 0,
    completed_jobs: completedJobs?.count || 0,
    revenue: revenue?.total || 0,
    invoices_outstanding: (await get<{ count: number }>("SELECT COUNT(*) as count FROM invoices WHERE status IN ('sent')"))?.count || 0,
    invoices_overdue: (await get<{ count: number }>("SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue'"))?.count || 0,
    inbox_unread: (await get<{ count: number }>("SELECT COUNT(*) as count FROM inbox_items WHERE status = 'unread'"))?.count || 0,
    quotes_open: quotesOpen?.count || 0,
    quotes_value: quotesValue?.total || 0,
    stale_supplier_prices: (await get<{ count: number }>(
      "SELECT COUNT(*) as count FROM supplier_products WHERE (julianday('now') - julianday(last_checked)) >= 30"
    ))?.count || 0,
  }, 200);
});

// ── Jobs ───────────────────────────────────────────────────────────

const listJobs = createRoute({
  method: "get",
  path: "/api/jobs",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      status: z.string().optional(),
      date: z.string().optional(),
      technician_id: z.string().optional(),
      customer_id: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Paginated job list",
      content: { "application/json": { schema: z.object({ jobs: z.array(JobSchema), total: z.number().int() }) } },
    },
  },
});

app.openapi(listJobs, async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10);
  const limit = parseInt(q.limit || "50", 10);
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (q.search) {
    where += " AND (j.identifier LIKE ? OR c.name LIKE ? OR j.address LIKE ?)";
    const s = `%${q.search}%`;
    params.push(s, s, s);
  }
  if (q.status) {
    where += " AND j.status = ?";
    params.push(q.status);
  }
  if (q.date) {
    where += " AND j.scheduled_date = ?";
    params.push(q.date);
  }
  if (q.technician_id) {
    where += " AND j.technician_id = ?";
    params.push(q.technician_id);
  }
  if (q.customer_id) {
    where += " AND j.customer_id = ?";
    params.push(q.customer_id);
  }

  const countRow = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM jobs j LEFT JOIN customers c ON j.customer_id = c.id ${where}`,
    params
  );

  const jobs = await query<Record<string, unknown>>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone,
       t.name as technician_name, t.color as technician_color,
       st.name as service_type_name, st.color as service_type_color,
       ge.event_id as gcal_event_id
     FROM jobs j
     LEFT JOIN customers c ON j.customer_id = c.id
     LEFT JOIN technicians t ON j.technician_id = t.id
     LEFT JOIN service_types st ON j.service_type_id = st.id
     LEFT JOIN job_gcal_events ge ON ge.job_id = j.id
     ${where}
     ORDER BY j.scheduled_date ASC, j.scheduled_time ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return c.json({ jobs, total: countRow?.count || 0 }, 200);
});

const getJob = createRoute({
  method: "get",
  path: "/api/jobs/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Job detail", content: { "application/json": { schema: z.object({ job: JobSchema }) } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getJob, async (c) => {
  const { id } = c.req.valid("param");
  const job = await get<Record<string, unknown>>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone,
       t.name as technician_name, t.color as technician_color,
       st.name as service_type_name, st.color as service_type_color,
       ge.event_id as gcal_event_id
     FROM jobs j
     LEFT JOIN customers c ON j.customer_id = c.id
     LEFT JOIN technicians t ON j.technician_id = t.id
     LEFT JOIN service_types st ON j.service_type_id = st.id
     LEFT JOIN job_gcal_events ge ON ge.job_id = j.id
     WHERE j.id = ?`,
    [id]
  );
  if (!job) return c.json({ error: "Job not found" }, 404);
  const notes = await query<Record<string, unknown>>(
    "SELECT * FROM job_notes WHERE job_id = ? ORDER BY created_at DESC", [id]
  );
  const checklist = await query<Record<string, unknown>>(
    "SELECT * FROM job_checklist WHERE job_id = ? ORDER BY sort_order ASC", [id]
  );
  const jobMaterials = await query<Record<string, unknown>>(
    `SELECT jm.*, m.name as material_name, m.unit as material_unit
     FROM job_materials jm LEFT JOIN materials m ON jm.material_id = m.id
     WHERE jm.job_id = ? ORDER BY jm.id ASC`, [id]
  );
  return c.json({ job: { ...job, job_notes: notes, checklist, job_materials: jobMaterials } }, 200);
});

const createJob = createRoute({
  method: "post",
  path: "/api/jobs",
  request: {
    body: {
      content: { "application/json": { schema: z.object({
        customer_id: z.number().int(),
        technician_id: z.number().int().nullable().optional(),
        service_type_id: z.number().int().nullable().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        scheduled_date: z.string(),
        scheduled_time: z.string().optional(),
        duration: z.number().int().optional(),
        price: z.number().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
        is_recurring: z.number().int().optional(),
        recurrence_interval: z.string().optional(),
      }) } },
    },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: JobSchema } } },
  },
});

app.openapi(createJob, async (c) => {
  const data = c.req.valid("json");
  const identifier = await nextIdentifier();

  // If address is empty, use customer address
  let address = data.address || "";
  if (!address) {
    const cust = await get<{ address: string; city: string; state: string; zip: string }>(
      "SELECT address, city, state, zip FROM customers WHERE id = ?", [data.customer_id]
    );
    if (cust) {
      address = [cust.address, cust.city, cust.state, cust.zip].filter(Boolean).join(", ");
    }
  }

  // Default price/duration from service type
  let duration = data.duration || 60;
  let price = data.price || 0;
  if (data.service_type_id && (!data.duration || !data.price)) {
    const st = await get<{ default_duration: number; default_price: number }>(
      "SELECT default_duration, default_price FROM service_types WHERE id = ?", [data.service_type_id]
    );
    if (st) {
      if (!data.duration) duration = st.default_duration;
      if (!data.price) price = st.default_price;
    }
  }

  await run(
    `INSERT INTO jobs (identifier, customer_id, technician_id, service_type_id, status, priority,
       scheduled_date, scheduled_time, duration, price, address, notes, is_recurring, recurrence_interval)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      identifier,
      data.customer_id,
      data.technician_id ?? null,
      data.service_type_id ?? null,
      data.status || "scheduled",
      data.priority || "normal",
      data.scheduled_date,
      data.scheduled_time || "09:00",
      duration,
      price,
      address,
      data.notes || "",
      data.is_recurring || 0,
      data.recurrence_interval || "",
    ]
  );

  const job = await get<Record<string, unknown>>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone,
       t.name as technician_name, t.color as technician_color,
       st.name as service_type_name, st.color as service_type_color
     FROM jobs j
     LEFT JOIN customers c ON j.customer_id = c.id
     LEFT JOIN technicians t ON j.technician_id = t.id
     LEFT JOIN service_types st ON j.service_type_id = st.id
     WHERE j.identifier = ?`,
    [identifier]
  );
  await createOrUpdateCalendarEvent(c.env, job as Parameters<typeof createOrUpdateCalendarEvent>[1]);
  return c.json(job!, 201);
});

const updateJob = createRoute({
  method: "put",
  path: "/api/jobs/{id}",
  request: {
    params: IdParam,
    body: {
      content: { "application/json": { schema: z.object({
        customer_id: z.number().int().optional(),
        technician_id: z.number().int().nullable().optional(),
        service_type_id: z.number().int().nullable().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        scheduled_date: z.string().optional(),
        scheduled_time: z.string().optional(),
        duration: z.number().int().optional(),
        price: z.number().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
        completion_notes: z.string().optional(),
        is_recurring: z.number().int().optional(),
        recurrence_interval: z.string().optional(),
      }) } },
    },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(updateJob, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const existing = await get<Record<string, unknown>>("SELECT * FROM jobs WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "Job not found" }, 404);

  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    await run(`UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  }
  const updatedJob = await get<Record<string, unknown>>(
    `SELECT j.*, c.name as customer_name FROM jobs j
     LEFT JOIN customers c ON j.customer_id = c.id WHERE j.id = ?`, [id]
  );
  if (updatedJob) {
    await createOrUpdateCalendarEvent(c.env, updatedJob as Parameters<typeof createOrUpdateCalendarEvent>[1]);
  }
  return c.json({ ok: true }, 200);
});

const deleteJob = createRoute({
  method: "delete",
  path: "/api/jobs/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteJob, async (c) => {
  const { id } = c.req.valid("param");
  await deleteCalendarEvent(c.env, parseInt(id, 10));
  await run("DELETE FROM jobs WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Job Notes ──────────────────────────────────────────────────────

const addJobNote = createRoute({
  method: "post",
  path: "/api/jobs/{id}/notes",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({ content: z.string() }) } } },
  },
  responses: {
    201: { description: "Note added", content: { "application/json": { schema: JobNoteSchema } } },
  },
});

app.openapi(addJobNote, async (c) => {
  const { id } = c.req.valid("param");
  const { content } = c.req.valid("json");
  await run("INSERT INTO job_notes (job_id, content) VALUES (?, ?)", [id, content]);
  const note = await get<Record<string, unknown>>(
    "SELECT * FROM job_notes WHERE job_id = ? ORDER BY id DESC LIMIT 1", [id]
  );
  return c.json(note!, 201);
});

const deleteJobNote = createRoute({
  method: "delete",
  path: "/api/notes/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteJobNote, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM job_notes WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Customers ──────────────────────────────────────────────────────

const listCustomers = createRoute({
  method: "get",
  path: "/api/customers",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Paginated customer list",
      content: { "application/json": { schema: z.object({ customers: z.array(CustomerSchema), total: z.number().int() }) } },
    },
  },
});

app.openapi(listCustomers, async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10);
  const limit = parseInt(q.limit || "50", 10);
  const offset = (page - 1) * limit;

  let where = "";
  const params: unknown[] = [];
  if (q.search) {
    where = "WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.address LIKE ?";
    const s = `%${q.search}%`;
    params.push(s, s, s, s);
  }

  const countRow = await get<{ count: number }>(`SELECT COUNT(*) as count FROM customers c ${where}`, params);
  const customers = await query<Record<string, unknown>>(
    `SELECT c.*, COALESCE(jc.cnt, 0) as job_count
     FROM customers c
     LEFT JOIN (SELECT customer_id, COUNT(*) as cnt FROM jobs GROUP BY customer_id) jc ON jc.customer_id = c.id
     ${where}
     ORDER BY c.name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return c.json({ customers, total: countRow?.count || 0 }, 200);
});

const listAllCustomers = createRoute({
  method: "get",
  path: "/api/customers/all",
  responses: {
    200: {
      description: "All customers (for dropdowns)",
      content: { "application/json": { schema: z.object({ customers: z.array(z.object({ id: z.number().int(), name: z.string(), address: z.string() })) }) } },
    },
  },
});

app.openapi(listAllCustomers, async (c) => {
  const customers = await query<Record<string, unknown>>("SELECT id, name, address FROM customers ORDER BY name ASC");
  return c.json({ customers }, 200);
});

const getCustomer = createRoute({
  method: "get",
  path: "/api/customers/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Customer detail", content: { "application/json": { schema: z.object({ customer: CustomerSchema, jobs: z.array(JobSchema) }) } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getCustomer, async (c) => {
  const { id } = c.req.valid("param");
  const customer = await get<Record<string, unknown>>("SELECT * FROM customers WHERE id = ?", [id]);
  if (!customer) return c.json({ error: "Customer not found" }, 404);
  const jobs = await query<Record<string, unknown>>(
    `SELECT j.*, t.name as technician_name, t.color as technician_color,
       st.name as service_type_name, st.color as service_type_color
     FROM jobs j
     LEFT JOIN technicians t ON j.technician_id = t.id
     LEFT JOIN service_types st ON j.service_type_id = st.id
     WHERE j.customer_id = ?
     ORDER BY j.scheduled_date DESC
     LIMIT 50`,
    [id]
  );
  return c.json({ customer, jobs }, 200);
});

const createCustomer = createRoute({
  method: "post",
  path: "/api/customers",
  request: {
    body: {
      content: { "application/json": { schema: z.object({
        name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        notes: z.string().optional(),
      }) } },
    },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: CustomerSchema } } },
  },
});

app.openapi(createCustomer, async (c) => {
  const data = c.req.valid("json");
  await run(
    "INSERT INTO customers (name, email, phone, address, city, state, zip, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [data.name, data.email || "", data.phone || "", data.address || "",
    data.city || "", data.state || "", data.zip || "", data.notes || ""]
  );
  const customer = await get<Record<string, unknown>>("SELECT * FROM customers ORDER BY id DESC LIMIT 1");
  return c.json(customer!, 201);
});

const updateCustomer = createRoute({
  method: "put",
  path: "/api/customers/{id}",
  request: {
    params: IdParam,
    body: {
      content: { "application/json": { schema: z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        notes: z.string().optional(),
      }) } },
    },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(updateCustomer, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    await run(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteCustomer = createRoute({
  method: "delete",
  path: "/api/customers/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteCustomer, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM customers WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Technicians ────────────────────────────────────────────────────

const listTechnicians = createRoute({
  method: "get",
  path: "/api/technicians",
  responses: {
    200: {
      description: "All technicians",
      content: { "application/json": { schema: z.object({ technicians: z.array(TechnicianSchema) }) } },
    },
  },
});

app.openapi(listTechnicians, async (c) => {
  const technicians = await query<Record<string, unknown>>(
    `SELECT t.*, COALESCE(jc.cnt, 0) as job_count
     FROM technicians t
     LEFT JOIN (SELECT technician_id, COUNT(*) as cnt FROM jobs WHERE status IN ('scheduled','confirmed','in_progress') GROUP BY technician_id) jc ON jc.technician_id = t.id
     ORDER BY t.name ASC`
  );
  return c.json({ technicians }, 200);
});

const listAllTechnicians = createRoute({
  method: "get",
  path: "/api/technicians/all",
  responses: {
    200: {
      description: "Active technicians (for dropdowns)",
      content: { "application/json": { schema: z.object({ technicians: z.array(z.object({ id: z.number().int(), name: z.string(), color: z.string() })) }) } },
    },
  },
});

app.openapi(listAllTechnicians, async (c) => {
  const technicians = await query<Record<string, unknown>>(
    "SELECT id, name, color FROM technicians WHERE active = 1 ORDER BY name ASC"
  );
  return c.json({ technicians }, 200);
});

const createTechnician = createRoute({
  method: "post",
  path: "/api/technicians",
  request: {
    body: {
      content: { "application/json": { schema: z.object({
        name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        color: z.string().optional(),
      }) } },
    },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: TechnicianSchema } } },
  },
});

app.openapi(createTechnician, async (c) => {
  const data = c.req.valid("json");
  await run(
    "INSERT INTO technicians (name, email, phone, color) VALUES (?, ?, ?, ?)",
    [data.name, data.email || "", data.phone || "", data.color || "#16a34a"]
  );
  const tech = await get<Record<string, unknown>>("SELECT * FROM technicians ORDER BY id DESC LIMIT 1");
  return c.json(tech!, 201);
});

const updateTechnician = createRoute({
  method: "put",
  path: "/api/technicians/{id}",
  request: {
    params: IdParam,
    body: {
      content: { "application/json": { schema: z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        color: z.string().optional(),
        active: z.number().int().optional(),
      }) } },
    },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(updateTechnician, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (fields.length > 0) {
    await run(`UPDATE technicians SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteTechnician = createRoute({
  method: "delete",
  path: "/api/technicians/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteTechnician, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM technicians WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Service Types ──────────────────────────────────────────────────

const listServiceTypes = createRoute({
  method: "get",
  path: "/api/service-types",
  responses: {
    200: {
      description: "All service types",
      content: { "application/json": { schema: z.object({ service_types: z.array(ServiceTypeSchema) }) } },
    },
  },
});

app.openapi(listServiceTypes, async (c) => {
  const types = await query<Record<string, unknown>>("SELECT * FROM service_types ORDER BY name ASC");
  return c.json({ service_types: types }, 200);
});

const createServiceType = createRoute({
  method: "post",
  path: "/api/service-types",
  request: {
    body: {
      content: { "application/json": { schema: z.object({
        name: z.string(),
        description: z.string().optional(),
        default_duration: z.number().int().optional(),
        default_price: z.number().optional(),
        color: z.string().optional(),
      }) } },
    },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: ServiceTypeSchema } } },
  },
});

app.openapi(createServiceType, async (c) => {
  const data = c.req.valid("json");
  await run(
    "INSERT INTO service_types (name, description, default_duration, default_price, color) VALUES (?, ?, ?, ?, ?)",
    [data.name, data.description || "", data.default_duration || 60, data.default_price || 0, data.color || "#6b7280"]
  );
  const st = await get<Record<string, unknown>>("SELECT * FROM service_types ORDER BY id DESC LIMIT 1");
  return c.json(st!, 201);
});

const updateServiceType = createRoute({
  method: "put",
  path: "/api/service-types/{id}",
  request: {
    params: IdParam,
    body: {
      content: { "application/json": { schema: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        default_duration: z.number().int().optional(),
        default_price: z.number().optional(),
        color: z.string().optional(),
      }) } },
    },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(updateServiceType, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (fields.length > 0) {
    await run(`UPDATE service_types SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteServiceType = createRoute({
  method: "delete",
  path: "/api/service-types/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteServiceType, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM service_types WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Schedule (calendar view) ───────────────────────────────────────

const getSchedule = createRoute({
  method: "get",
  path: "/api/schedule",
  request: {
    query: z.object({
      start: z.string(),
      end: z.string(),
      technician_id: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Jobs within date range",
      content: { "application/json": { schema: z.object({ jobs: z.array(JobSchema) }) } },
    },
  },
});

app.openapi(getSchedule, async (c) => {
  const q = c.req.valid("query");
  let where = "WHERE j.scheduled_date >= ? AND j.scheduled_date <= ?";
  const params: unknown[] = [q.start, q.end];
  if (q.technician_id) {
    where += " AND j.technician_id = ?";
    params.push(q.technician_id);
  }
  const jobs = await query<Record<string, unknown>>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone,
       t.name as technician_name, t.color as technician_color,
       st.name as service_type_name, st.color as service_type_color
     FROM jobs j
     LEFT JOIN customers c ON j.customer_id = c.id
     LEFT JOIN technicians t ON j.technician_id = t.id
     LEFT JOIN service_types st ON j.service_type_id = st.id
     ${where}
     ORDER BY j.scheduled_date ASC, j.scheduled_time ASC`,
    params
  );
  return c.json({ jobs }, 200);
});

// ── Job Checklist ──────────────────────────────────────────────────

const addChecklistItem = createRoute({
  method: "post",
  path: "/api/jobs/{id}/checklist",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({ label: z.string() }) } } },
  },
  responses: {
    201: { description: "Added", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(addChecklistItem, async (c) => {
  const { id } = c.req.valid("param");
  const { label } = c.req.valid("json");
  const maxOrder = await get<{ m: number }>("SELECT COALESCE(MAX(sort_order), 0) as m FROM job_checklist WHERE job_id = ?", [id]);
  await run("INSERT INTO job_checklist (job_id, label, sort_order) VALUES (?, ?, ?)", [id, label, (maxOrder?.m || 0) + 1]);
  return c.json({ ok: true }, 201);
});

const toggleChecklistItem = createRoute({
  method: "put",
  path: "/api/checklist/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Toggled", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(toggleChecklistItem, async (c) => {
  const { id } = c.req.valid("param");
  await run("UPDATE job_checklist SET checked = CASE WHEN checked = 0 THEN 1 ELSE 0 END WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

const deleteChecklistItem = createRoute({
  method: "delete",
  path: "/api/checklist/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteChecklistItem, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM job_checklist WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Materials ──────────────────────────────────────────────────────

const listMaterials = createRoute({
  method: "get",
  path: "/api/materials",
  responses: {
    200: {
      description: "All materials",
      content: { "application/json": { schema: z.object({ materials: z.array(z.object({
        id: z.number().int(),
        name: z.string(),
        unit: z.string(),
        unit_cost: z.number(),
        in_stock: z.number(),
        created_at: z.string(),
      })) }) } },
    },
  },
});

app.openapi(listMaterials, async (c) => {
  const materials = await query<Record<string, unknown>>("SELECT * FROM materials ORDER BY name ASC");
  return c.json({ materials }, 200);
});

const createMaterial = createRoute({
  method: "post",
  path: "/api/materials",
  request: {
    body: { content: { "application/json": { schema: z.object({
      name: z.string(),
      unit: z.string().optional(),
      unit_cost: z.number().optional(),
      in_stock: z.number().optional(),
    }) } } },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(createMaterial, async (c) => {
  const data = c.req.valid("json");
  await run("INSERT INTO materials (name, unit, unit_cost, in_stock) VALUES (?, ?, ?, ?)",
    [data.name, data.unit || "ea", data.unit_cost || 0, data.in_stock || 0]);
  return c.json({ ok: true }, 201);
});

const updateMaterial = createRoute({
  method: "put",
  path: "/api/materials/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      name: z.string().optional(),
      unit: z.string().optional(),
      unit_cost: z.number().optional(),
      in_stock: z.number().optional(),
    }) } } },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(updateMaterial, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); }
  }
  if (fields.length > 0) await run(`UPDATE materials SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  return c.json({ ok: true }, 200);
});

const deleteMaterial = createRoute({
  method: "delete",
  path: "/api/materials/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteMaterial, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM materials WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Job Materials ──────────────────────────────────────────────────

const addJobMaterial = createRoute({
  method: "post",
  path: "/api/jobs/{id}/materials",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      material_id: z.number().int(),
      quantity: z.number(),
      unit_cost: z.number().optional(),
    }) } } },
  },
  responses: {
    201: { description: "Added", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(addJobMaterial, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  let cost = data.unit_cost;
  if (cost === undefined) {
    const mat = await get<{ unit_cost: number }>("SELECT unit_cost FROM materials WHERE id = ?", [data.material_id]);
    cost = mat?.unit_cost || 0;
  }
  await run("INSERT INTO job_materials (job_id, material_id, quantity, unit_cost) VALUES (?, ?, ?, ?)",
    [id, data.material_id, data.quantity, cost]);
  return c.json({ ok: true }, 201);
});

const deleteJobMaterial = createRoute({
  method: "delete",
  path: "/api/job-materials/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteJobMaterial, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM job_materials WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Invoices ───────────────────────────────────────────────────────

const listInvoices = createRoute({
  method: "get",
  path: "/api/invoices",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Paginated invoice list",
      content: { "application/json": { schema: z.object({
        invoices: z.array(z.any()),
        total: z.number().int(),
      }) } },
    },
  },
});

app.openapi(listInvoices, async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10);
  const limit = parseInt(q.limit || "50", 10);
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: unknown[] = [];
  if (q.status) { where += " AND i.status = ?"; params.push(q.status); }
  if (q.search) {
    where += " AND (i.identifier LIKE ? OR c.name LIKE ?)";
    const s = `%${q.search}%`;
    params.push(s, s);
  }

  const countRow = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id ${where}`, params
  );
  const invoices = await query<Record<string, unknown>>(
    `SELECT i.*, c.name as customer_name, j.identifier as job_identifier
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN jobs j ON i.job_id = j.id
     ${where}
     ORDER BY i.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return c.json({ invoices, total: countRow?.count || 0 }, 200);
});

const getInvoice = createRoute({
  method: "get",
  path: "/api/invoices/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Invoice detail", content: { "application/json": { schema: z.object({ invoice: z.any() }) } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getInvoice, async (c) => {
  const { id } = c.req.valid("param");
  const invoice = await get<Record<string, unknown>>(
    `SELECT i.*, c.name as customer_name, j.identifier as job_identifier
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN jobs j ON i.job_id = j.id
     WHERE i.id = ?`, [id]
  );
  if (!invoice) return c.json({ error: "Invoice not found" }, 404);
  const lines = await query<Record<string, unknown>>(
    "SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY id ASC", [id]
  );
  return c.json({ invoice: { ...invoice, lines } }, 200);
});

const createInvoice = createRoute({
  method: "post",
  path: "/api/invoices",
  request: {
    body: { content: { "application/json": { schema: z.object({
      customer_id: z.number().int(),
      job_id: z.number().int().nullable().optional(),
      tax_rate: z.number().optional(),
      notes: z.string().optional(),
      due_date: z.string().optional(),
      lines: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unit_price: z.number(),
      })),
    }) } } },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: z.any() } } },
  },
});

app.openapi(createInvoice, async (c) => {
  const data = c.req.valid("json");
  const identifier = await nextInvoiceIdentifier();
  const taxRate = data.tax_rate || 0;

  let subtotal = 0;
  for (const line of data.lines) {
    subtotal += line.quantity * line.unit_price;
  }
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  await run(
    `INSERT INTO invoices (identifier, customer_id, job_id, status, subtotal, tax_rate, tax_amount, total, notes, due_date)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
    [identifier, data.customer_id, data.job_id ?? null,
    subtotal, taxRate, taxAmount, total,
    data.notes || "", data.due_date || ""]
  );

  const invoice = await get<{ id: number }>("SELECT id FROM invoices WHERE identifier = ?", [identifier]);
  for (const line of data.lines) {
    const lineTotal = line.quantity * line.unit_price;
    await run(
      "INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)",
      [invoice!.id, line.description, line.quantity, line.unit_price, lineTotal]
    );
  }

  const result = await get<Record<string, unknown>>(
    `SELECT i.*, c.name as customer_name FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?`, [invoice!.id]
  );
  return c.json(result!, 201);
});

const updateInvoice = createRoute({
  method: "put",
  path: "/api/invoices/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      status: z.string().optional(),
      notes: z.string().optional(),
      due_date: z.string().optional(),
      paid_date: z.string().optional(),
    }) } } },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(updateInvoice, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); }
  }
  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    await run(`UPDATE invoices SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteInvoice = createRoute({
  method: "delete",
  path: "/api/invoices/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } },
  },
});

app.openapi(deleteInvoice, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM invoices WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Create invoice from job ────────────────────────────────────────

const invoiceFromJob = createRoute({
  method: "post",
  path: "/api/jobs/{id}/invoice",
  request: { params: IdParam },
  responses: {
    201: { description: "Invoice created from job", content: { "application/json": { schema: z.any() } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(invoiceFromJob, async (c) => {
  const { id } = c.req.valid("param");
  const job = await get<Record<string, unknown>>(
    `SELECT j.*, st.name as service_type_name FROM jobs j
     LEFT JOIN service_types st ON j.service_type_id = st.id WHERE j.id = ?`, [id]
  );
  if (!job) return c.json({ error: "Job not found" }, 404);

  const identifier = await nextInvoiceIdentifier();
  const price = job.price as number;

  // Gather materials used
  const mats = await query<Record<string, unknown>>(
    `SELECT jm.*, m.name as material_name FROM job_materials jm
     LEFT JOIN materials m ON jm.material_id = m.id WHERE jm.job_id = ?`, [id]
  );

  let subtotal = price;
  const lines: { description: string; quantity: number; unit_price: number; total: number }[] = [
    { description: (job.service_type_name as string) || "Service", quantity: 1, unit_price: price, total: price },
  ];
  for (const m of mats) {
    const lineTotal = (m.quantity as number) * (m.unit_cost as number);
    lines.push({
      description: m.material_name as string,
      quantity: m.quantity as number,
      unit_price: m.unit_cost as number,
      total: lineTotal,
    });
    subtotal += lineTotal;
  }

  await run(
    `INSERT INTO invoices (identifier, customer_id, job_id, status, subtotal, tax_rate, tax_amount, total, notes, due_date)
     VALUES (?, ?, ?, 'draft', ?, 0, 0, ?, '', '')`,
    [identifier, job.customer_id, job.id, subtotal, subtotal]
  );

  const inv = await get<{ id: number }>("SELECT id FROM invoices WHERE identifier = ?", [identifier]);
  for (const line of lines) {
    await run(
      "INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)",
      [inv!.id, line.description, line.quantity, line.unit_price, line.total]
    );
  }

  return c.json({ ok: true, invoice_id: inv!.id }, 201);
});

// ── Quotes ─────────────────────────────────────────────────────────

const QuoteLineSchema = z.object({
  id: z.number().int(),
  quote_id: z.number().int(),
  description: z.string(),
  kind: z.string(),
  material_id: z.number().int().nullable(),
  supplier_product_id: z.number().int().nullable(),
  quantity: z.number(),
  cost_at_time: z.number(),
  unit_price: z.number(),
  total: z.number(),
  sort_order: z.number().int(),
}).openapi("QuoteLine");

const QuoteSchema = z.object({
  id: z.number().int(),
  identifier: z.string(),
  customer_id: z.number().int(),
  job_id: z.number().int().nullable(),
  status: z.string(),
  title: z.string(),
  subtotal: z.number(),
  cost_total: z.number(),
  margin_amount: z.number(),
  margin_pct: z.number(),
  tax_rate: z.number(),
  tax_amount: z.number(),
  total: z.number(),
  risk_level: z.string(),
  notes: z.string(),
  valid_until: z.string(),
  sent_at: z.string(),
  approved_at: z.string(),
  customer_name: z.string().optional(),
  lines: z.array(QuoteLineSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi("Quote");

async function nextQuoteIdentifier(): Promise<string> {
  const prefix = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'quote_prefix'");
  const counter = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'quote_counter'");
  const next = parseInt(counter?.value || "0", 10) + 1;
  await run("UPDATE _meta SET value = ? WHERE key = 'quote_counter'", [String(next)]);
  return `${prefix?.value || "QTE"}-${next}`;
}

const listQuotes = createRoute({
  method: "get",
  path: "/api/quotes",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Paginated quote list",
      content: { "application/json": { schema: z.object({ quotes: z.array(QuoteSchema), total: z.number().int() }) } },
    },
  },
});

app.openapi(listQuotes, async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10);
  const limit = parseInt(q.limit || "50", 10);
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: unknown[] = [];
  if (q.status) { where += " AND qt.status = ?"; params.push(q.status); }
  if (q.search) {
    where += " AND (qt.identifier LIKE ? OR qt.title LIKE ? OR c.name LIKE ?)";
    const s = `%${q.search}%`;
    params.push(s, s, s);
  }

  const countRow = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM quotes qt LEFT JOIN customers c ON qt.customer_id = c.id ${where}`, params
  );
  const quotes = await query<Record<string, unknown>>(
    `SELECT qt.*, c.name as customer_name FROM quotes qt
     LEFT JOIN customers c ON qt.customer_id = c.id
     ${where}
     ORDER BY qt.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return c.json({ quotes, total: countRow?.count || 0 }, 200);
});

const getQuote = createRoute({
  method: "get",
  path: "/api/quotes/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Quote detail", content: { "application/json": { schema: z.object({ quote: QuoteSchema }) } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getQuote, async (c) => {
  const { id } = c.req.valid("param");
  const quote = await get<Record<string, unknown>>(
    `SELECT qt.*, c.name as customer_name FROM quotes qt
     LEFT JOIN customers c ON qt.customer_id = c.id WHERE qt.id = ?`, [id]
  );
  if (!quote) return c.json({ error: "Quote not found" }, 404);
  const lines = await query<Record<string, unknown>>(
    "SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY sort_order ASC, id ASC", [id]
  );
  return c.json({ quote: { ...quote, lines } }, 200);
});

const createQuote = createRoute({
  method: "post",
  path: "/api/quotes",
  request: {
    body: { content: { "application/json": { schema: z.object({
      customer_id: z.number().int(),
      job_id: z.number().int().nullable().optional(),
      title: z.string().optional(),
      tax_rate: z.number().optional(),
      risk_level: z.string().optional(),
      notes: z.string().optional(),
      valid_until: z.string().optional(),
      lines: z.array(z.object({
        description: z.string(),
        kind: z.string().optional(),
        material_id: z.number().int().nullable().optional(),
        supplier_product_id: z.number().int().nullable().optional(),
        quantity: z.number(),
        cost_at_time: z.number().optional(),
        unit_price: z.number(),
      })).default([]),
    }) } } },
  },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: QuoteSchema } } },
  },
});

app.openapi(createQuote, async (c) => {
  const data = c.req.valid("json");
  const identifier = await nextQuoteIdentifier();
  const taxRate = data.tax_rate ?? 0;

  // Resolve a locked cost for each line: explicit cost_at_time wins, else look
  // up the current supplier/material cost NOW so later price changes never move
  // this quote (historical price lock).
  const resolved: { description: string; kind: string; material_id: number | null; supplier_product_id: number | null; quantity: number; cost_at_time: number; unit_price: number; total: number }[] = [];
  for (const line of data.lines) {
    let cost = line.cost_at_time ?? 0;
    if (line.cost_at_time === undefined) {
      if (line.supplier_product_id) {
        const sp = await get<{ current_price: number }>("SELECT current_price FROM supplier_products WHERE id = ?", [line.supplier_product_id]);
        if (sp) cost = sp.current_price;
      } else if (line.material_id) {
        const m = await get<{ unit_cost: number }>("SELECT unit_cost FROM materials WHERE id = ?", [line.material_id]);
        if (m) cost = m.unit_cost;
      }
    }
    resolved.push({
      description: line.description,
      kind: line.kind || "labor",
      material_id: line.material_id ?? null,
      supplier_product_id: line.supplier_product_id ?? null,
      quantity: line.quantity,
      cost_at_time: cost,
      unit_price: line.unit_price,
      total: line.quantity * line.unit_price,
    });
  }

  const subtotal = resolved.reduce((s, l) => s + l.total, 0);
  const costTotal = resolved.reduce((s, l) => s + l.cost_at_time * l.quantity, 0);
  const marginAmount = subtotal - costTotal;
  const marginPct = subtotal > 0 ? (marginAmount / subtotal) * 100 : 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  await run(
    `INSERT INTO quotes (identifier, customer_id, job_id, status, title, subtotal, cost_total,
       margin_amount, margin_pct, tax_rate, tax_amount, total, risk_level, notes, valid_until)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [identifier, data.customer_id, data.job_id ?? null, data.title || "",
     subtotal, costTotal, marginAmount, Math.round(marginPct * 10) / 10,
     taxRate, taxAmount, total, data.risk_level || "low", data.notes || "", data.valid_until || ""]
  );

  const created = await get<{ id: number }>("SELECT id FROM quotes WHERE identifier = ?", [identifier]);
  let sort = 0;
  for (const l of resolved) {
    await run(
      `INSERT INTO quote_lines (quote_id, description, kind, material_id, supplier_product_id, quantity, cost_at_time, unit_price, total, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [created!.id, l.description, l.kind, l.material_id, l.supplier_product_id, l.quantity, l.cost_at_time, l.unit_price, l.total, sort++]
    );
  }

  const result = await get<Record<string, unknown>>(
    `SELECT qt.*, c.name as customer_name FROM quotes qt
     LEFT JOIN customers c ON qt.customer_id = c.id WHERE qt.id = ?`, [created!.id]
  );
  return c.json(result!, 201);
});

const updateQuote = createRoute({
  method: "put",
  path: "/api/quotes/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({
      status: z.string().optional(),
      title: z.string().optional(),
      risk_level: z.string().optional(),
      notes: z.string().optional(),
      valid_until: z.string().optional(),
      sent_at: z.string().optional(),
      approved_at: z.string().optional(),
      job_id: z.number().int().nullable().optional(),
    }) } } },
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(updateQuote, async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const existing = await get<{ id: number }>("SELECT id FROM quotes WHERE id = ?", [id]);
  if (!existing) return c.json({ error: "Quote not found" }, 404);
  const fields: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); }
  }
  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    await run(`UPDATE quotes SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  }
  return c.json({ ok: true }, 200);
});

const deleteQuote = createRoute({
  method: "delete",
  path: "/api/quotes/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(deleteQuote, async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM quotes WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// Create a job from an approved quote and link them (or return the existing link).
const quoteToJob = createRoute({
  method: "post",
  path: "/api/quotes/{id}/job",
  request: { params: IdParam },
  responses: {
    201: { description: "Job created from quote", content: { "application/json": { schema: z.any() } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(quoteToJob, async (c) => {
  const { id } = c.req.valid("param");
  const quote = await get<Record<string, unknown>>("SELECT * FROM quotes WHERE id = ?", [id]);
  if (!quote) return c.json({ error: "Quote not found" }, 404);
  if (quote.job_id) return c.json({ ok: true, job_id: quote.job_id, already_linked: true }, 201);

  const identifier = await nextIdentifier();
  const today = new Date().toISOString().split("T")[0];
  const cust = await get<{ address: string; city: string; state: string; zip: string }>(
    "SELECT address, city, state, zip FROM customers WHERE id = ?", [quote.customer_id]
  );
  const address = cust ? [cust.address, cust.city, cust.state, cust.zip].filter(Boolean).join(", ") : "";
  const noteParts = [`From quote ${quote.identifier as string}`, (quote.title as string) || ""].filter(Boolean);

  await run(
    `INSERT INTO jobs (identifier, customer_id, technician_id, service_type_id, status, priority,
       scheduled_date, scheduled_time, duration, price, address, notes, is_recurring, recurrence_interval)
     VALUES (?, ?, NULL, NULL, 'scheduled', 'normal', ?, '09:00', 60, ?, ?, ?, 0, '')`,
    [identifier, quote.customer_id, today, quote.subtotal, address, noteParts.join(": ")]
  );
  const job = await get<{ id: number }>("SELECT id FROM jobs WHERE identifier = ?", [identifier]);
  await run("UPDATE quotes SET job_id = ?, updated_at = datetime('now') WHERE id = ?", [job!.id, id]);
  return c.json({ ok: true, job_id: job!.id, identifier }, 201);
});

// ── Supplier Pricing ───────────────────────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/supplier-sources",
  responses: { 200: { description: "Sources", content: { "application/json": { schema: z.object({ sources: z.array(z.any()) }) } } } },
}), async (c) => {
  const sources = await query<Record<string, unknown>>("SELECT * FROM supplier_sources ORDER BY name ASC");
  return c.json({ sources }, 200);
});

app.openapi(createRoute({
  method: "get", path: "/api/supplier-products",
  request: { query: z.object({ source_id: z.string().optional(), search: z.string().optional() }) },
  responses: { 200: { description: "Products", content: { "application/json": { schema: z.object({ products: z.array(z.any()) }) } } } },
}), async (c) => {
  const q = c.req.valid("query");
  let where = "WHERE 1=1"; const params: unknown[] = [];
  if (q.source_id) { where += " AND p.source_id = ?"; params.push(q.source_id); }
  if (q.search) { where += " AND (p.name LIKE ? OR p.sku LIKE ?)"; const s = `%${q.search}%`; params.push(s, s); }
  const products = await query<Record<string, unknown>>(
    `SELECT p.*, s.name as source_name,
       (SELECT price FROM supplier_price_history WHERE product_id = p.id ORDER BY recorded_at DESC LIMIT 1 OFFSET 1) as prev_price
     FROM supplier_products p LEFT JOIN supplier_sources s ON p.source_id = s.id ${where} ORDER BY p.name ASC`,
    params
  );
  return c.json({ products }, 200);
});

app.openapi(createRoute({
  method: "post", path: "/api/supplier-sources",
  request: { body: { content: { "application/json": { schema: z.object({
    name: z.string(), website: z.string().optional(), contact_email: z.string().optional(), notes: z.string().optional(),
  }) } } } },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const data = c.req.valid("json");
  await run("INSERT INTO supplier_sources (name, website, contact_email, notes) VALUES (?,?,?,?)",
    [data.name, data.website ?? "", data.contact_email ?? "", data.notes ?? ""]);
  const source = await get<Record<string, unknown>>("SELECT * FROM supplier_sources ORDER BY id DESC LIMIT 1");
  return c.json(source!, 201);
});

app.openapi(createRoute({
  method: "patch", path: "/api/supplier-sources/{id}",
  request: { params: IdParam, body: { content: { "application/json": { schema: z.object({ active: z.number().int().optional(), name: z.string().optional(), website: z.string().optional(), contact_email: z.string().optional(), notes: z.string().optional() }) } } } },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
}), async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const fields: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); } }
  if (fields.length > 0) await run(`UPDATE supplier_sources SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  return c.json({ ok: true }, 200);
});

app.openapi(createRoute({
  method: "delete", path: "/api/supplier-sources/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
}), async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM supplier_sources WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

app.openapi(createRoute({
  method: "post", path: "/api/supplier-products",
  request: { body: { content: { "application/json": { schema: z.object({
    source_id: z.number().int(), name: z.string(), sku: z.string().optional(),
    unit: z.string().optional(), current_price: z.number().optional(),
  }) } } } },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const data = c.req.valid("json");
  const price = data.current_price ?? 0;
  await run("INSERT INTO supplier_products (source_id, name, sku, unit, current_price) VALUES (?,?,?,?,?)",
    [data.source_id, data.name, data.sku ?? "", data.unit ?? "ea", price]);
  const product = await get<Record<string, unknown>>("SELECT * FROM supplier_products ORDER BY id DESC LIMIT 1");
  if (product && price > 0) {
    const userEmail = (c.get("user")?.email as string) ?? "";
    await run("INSERT INTO supplier_price_history (product_id, price, event_type, user_email) VALUES (?,?,?,?)",
      [product.id, price, "changed", userEmail]);
  }
  return c.json(product!, 201);
});

app.openapi(createRoute({
  method: "get", path: "/api/supplier-products/{id}/history",
  request: { params: IdParam },
  responses: { 200: { description: "Price history", content: { "application/json": { schema: z.object({ history: z.array(z.any()) }) } } } },
}), async (c) => {
  const { id } = c.req.valid("param");
  const history = await query<Record<string, unknown>>(
    "SELECT * FROM supplier_price_history WHERE product_id = ? ORDER BY recorded_at DESC LIMIT 90", [id]
  );
  return c.json({ history }, 200);
});

app.openapi(createRoute({
  method: "post", path: "/api/supplier-products/{id}/price",
  request: { params: IdParam, body: { content: { "application/json": { schema: z.object({ price: z.number(), event_type: z.enum(["checked", "changed"]).optional() }) } } } },
  responses: { 201: { description: "Price recorded", content: { "application/json": { schema: OkSchema } } } },
}), async (c) => {
  const { id } = c.req.valid("param");
  const { price, event_type } = c.req.valid("json");
  const userEmail = (c.get("user")?.email as string) ?? "";
  await run("INSERT INTO supplier_price_history (product_id, price, event_type, user_email) VALUES (?,?,?,?)",
    [id, price, event_type ?? "changed", userEmail]);
  await run("UPDATE supplier_products SET current_price = ?, last_checked = datetime('now') WHERE id = ?", [price, id]);
  return c.json({ ok: true }, 201);
});

app.openapi(createRoute({
  method: "delete", path: "/api/supplier-products/{id}",
  request: { params: IdParam },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: OkSchema } } } },
}), async (c) => {
  const { id } = c.req.valid("param");
  await run("DELETE FROM supplier_products WHERE id = ?", [id]);
  return c.json({ ok: true }, 200);
});

// ── Receptionist ───────────────────────────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/receptionist/calls",
  request: { query: z.object({ page: z.string().optional(), limit: z.string().optional() }) },
  responses: { 200: { description: "Calls", content: { "application/json": { schema: z.object({ calls: z.array(z.any()), total: z.number().int() }) } } } },
}), async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10); const limit = parseInt(q.limit || "50", 10); const offset = (page - 1) * limit;
  const countRow = await get<{ count: number }>("SELECT COUNT(*) as count FROM receptionist_calls");
  const calls = await query<Record<string, unknown>>(
    `SELECT rc.*, c.name as customer_name, j.identifier as job_identifier,
            aa.output_summary as ai_output_summary, aa.action as ai_action_name, aa.model as ai_model
     FROM receptionist_calls rc
     LEFT JOIN customers c ON rc.customer_id = c.id
     LEFT JOIN jobs j ON rc.job_id = j.id
     LEFT JOIN ai_activity aa ON aa.id = (
       SELECT id FROM ai_activity
       WHERE module = 'receptionist'
         AND abs(strftime('%s', created_at) - strftime('%s', rc.created_at)) <= 60
       ORDER BY abs(strftime('%s', created_at) - strftime('%s', rc.created_at))
       LIMIT 1
     )
     ORDER BY rc.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return c.json({ calls, total: countRow?.count || 0 }, 200);
});

app.openapi(createRoute({
  method: "post", path: "/api/receptionist/calls",
  request: { body: { content: { "application/json": { schema: z.object({
    caller_name: z.string(), caller_phone: z.string(), summary: z.string(),
    action: z.string(), customer_id: z.number().int().nullable().optional(),
    job_id: z.number().int().nullable().optional(), duration_secs: z.number().int().optional(),
  }) } } } },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const data = c.req.valid("json");
  await run("INSERT INTO receptionist_calls (caller_name, caller_phone, summary, action, customer_id, job_id, duration_secs) VALUES (?,?,?,?,?,?,?)",
    [data.caller_name, data.caller_phone, data.summary, data.action, data.customer_id ?? null, data.job_id ?? null, data.duration_secs ?? 0]);
  const call = await get<Record<string, unknown>>("SELECT * FROM receptionist_calls ORDER BY id DESC LIMIT 1");
  return c.json(call!, 201);
});

app.openapi(createRoute({
  method: "patch", path: "/api/receptionist/calls/:id",
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: z.object({ action: z.string() }) } } },
  },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const { action } = c.req.valid("json");
  await run("UPDATE receptionist_calls SET action = ? WHERE id = ?", [action, id]);
  const call = await get<Record<string, unknown>>(
    `SELECT rc.*, c.name as customer_name, j.identifier as job_identifier
     FROM receptionist_calls rc
     LEFT JOIN customers c ON rc.customer_id = c.id
     LEFT JOIN jobs j ON rc.job_id = j.id
     WHERE rc.id = ?`,
    [id]
  );
  if (!call) return c.json({ error: "Not found" }, 404 as any);
  return c.json(call, 200);
});

// ── Receptionist aliases (/api/receptionist-calls) ─────────────────
app.openapi(createRoute({
  method: "get", path: "/api/receptionist-calls",
  request: { query: z.object({ page: z.string().optional(), limit: z.string().optional() }) },
  responses: { 200: { description: "Calls", content: { "application/json": { schema: z.object({ calls: z.array(z.any()), total: z.number().int() }) } } } },
}), async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10); const limit = parseInt(q.limit || "50", 10); const offset = (page - 1) * limit;
  const countRow = await get<{ count: number }>("SELECT COUNT(*) as count FROM receptionist_calls");
  const calls = await query<Record<string, unknown>>(
    `SELECT rc.*, c.name as customer_name, j.identifier as job_identifier,
            aa.output_summary as ai_output_summary, aa.action as ai_action_name, aa.model as ai_model
     FROM receptionist_calls rc
     LEFT JOIN customers c ON rc.customer_id = c.id
     LEFT JOIN jobs j ON rc.job_id = j.id
     LEFT JOIN ai_activity aa ON aa.id = (
       SELECT id FROM ai_activity
       WHERE module = 'receptionist'
         AND abs(strftime('%s', created_at) - strftime('%s', rc.created_at)) <= 60
       ORDER BY abs(strftime('%s', created_at) - strftime('%s', rc.created_at))
       LIMIT 1
     )
     ORDER BY rc.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return c.json({ calls, total: countRow?.count || 0 }, 200);
});

app.openapi(createRoute({
  method: "post", path: "/api/receptionist-calls",
  request: { body: { content: { "application/json": { schema: z.object({
    caller_name: z.string(), caller_phone: z.string(), summary: z.string(),
    action: z.string(), customer_id: z.number().int().nullable().optional(),
    job_id: z.number().int().nullable().optional(), duration_secs: z.number().int().optional(),
  }) } } } },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const data = c.req.valid("json");
  await run("INSERT INTO receptionist_calls (caller_name, caller_phone, summary, action, customer_id, job_id, duration_secs) VALUES (?,?,?,?,?,?,?)",
    [data.caller_name, data.caller_phone, data.summary, data.action, data.customer_id ?? null, data.job_id ?? null, data.duration_secs ?? 0]);
  const call = await get<Record<string, unknown>>("SELECT * FROM receptionist_calls ORDER BY id DESC LIMIT 1");
  return c.json(call!, 201);
});

// ── Inbox ──────────────────────────────────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/inbox",
  request: { query: z.object({ page: z.string().optional(), limit: z.string().optional(), status: z.string().optional(), source: z.string().optional() }) },
  responses: { 200: { description: "Inbox items", content: { "application/json": { schema: z.object({ items: z.array(z.any()), total: z.number().int() }) } } } },
}), async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10); const limit = parseInt(q.limit || "50", 10); const offset = (page - 1) * limit;
  let where = "WHERE i.thread_id IS NULL"; const params: unknown[] = [];
  if (q.status) { where += " AND i.status = ?"; params.push(q.status); }
  if (q.source) { where += " AND i.source = ?"; params.push(q.source); }
  const countRow = await get<{ count: number }>(`SELECT COUNT(*) as count FROM inbox_items i ${where}`, params);
  const items = await query<Record<string, unknown>>(
    `SELECT i.*, c.name as customer_name,
       (SELECT COUNT(*) FROM inbox_items r WHERE r.thread_id = i.id) as reply_count,
       (SELECT COUNT(*) FROM inbox_items r WHERE r.thread_id = i.id AND r.status = 'unread') as unread_replies,
       COALESCE((SELECT MAX(r.created_at) FROM inbox_items r WHERE r.thread_id = i.id), i.created_at) as latest_at
     FROM inbox_items i
     LEFT JOIN customers c ON i.customer_id = c.id
     ${where}
     ORDER BY latest_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return c.json({ items, total: countRow?.count || 0 }, 200);
});

app.openapi(createRoute({
  method: "put", path: "/api/inbox/{id}",
  request: { params: IdParam, body: { content: { "application/json": { schema: z.object({ status: z.string().optional(), customer_id: z.number().int().nullable().optional() }) } } } },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
}), async (c) => {
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const fields: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); } }
  if (fields.length > 0) await run(`UPDATE inbox_items SET ${fields.join(", ")} WHERE id = ?`, [...vals, id]);
  return c.json({ ok: true }, 200);
});

app.openapi(createRoute({
  method: "post", path: "/api/inbox",
  request: { body: { content: { "application/json": { schema: z.object({ source: z.string(), subject: z.string(), body: z.string(), sender: z.string(), customer_id: z.number().int().nullable().optional(), thread_id: z.number().int().nullable().optional() }) } } } },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ id: z.number().int() }) } } } },
}), async (c) => {
  const data = c.req.valid("json");
  await run(
    `INSERT INTO inbox_items (source, subject, body, sender, status, customer_id, thread_id) VALUES (?, ?, ?, ?, 'actioned', ?, ?)`,
    [data.source, data.subject, data.body, data.sender, data.customer_id ?? null, data.thread_id ?? null]
  );
  const row = await get<{ id: number }>("SELECT last_insert_rowid() as id");
  return c.json({ id: row!.id }, 201);
});

app.openapi(createRoute({
  method: "get", path: "/api/inbox/{id}/thread",
  request: { params: IdParam },
  responses: { 200: { description: "Thread messages", content: { "application/json": { schema: z.object({ items: z.array(z.any()) }) } } } },
}), async (c) => {
  const { id } = c.req.valid("param");
  const items = await query<Record<string, unknown>>(
    `SELECT i.*, c.name as customer_name
     FROM inbox_items i
     LEFT JOIN customers c ON i.customer_id = c.id
     WHERE i.id = ? OR i.thread_id = ?
     ORDER BY i.created_at ASC`,
    [id, id]
  );
  return c.json({ items }, 200);
});

// ── AI ─────────────────────────────────────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/ai/activity",
  request: { query: z.object({ page: z.string().optional(), limit: z.string().optional(), module: z.string().optional() }) },
  responses: { 200: { description: "AI activity", content: { "application/json": { schema: z.object({ activity: z.array(z.any()), total: z.number().int() }) } } } },
}), async (c) => {
  const q = c.req.valid("query");
  const page = parseInt(q.page || "1", 10); const limit = parseInt(q.limit || "50", 10); const offset = (page - 1) * limit;
  let where = "WHERE 1=1"; const params: unknown[] = [];
  if (q.module) { where += " AND module = ?"; params.push(q.module); }
  const countRow = await get<{ count: number }>(`SELECT COUNT(*) as count FROM ai_activity ${where}`, params);
  const activity = await query<Record<string, unknown>>(
    `SELECT * FROM ai_activity ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]
  );
  return c.json({ activity, total: countRow?.count || 0 }, 200);
});

app.openapi(createRoute({
  method: "post", path: "/api/ai/assistant",
  request: { body: { content: { "application/json": { schema: z.object({ prompt: z.string(), system: z.string().optional() }) } } } },
  responses: {
    200: { description: "AI response", content: { "application/json": { schema: z.object({ text: z.string(), source: z.string() }) } } },
    500: { description: "AI error", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const { prompt, system } = c.req.valid("json");
  const modelRow = await get<{ ai_model: string }>("SELECT ai_model FROM settings WHERE id = 1");
  const activeModel = modelRow?.ai_model ?? DEFAULT_MODEL;
  const t0 = Date.now();
  let result: { text: string; source: string };
  try {
    result = await aiComplete(c.env, {
      system: system ?? "You are Travis, an AI assistant for a field service business. Answer questions about jobs, customers, quotes, and invoices concisely.",
      prompt,
      model: activeModel,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
  const duration_ms = Date.now() - t0;
  await run(
    "INSERT INTO ai_activity (module, action, input_summary, output_summary, model, tokens_used, duration_ms) VALUES (?,?,?,?,?,?,?)",
    ["assistant", "answer_question", prompt.slice(0, 200), result.text.slice(0, 200), result.source === "openrouter" ? activeModel : "mock", 0, duration_ms]
  );
  return c.json(result, 200);
});

app.openapi(createRoute({
  method: "post", path: "/api/ai/quote-draft",
  request: { body: { content: { "application/json": { schema: z.object({ description: z.string() }) } } } },
  responses: {
    200: { description: "Draft lines", content: { "application/json": { schema: z.object({ lines: z.array(z.object({ description: z.string(), quantity: z.number(), unit_price: z.number() })), source: z.string() }) } } },
    500: { description: "AI error", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const { description } = c.req.valid("json");

  // Mock fallback — plausible trades lines regardless of keywords
  if (c.env.MOCK_AI === "1" || !c.env.OPENROUTER_API_KEY) {
    const lines = [
      { description: "Service call — diagnosis and assessment", quantity: 1, unit_price: 120.00 },
      { description: "Labour — repair and installation", quantity: 2, unit_price: 95.00 },
      { description: "Parts and materials (as required)", quantity: 1, unit_price: 85.00 },
    ];
    await run(
      "INSERT INTO ai_activity (module, action, input_summary, output_summary, model, tokens_used, duration_ms) VALUES (?,?,?,?,?,?,?)",
      ["quote_draft", "draft_lines", description.slice(0, 200), `${lines.length} lines`, "mock", 0, 0]
    );
    return c.json({ lines, source: "mock" }, 200);
  }

  const qModelRow = await get<{ ai_model: string }>("SELECT ai_model FROM settings WHERE id = 1");
  const activeModel = qModelRow?.ai_model ?? DEFAULT_MODEL;
  const t0 = Date.now();
  let result: { text: string; source: string };
  try {
    result = await aiComplete(c.env, {
      system: "You are a quoting assistant for a trades and field service business. When given a job description, respond with ONLY a JSON array of 2–5 line items. Each item must have exactly these fields: description (string), quantity (number), unit_price (number in dollars). No markdown, no prose, no code fences — just the raw JSON array.",
      prompt: description,
      model: activeModel,
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
  const duration_ms = Date.now() - t0;

  // Parse — strip markdown fences if present then extract JSON array
  const cleaned = result.text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return c.json({ error: "AI returned an unexpected format. Please try again." }, 500);
  }
  let lines: { description: string; quantity: number; unit_price: number }[];
  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    lines = parsed
      .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
      .map(l => ({
        description: String(l.description ?? ""),
        quantity: Number(l.quantity ?? 1),
        unit_price: Number(l.unit_price ?? 0),
      }))
      .filter(l => l.description.length > 0);
  } catch {
    return c.json({ error: "Could not parse AI response as line items. Please try again." }, 500);
  }

  await run(
    "INSERT INTO ai_activity (module, action, input_summary, output_summary, model, tokens_used, duration_ms) VALUES (?,?,?,?,?,?,?)",
    ["quote_draft", "draft_lines", description.slice(0, 200), `${lines.length} lines`, activeModel, 0, duration_ms]
  );
  return c.json({ lines, source: result.source }, 200);
});

// ── Reports ────────────────────────────────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/reports/summary",
  request: { query: z.object({ date_from: z.string().optional(), date_to: z.string().optional(), range: z.enum(["this_week", "this_month", "all_time"]).optional() }) },
  responses: { 200: { description: "Report summary", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const q = c.req.valid("query");
  const df = q.date_from; const dt = q.date_to ? q.date_to + " 23:59:59" : undefined;
  const dp = (alias: string): [string, unknown[]] => {
    const parts: string[] = []; const vals: unknown[] = [];
    if (df) { parts.push(`${alias}.created_at >= ?`); vals.push(df); }
    if (dt) { parts.push(`${alias}.created_at <= ?`); vals.push(dt); }
    return [parts.length ? " AND " + parts.join(" AND ") : "", vals];
  };
  const [idf, idv] = dp("i"); const [jdf, jdv] = dp("j"); const [qdf, qdv] = dp("qt");
  const [revTotal, revPaid, revOutstanding, revOverdue, jobsTotal, jobsDone, jobsSched, qtTotal, qtAccepted, qtPipeline, qtPipelineDraft, qtPipelineSent, topTechs] = await Promise.all([
    get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM invoices i WHERE i.status != 'cancelled'${idf}`, idv),
    get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM invoices i WHERE i.status = 'paid'${idf}`, idv),
    get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM invoices i WHERE i.status IN ('sent')${idf}`, idv),
    get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM invoices i WHERE i.status = 'overdue'${idf}`, idv),
    get<{ v: number }>(`SELECT COUNT(*) as v FROM jobs j WHERE 1=1${jdf}`, jdv),
    get<{ v: number }>(`SELECT COUNT(*) as v FROM jobs j WHERE j.status = 'completed'${jdf}`, jdv),
    get<{ v: number }>(`SELECT COUNT(*) as v FROM jobs j WHERE j.status IN ('scheduled','confirmed')${jdf}`, jdv),
    get<{ v: number }>(`SELECT COUNT(*) as v FROM quotes qt WHERE 1=1${qdf}`, qdv),
    get<{ v: number }>(`SELECT COUNT(*) as v FROM quotes qt WHERE qt.status = 'accepted'${qdf}`, qdv),
    get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM quotes qt WHERE qt.status IN ('draft','sent')${qdf}`, qdv),
    get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM quotes qt WHERE qt.status = 'draft'${qdf}`, qdv),
    get<{ v: number }>(`SELECT COALESCE(SUM(total),0) as v FROM quotes qt WHERE qt.status = 'sent'${qdf}`, qdv),
    query<Record<string, unknown>>(
      `SELECT j.technician_id, t.name, COUNT(*) as jobs_completed, COALESCE(SUM(j.price),0) as revenue
       FROM jobs j JOIN technicians t ON j.technician_id = t.id WHERE j.status = 'completed'${jdf}
       GROUP BY j.technician_id ORDER BY jobs_completed DESC LIMIT 5`,
      jdv
    ),
  ]);

  // Compute prior-period bounds — mirrors the calendar-aware logic in /api/reports/trend
  let priorPaidRow: { v: number } | null = null;
  let priorOutstandingRow: { v: number } | null = null;
  let priorOverdueRow: { v: number } | null = null;
  if (q.range) {
    const todayStr = new Date().toISOString().split("T")[0];
    const currentFrom = df ?? `${new Date().getFullYear()}-01-01`;
    const currentTo = q.date_to ?? todayStr;
    let priorFrom: string;
    let priorTo: string;
    if (q.range === "this_week") {
      const shiftMs = 7 * 86_400_000;
      priorFrom = new Date(new Date(currentFrom).getTime() - shiftMs).toISOString().split("T")[0];
      priorTo = new Date(new Date(currentTo).getTime() - shiftMs).toISOString().split("T")[0];
    } else if (q.range === "this_month") {
      const [cy, cm] = currentFrom.split("-").map(Number);
      const priorMonth = cm === 1 ? 12 : cm - 1;
      const priorYear = cm === 1 ? cy - 1 : cy;
      const todayDay = parseInt(currentTo.split("-")[2], 10);
      const lastDayOfPrior = new Date(Date.UTC(priorYear, priorMonth, 0)).getUTCDate();
      const clampedDay = Math.min(todayDay, lastDayOfPrior);
      priorFrom = `${priorYear}-${String(priorMonth).padStart(2, "0")}-01`;
      priorTo = `${priorYear}-${String(priorMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
    } else {
      // all_time: prior-year YTD
      const thisYear = new Date().getFullYear();
      priorFrom = `${thisYear - 1}-01-01`;
      priorTo = `${thisYear - 1}-${todayStr.slice(5)}`;
    }
    const priorToTs = priorTo + " 23:59:59";
    [priorPaidRow, priorOutstandingRow, priorOverdueRow] = await Promise.all([
      get<{ v: number }>("SELECT COALESCE(SUM(total),0) as v FROM invoices i WHERE i.status = 'paid' AND i.created_at >= ? AND i.created_at <= ?", [priorFrom, priorToTs]),
      get<{ v: number }>("SELECT COALESCE(SUM(total),0) as v FROM invoices i WHERE i.status IN ('sent') AND i.created_at >= ? AND i.created_at <= ?", [priorFrom, priorToTs]),
      get<{ v: number }>("SELECT COALESCE(SUM(total),0) as v FROM invoices i WHERE i.status = 'overdue' AND i.created_at >= ? AND i.created_at <= ?", [priorFrom, priorToTs]),
    ]);
  }

  const calcChangePct = (curr: number, prior: number): number | null => {
    if (prior === 0) return curr > 0 ? 100 : null;
    return Math.round(((curr - prior) / prior) * 1000) / 10;
  };

  const currPaid = revPaid?.v || 0;
  const currOutstanding = revOutstanding?.v || 0;
  const currOverdue = revOverdue?.v || 0;
  const priorPaid = priorPaidRow?.v ?? null;
  const priorOutstanding = priorOutstandingRow?.v ?? null;
  const priorOverdue = priorOverdueRow?.v ?? null;

  const qtConversion = (qtTotal?.v || 0) > 0 ? Math.round(((qtAccepted?.v || 0) / (qtTotal?.v || 1)) * 100) : 0;
  return c.json({
    revenue_total: revTotal?.v || 0,
    revenue_paid: currPaid,
    revenue_outstanding: currOutstanding,
    revenue_overdue: currOverdue,
    prior_revenue_paid: priorPaid,
    prior_revenue_outstanding: priorOutstanding,
    prior_revenue_overdue: priorOverdue,
    kpi_paid_change_pct: priorPaid !== null ? calcChangePct(currPaid, priorPaid) : null,
    kpi_outstanding_change_pct: priorOutstanding !== null ? calcChangePct(currOutstanding, priorOutstanding) : null,
    kpi_overdue_change_pct: priorOverdue !== null ? calcChangePct(currOverdue, priorOverdue) : null,
    jobs_total: jobsTotal?.v || 0,
    jobs_completed: jobsDone?.v || 0,
    jobs_scheduled: jobsSched?.v || 0,
    quotes_total: qtTotal?.v || 0,
    quotes_accepted: qtAccepted?.v || 0,
    quotes_conversion_pct: qtConversion,
    quotes_pipeline_total: qtPipeline?.v || 0,
    quotes_pipeline_draft: qtPipelineDraft?.v || 0,
    quotes_pipeline_sent: qtPipelineSent?.v || 0,
    top_technicians: topTechs,
  }, 200);
});

app.openapi(createRoute({
  method: "get", path: "/api/reports/trend",
  request: { query: z.object({
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    bucket: z.enum(["day", "week", "month"]).optional(),
    range: z.enum(["this_week", "this_month", "all_time"]).optional(),
    source: z.enum(["invoices", "jobs"]).optional(),
  }) },
  responses: { 200: { description: "Revenue trend", content: { "application/json": { schema: z.any() } } } },
}), async (c) => {
  const q = c.req.valid("query");
  const bucket = q.bucket ?? "month";
  const fmt = bucket === "day" ? "%Y-%m-%d" : bucket === "week" ? "%Y-W%W" : "%Y-%m";

  const invParts: string[] = []; const invVals: unknown[] = [];
  const jobParts: string[] = []; const jobVals: unknown[] = [];
  if (q.date_from) {
    invParts.push(`i.created_at >= ?`); invVals.push(q.date_from);
    jobParts.push(`j.created_at >= ?`); jobVals.push(q.date_from);
  }
  if (q.date_to) {
    invParts.push(`i.created_at <= ?`); invVals.push(q.date_to + " 23:59:59");
    jobParts.push(`j.created_at <= ?`); jobVals.push(q.date_to + " 23:59:59");
  }
  const invWhere = invParts.length ? " AND " + invParts.join(" AND ") : "";
  const jobWhere = jobParts.length ? " WHERE " + jobParts.join(" AND ") : "";

  const [invoiceRows, jobRows] = await Promise.all([
    query<{ period: string; revenue_paid: number }>(
      `SELECT strftime('${fmt}', i.created_at) as period, COALESCE(SUM(i.total), 0) as revenue_paid
       FROM invoices i WHERE i.status = 'paid'${invWhere}
       GROUP BY period ORDER BY period ASC`,
      invVals
    ),
    query<{ period: string; revenue_paid: number }>(
      `SELECT strftime('${fmt}', j.created_at) as period, COALESCE(SUM(j.price), 0) as revenue_paid
       FROM jobs j${jobWhere}
       GROUP BY period ORDER BY period ASC`,
      jobVals
    ),
  ]);

  // Compute prior-period comparison for invoices
  const todayStr = new Date().toISOString().split("T")[0];
  const currentFrom = q.date_from ?? `${new Date().getFullYear()}-01-01`;
  const currentTo = q.date_to ?? todayStr;

  let priorFrom: string;
  let priorTo: string;

  if (q.range === "this_week") {
    const shiftMs = 7 * 86_400_000;
    priorFrom = new Date(new Date(currentFrom).getTime() - shiftMs).toISOString().split("T")[0];
    priorTo = new Date(new Date(currentTo).getTime() - shiftMs).toISOString().split("T")[0];
  } else if (q.range === "this_month") {
    const [cy, cm] = currentFrom.split("-").map(Number);
    const priorMonth = cm === 1 ? 12 : cm - 1;
    const priorYear = cm === 1 ? cy - 1 : cy;
    const todayDay = parseInt(currentTo.split("-")[2], 10);
    const lastDayOfPrior = new Date(Date.UTC(priorYear, priorMonth, 0)).getUTCDate();
    const clampedDay = Math.min(todayDay, lastDayOfPrior);
    priorFrom = `${priorYear}-${String(priorMonth).padStart(2, "0")}-01`;
    priorTo = `${priorYear}-${String(priorMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
  } else {
    const thisYear = new Date().getFullYear();
    priorFrom = `${thisYear - 1}-01-01`;
    priorTo = `${thisYear - 1}-${todayStr.slice(5)}`;
  }

  const [curRow, priorRow] = await Promise.all([
    get<{ total: number }>(
      `SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid' AND created_at >= ? AND created_at <= ?`,
      [currentFrom, currentTo + " 23:59:59"]
    ),
    get<{ total: number }>(
      `SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid' AND created_at >= ? AND created_at <= ?`,
      [priorFrom, priorTo + " 23:59:59"]
    ),
  ]);

  const currentTotal = curRow?.total ?? 0;
  const priorTotal = priorRow?.total ?? 0;
  const changePct = priorTotal > 0 ? Math.round(((currentTotal - priorTotal) / priorTotal) * 1000) / 10 : null;

  return c.json({
    trend_invoices: invoiceRows ?? [],
    trend_jobs: jobRows ?? [],
    current_total: currentTotal,
    prior_total: priorTotal,
    change_pct: changePct,
  }, 200);
});

// ── Settings ───────────────────────────────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/settings",
  responses: { 200: { description: "Settings", content: { "application/json": { schema: z.object({ settings: z.any() }) } } } },
}), async (c) => {
  const settings = await get<Record<string, unknown>>("SELECT * FROM settings WHERE id = 1");
  return c.json({ settings: settings ?? {} }, 200);
});

app.openapi(createRoute({
  method: "put", path: "/api/settings",
  request: { body: { content: { "application/json": { schema: z.object({
    company_name: z.string().optional(), company_phone: z.string().optional(),
    company_email: z.string().optional(), company_address: z.string().optional(),
    company_logo_url: z.string().optional(),
    tax_rate: z.number().optional(), currency: z.string().optional(),
    timezone: z.string().optional(), invoice_prefix: z.string().optional(),
    job_prefix: z.string().optional(), quote_prefix: z.string().optional(),
    inbox_agent_interval_hours: z.number().optional(),
    from_email: z.string().optional(),
  }) } } } },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
}), async (c) => {
  const data = c.req.valid("json");
  const existing = await get<{ id: number }>("SELECT id FROM settings WHERE id = 1");
  if (!existing) {
    await run("INSERT INTO settings (id) VALUES (1)");
  }
  const fields: string[] = []; const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { fields.push(`${k} = ?`); vals.push(v); } }
  if (fields.length > 0) { fields.push("updated_at = datetime('now')"); await run(`UPDATE settings SET ${fields.join(", ")} WHERE id = 1`, vals); }
  return c.json({ ok: true }, 200);
});

// ── AI Model setting ──────────────────────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/settings/ai-model",
  responses: { 200: { description: "Active AI model", content: { "application/json": { schema: z.object({ model: z.string() }) } } } },
}), async (c) => {
  const row = await get<{ ai_model: string }>("SELECT ai_model FROM settings WHERE id = 1");
  return c.json({ model: row?.ai_model ?? DEFAULT_MODEL }, 200);
});

app.openapi(createRoute({
  method: "put", path: "/api/settings/ai-model",
  request: { body: { content: { "application/json": { schema: z.object({ model: z.string() }) } } } },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OkSchema } } },
    400: { description: "Invalid model", content: { "application/json": { schema: ErrorSchema } } },
  },
}), async (c) => {
  const { model } = c.req.valid("json");
  if (!(ALLOWED_MODELS as readonly string[]).includes(model)) {
    return c.json({ error: `Model '${model}' is not in the allowed list.` }, 400);
  }
  const existing = await get<{ id: number }>("SELECT id FROM settings WHERE id = 1");
  if (!existing) await run("INSERT INTO settings (id) VALUES (1)");
  await run("UPDATE settings SET ai_model = ?, updated_at = datetime('now') WHERE id = 1", [model]);
  return c.json({ ok: true }, 200);
});

// ── Agent interval (public — no JWT) ───────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/agent/interval",
  responses: { 200: { description: "Inbox agent interval", content: { "application/json": { schema: z.object({ interval_hours: z.number() }) } } } },
}), async (c) => {
  const row = await get<{ inbox_agent_interval_hours: number }>(
    "SELECT inbox_agent_interval_hours FROM settings WHERE id = 1"
  );
  return c.json({ interval_hours: row?.inbox_agent_interval_hours ?? 1 }, 200);
});

// ── Subscription ───────────────────────────────────────────────────

app.openapi(createRoute({
  method: "get", path: "/api/subscription",
  responses: { 200: { description: "Subscription", content: { "application/json": { schema: z.object({ subscription: z.any() }) } } } },
}), async (c) => {
  const sub = await get<Record<string, unknown>>("SELECT * FROM subscription WHERE id = 1");
  const billing = await get<{ stripe_customer_id: string }>("SELECT stripe_customer_id FROM billing_stripe WHERE id = 1");
  const stripeConfigured = Boolean(c.env.STRIPE_SECRET_KEY);
  if (!sub) return c.json({ subscription: { plan: "trial", status: "active", modules: [], stripe_customer_id: "", stripe_configured: stripeConfigured } }, 200);
  let modules: string[] = [];
  try { modules = JSON.parse(sub.modules as string); } catch { modules = []; }
  return c.json({ subscription: { ...sub, modules, stripe_customer_id: billing?.stripe_customer_id ?? "", stripe_configured: stripeConfigured } }, 200);
});

// ── Stripe helpers ──────────────────────────────────────────────────

async function stripePost(path: string, params: Record<string, string>, secretKey: string): Promise<Record<string, unknown>> {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = await r.json() as Record<string, unknown>;
  if (!r.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? "Stripe request failed";
    throw new Error(msg);
  }
  return data;
}

async function stripeGet(path: string, secretKey: string): Promise<Record<string, unknown>> {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${secretKey}` },
  });
  const data = await r.json() as Record<string, unknown>;
  if (!r.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? "Stripe request failed";
    throw new Error(msg);
  }
  return data;
}

async function verifyStripeWebhook(rawBody: string, sigHeader: string, webhookSecret: string): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const p of sigHeader.split(",")) {
    const idx = p.indexOf("=");
    if (idx > 0) parts[p.slice(0, idx)] = p.slice(idx + 1);
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(t, 10)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === v1;
}

// ── Billing endpoints ───────────────────────────────────────────────

app.get("/api/billing/status", async (c) => {
  const secrets: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: c.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_STARTER: c.env.STRIPE_PRICE_STARTER,
    STRIPE_PRICE_PRO: c.env.STRIPE_PRICE_PRO,
    STRIPE_WEBHOOK_SECRET: c.env.STRIPE_WEBHOOK_SECRET,
  };
  const missing = Object.entries(secrets).filter(([, v]) => !v).map(([k]) => k);
  const configured = missing.length === 0;
  let key_valid: boolean | null = null;
  if (c.env.STRIPE_SECRET_KEY) {
    try {
      const r = await fetch("https://api.stripe.com/v1/account", {
        headers: { "Authorization": `Bearer ${c.env.STRIPE_SECRET_KEY}` },
      });
      key_valid = r.ok;
    } catch {
      key_valid = false;
    }
  }
  return c.json({ configured, key_valid, missing });
});

app.post("/api/billing/checkout", async (c) => {
  const sk = c.env.STRIPE_SECRET_KEY;
  if (!sk) return c.json({ error: "Stripe is not configured on this server." }, 503);
  let body: { plan?: string; success_url?: string; cancel_url?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid request body" }, 400); }
  const priceId = body.plan === "starter" ? c.env.STRIPE_PRICE_STARTER : c.env.STRIPE_PRICE_PRO;
  if (!priceId) return c.json({ error: `No price configured for plan: ${body.plan ?? "unknown"}` }, 503);
  const billing = await get<{ stripe_customer_id: string }>("SELECT stripe_customer_id FROM billing_stripe WHERE id = 1");
  const params: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: body.success_url ?? "",
    cancel_url: body.cancel_url ?? "",
    "metadata[plan]": body.plan ?? "pro",
    "subscription_data[metadata][plan]": body.plan ?? "pro",
  };
  if (billing?.stripe_customer_id) params.customer = billing.stripe_customer_id;
  try {
    const session = await stripePost("checkout/sessions", params, sk);
    return c.json({ url: session.url }, 200);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

app.post("/api/billing/portal", async (c) => {
  const sk = c.env.STRIPE_SECRET_KEY;
  if (!sk) return c.json({ error: "Stripe is not configured on this server." }, 503);
  let body: { return_url?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid request body" }, 400); }
  const billing = await get<{ stripe_customer_id: string }>("SELECT stripe_customer_id FROM billing_stripe WHERE id = 1");
  if (!billing?.stripe_customer_id) return c.json({ error: "No Stripe customer found. Please subscribe first." }, 400);
  try {
    const session = await stripePost("billing_portal/sessions", {
      customer: billing.stripe_customer_id,
      return_url: body.return_url ?? "",
    }, sk);
    return c.json({ url: session.url }, 200);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

app.post("/api/billing/switch-plan", async (c) => {
  const sk = c.env.STRIPE_SECRET_KEY;
  if (!sk) return c.json({ error: "Stripe is not configured on this server." }, 503);
  let body: { plan?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid request body" }, 400); }
  if (body.plan !== "starter" && body.plan !== "pro") {
    return c.json({ error: `Invalid plan: ${body.plan ?? "unknown"}` }, 400);
  }
  const priceId = body.plan === "starter" ? c.env.STRIPE_PRICE_STARTER : c.env.STRIPE_PRICE_PRO;
  if (!priceId) return c.json({ error: `No price configured for plan: ${body.plan}` }, 503);
  const billing = await get<{ stripe_subscription_id: string }>("SELECT stripe_subscription_id FROM billing_stripe WHERE id = 1");
  if (!billing?.stripe_subscription_id) {
    return c.json({ error: "No active subscription found. Please subscribe first." }, 400);
  }
  try {
    const subscription = await stripeGet(`subscriptions/${billing.stripe_subscription_id}`, sk);
    const items = ((subscription.items as Record<string, unknown>)?.data ?? []) as Array<{ id: string }>;
    const itemId = items[0]?.id;
    if (!itemId) return c.json({ error: "Subscription has no items to update." }, 502);
    const updated = await stripePost(`subscriptions/${billing.stripe_subscription_id}`, {
      "items[0][id]": itemId,
      "items[0][price]": priceId,
      proration_behavior: "create_prorations",
      "metadata[plan]": body.plan,
    }, sk);
    const status = (updated.status as string) === "active" ? "active" : (updated.status as string);
    const periodEnd = updated.current_period_end as number | undefined;
    const renewal = periodEnd ? new Date(periodEnd * 1000).toISOString().split("T")[0] : "";
    await run(
      "UPDATE subscription SET plan = ?, status = ?, renewal_date = ?, updated_at = datetime('now') WHERE id = 1",
      [body.plan, status, renewal]
    );
    const sub = await get<Record<string, unknown>>("SELECT * FROM subscription WHERE id = 1");
    const modules = sub ? JSON.parse((sub.modules as string) || "[]") : [];
    return c.json({ subscription: { ...sub, modules } }, 200);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

app.post("/api/billing/webhook", async (c) => {
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return c.json({ error: "Webhook secret not configured" }, 503);
  const rawBody = await c.req.text();
  const sig = c.req.header("stripe-signature") ?? "";
  const valid = await verifyStripeWebhook(rawBody, sig, webhookSecret);
  if (!valid) return c.json({ error: "Invalid signature" }, 400);
  let event: { type: string; data: { object: Record<string, unknown> } };
  try { event = JSON.parse(rawBody); } catch { return c.json({ error: "Invalid JSON" }, 400); }
  const obj = event.data.object;
  if (event.type === "checkout.session.completed") {
    const customerId = obj.customer as string;
    const subscriptionId = obj.subscription as string;
    const plan = ((obj.metadata as Record<string, string>) ?? {}).plan ?? "pro";
    await run(
      "UPDATE billing_stripe SET stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = 1",
      [customerId, subscriptionId]
    );
    await run(
      "UPDATE subscription SET plan = ?, status = 'active', renewal_date = date('now', '+1 month'), updated_at = datetime('now') WHERE id = 1",
      [plan]
    );
  } else if (event.type === "customer.subscription.updated") {
    const meta = (obj.metadata as Record<string, string>) ?? {};
    const plan = meta.plan; // set via subscription_data[metadata][plan] at checkout time
    const status = (obj.status as string) === "active" ? "active" : (obj.status as string);
    const periodEnd = obj.current_period_end as number | undefined;
    const renewal = periodEnd ? new Date(periodEnd * 1000).toISOString().split("T")[0] : "";
    if (plan) {
      await run(
        "UPDATE subscription SET plan = ?, status = ?, renewal_date = ?, updated_at = datetime('now') WHERE id = 1",
        [plan, status, renewal]
      );
    } else {
      // metadata.plan missing — update status/renewal only, leave plan unchanged
      await run(
        "UPDATE subscription SET status = ?, renewal_date = ?, updated_at = datetime('now') WHERE id = 1",
        [status, renewal]
      );
    }
  } else if (event.type === "customer.subscription.deleted") {
    await run(
      "UPDATE subscription SET plan = 'trial', status = 'cancelled', renewal_date = '', updated_at = datetime('now') WHERE id = 1"
    );
  }
  return c.json({ received: true }, 200);
});

// ── Inbox Agent Run History ─────────────────────────────────────────

app.get("/api/agent/runs", async (c) => {
  const limitParam = parseInt(c.req.query("limit") || "50", 10);
  const n = Math.min(Math.max(1, limitParam), 200);
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const filePath = resolve("agent/scheduler_runs.jsonl");
    if (!existsSync(filePath)) return c.json({ runs: [] }, 200);
    const raw = readFileSync(filePath, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const runs = lines.slice(-n).reverse().map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    return c.json({ runs }, 200);
  } catch {
    return c.json({ runs: [] }, 200);
  }
});

// ── Google Calendar Integration ─────────────────────────────────────

app.get("/api/integrations/google/auth-url", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.json({ error: "Google Calendar is not configured on this server." }, 503);
  const reqUrl = new URL(c.req.url);
  const redirectUri = `${reqUrl.protocol}//${reqUrl.host}/api/integrations/google/callback`;
  const state = crypto.randomUUID();
  await run("INSERT OR REPLACE INTO _meta (key, value) VALUES ('google_oauth_state', ?)", [state]);
  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly");
  oauthUrl.searchParams.set("access_type", "offline");
  oauthUrl.searchParams.set("prompt", "consent");
  oauthUrl.searchParams.set("state", state);
  return c.json({ url: oauthUrl.toString() }, 200);
});

app.get("/api/integrations/google/callback", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.redirect("/settings?gcal_error=not_configured");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oauthError = c.req.query("error");
  if (oauthError || !code) {
    return c.redirect(`/settings?gcal_error=${encodeURIComponent(oauthError ?? "no_code")}`);
  }
  const storedState = await get<{ value: string }>("SELECT value FROM _meta WHERE key = 'google_oauth_state'");
  if (!storedState || storedState.value !== state) {
    return c.redirect("/settings?gcal_error=invalid_state");
  }
  const reqUrl = new URL(c.req.url);
  const redirectUri = `${reqUrl.protocol}//${reqUrl.host}/api/integrations/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) return c.redirect("/settings?gcal_error=token_exchange_failed");
  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (!tokens.refresh_token) return c.redirect("/settings?gcal_error=no_refresh_token");
  let googleEmail = "";
  try {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json() as { email?: string };
      googleEmail = profile.email ?? "";
    }
  } catch { /* non-fatal */ }
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await storeGoogleTokens(c.env, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry,
    email: googleEmail,
  });
  await run("DELETE FROM _meta WHERE key = 'google_oauth_state'");
  return c.redirect("/settings?gcal_connected=1");
});

app.get("/api/integrations/google/status", async (c) => {
  const row = await get<{ refresh_token: string; google_email: string; calendar_id: string }>(
    "SELECT refresh_token, google_email, calendar_id FROM google_tokens WHERE id = 1"
  );
  return c.json({
    connected: !!(row?.refresh_token),
    email: row?.google_email ?? "",
    calendar_id: row?.calendar_id || "primary",
  }, 200);
});

app.get("/api/integrations/google/calendars", async (c) => {
  const calendars = await listGoogleCalendars(c.env);
  if (calendars === null) return c.json({ error: "Google Calendar is not connected." }, 400);
  const selected = await getSelectedCalendarId();
  return c.json({ calendars, selected }, 200);
});

app.put("/api/integrations/google/calendar", async (c) => {
  const body = await c.req.json().catch(() => ({})) as { calendar_id?: unknown };
  const calendarId = typeof body.calendar_id === "string" ? body.calendar_id.trim() : "";
  if (!calendarId) return c.json({ error: "calendar_id is required" }, 400);
  const oldCalendarId = await getSelectedCalendarId();
  await setSelectedCalendarId(calendarId);
  await resyncJobsToNewCalendar(c.env, oldCalendarId, calendarId);
  return c.json({ ok: true, calendar_id: calendarId }, 200);
});

app.delete("/api/integrations/google", async (c) => {
  await run(
    "UPDATE google_tokens SET access_token = '', refresh_token = '', token_expiry = '', google_email = '', calendar_id = 'primary', updated_at = datetime('now') WHERE id = 1"
  );
  return c.json({ ok: true }, 200);
});

export default {
  fetch: app.fetch.bind(app),
  async scheduled(_event: unknown, env: Env["Bindings"], _ctx: unknown) {
    initDB(env);
    await run("DELETE FROM password_reset_tokens WHERE expires_at < datetime('now')");
  },
};
