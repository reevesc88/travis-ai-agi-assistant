import { get, run, query } from "../db.js";

export interface GoogleEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
}

const DEV_TOKEN_SECRET = "travis-dev-secret-change-in-production";

interface GoogleTokenRow {
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_id: string;
  google_email: string;
}

export interface CalendarJob {
  id: number;
  identifier: string;
  customer_name?: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration: number;
  address: string;
  notes: string;
}

// ── AES-GCM encryption for tokens at rest ────────────────────────────

async function getEncKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("gcal-tokens:" + secret)
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptToken(secret: string, plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const key = await getEncKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(12 + ct.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ct), 12);
  let s = "";
  combined.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function decryptToken(secret: string, encrypted: string): Promise<string> {
  if (!encrypted) return "";
  try {
    const p = encrypted.replace(/-/g, "+").replace(/_/g, "/");
    const padded = p + "=".repeat((4 - p.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    const key = await getEncKey(secret);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12)
    );
    return new TextDecoder().decode(pt);
  } catch { return ""; }
}

// ── Token storage helpers ────────────────────────────────────────────

export async function storeGoogleTokens(
  env: GoogleEnv,
  tokens: { access_token: string; refresh_token: string; expiry: string; email: string }
): Promise<void> {
  const secret = env.JWT_SECRET ?? DEV_TOKEN_SECRET;
  const encAccess = await encryptToken(secret, tokens.access_token);
  const encRefresh = await encryptToken(secret, tokens.refresh_token);
  await run(
    "UPDATE google_tokens SET access_token = ?, refresh_token = ?, token_expiry = ?, google_email = ?, updated_at = datetime('now') WHERE id = 1",
    [encAccess, encRefresh, tokens.expiry, tokens.email]
  );
}

async function readTokens(env: GoogleEnv): Promise<GoogleTokenRow | null> {
  const row = await get<GoogleTokenRow>(
    "SELECT access_token, refresh_token, token_expiry, calendar_id, google_email FROM google_tokens WHERE id = 1"
  );
  if (!row?.refresh_token) return null;
  const secret = env.JWT_SECRET ?? DEV_TOKEN_SECRET;
  return {
    ...row,
    access_token: await decryptToken(secret, row.access_token),
    refresh_token: await decryptToken(secret, row.refresh_token),
  };
}

// ── OAuth helpers ────────────────────────────────────────────────────

async function refreshAccessToken(
  env: GoogleEnv,
  refreshToken: string
): Promise<{ access_token: string; expiry: string } | null> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    console.error("[gcal] token refresh failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  return {
    access_token: data.access_token,
    expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

async function ensureValidToken(env: GoogleEnv, tokens: GoogleTokenRow): Promise<string | null> {
  const now = new Date().toISOString();
  if (tokens.token_expiry > now && tokens.access_token) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  const refreshed = await refreshAccessToken(env, tokens.refresh_token);
  if (!refreshed) return null;
  const secret = env.JWT_SECRET ?? DEV_TOKEN_SECRET;
  const encAccess = await encryptToken(secret, refreshed.access_token);
  await run(
    "UPDATE google_tokens SET access_token = ?, token_expiry = ?, updated_at = datetime('now') WHERE id = 1",
    [encAccess, refreshed.expiry]
  );
  return refreshed.access_token;
}

// ── Calendar event helpers ───────────────────────────────────────────

function buildEventBody(job: CalendarJob): Record<string, unknown> {
  const summary = job.customer_name
    ? `${job.identifier} — ${job.customer_name}`
    : job.identifier;
  const [hStr, mStr] = (job.scheduled_time || "09:00").split(":");
  const hh = parseInt(hStr || "9", 10);
  const mm = parseInt(mStr || "0", 10);
  // Build local datetime strings WITHOUT any timezone offset or Z suffix.
  // Google Calendar interprets these as wall-clock time in the given timeZone.
  const startStr = `${job.scheduled_date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  const endTotalMins = hh * 60 + mm + (job.duration || 60);
  const endH = Math.floor(endTotalMins / 60) % 24;
  const endM = endTotalMins % 60;
  let endDateStr = job.scheduled_date;
  if (endTotalMins >= 1440) {
    const [y, mo, d] = job.scheduled_date.split("-").map(Number);
    const extra = Math.floor(endTotalMins / 1440);
    const next = new Date(Date.UTC(y, mo - 1, d + extra));
    endDateStr = next.toISOString().split("T")[0];
  }
  const endStr = `${endDateStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;
  return {
    summary,
    description: job.notes || "",
    location: job.address || "",
    start: { dateTime: startStr, timeZone: "Australia/Sydney" },
    end: { dateTime: endStr, timeZone: "Australia/Sydney" },
  };
}

export async function createOrUpdateCalendarEvent(env: GoogleEnv, job: CalendarJob): Promise<void> {
  try {
    const tokens = await readTokens(env);
    if (!tokens) return;
    const accessToken = await ensureValidToken(env, tokens);
    if (!accessToken) return;
    const calId = encodeURIComponent(tokens.calendar_id || "primary");
    const existing = await get<{ event_id: string }>(
      "SELECT event_id FROM job_gcal_events WHERE job_id = ?", [job.id]
    );
    const body = buildEventBody(job);
    if (existing?.event_id) {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${existing.event_id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.status === 404 || res.status === 410) {
        // Stale mapping — event was deleted externally; clear it and fall through to create
        await run("DELETE FROM job_gcal_events WHERE job_id = ?", [job.id]);
        const createRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (createRes.ok) {
          const created = await createRes.json() as { id: string };
          await run(
            "INSERT OR REPLACE INTO job_gcal_events (job_id, event_id) VALUES (?, ?)",
            [job.id, created.id]
          );
        } else {
          console.error(`[gcal] recreate failed: ${createRes.status}`, await createRes.text());
        }
      } else if (!res.ok) {
        console.error(`[gcal] update failed: ${res.status}`, await res.text());
      }
    } else {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (res.ok) {
        const created = await res.json() as { id: string };
        await run(
          "INSERT OR REPLACE INTO job_gcal_events (job_id, event_id) VALUES (?, ?)",
          [job.id, created.id]
        );
      } else {
        console.error(`[gcal] create failed: ${res.status}`, await res.text());
      }
    }
  } catch (e) {
    console.error("[gcal] createOrUpdateCalendarEvent error:", e);
  }
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary: boolean;
}

export async function listGoogleCalendars(env: GoogleEnv): Promise<GoogleCalendarEntry[] | null> {
  const tokens = await readTokens(env);
  if (!tokens) return null;
  const accessToken = await ensureValidToken(env, tokens);
  if (!accessToken) return null;
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    console.error("[gcal] list calendars failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json() as {
    items?: Array<{ id: string; summary: string; primary?: boolean }>;
  };
  return (data.items ?? []).map((i) => ({
    id: i.id,
    summary: i.summary,
    primary: !!i.primary,
  }));
}

export async function getSelectedCalendarId(): Promise<string> {
  const row = await get<{ calendar_id: string }>(
    "SELECT calendar_id FROM google_tokens WHERE id = 1"
  );
  return row?.calendar_id || "primary";
}

export async function setSelectedCalendarId(calendarId: string): Promise<void> {
  await run(
    "UPDATE google_tokens SET calendar_id = ?, updated_at = datetime('now') WHERE id = 1",
    [calendarId]
  );
}

export async function resyncJobsToNewCalendar(
  env: GoogleEnv,
  oldCalendarId: string,
  newCalendarId: string
): Promise<void> {
  if (oldCalendarId === newCalendarId) return;
  try {
    const tokens = await readTokens(env);
    if (!tokens) return;
    const accessToken = await ensureValidToken(env, tokens);
    if (!accessToken) return;

    const today = new Date().toISOString().slice(0, 10);
    const rows = await query<CalendarJob & { event_id: string }>(
      `SELECT j.id, j.identifier, c.name AS customer_name, j.scheduled_date,
              j.scheduled_time, j.duration, j.address, j.notes, jge.event_id
       FROM jobs j
       JOIN job_gcal_events jge ON jge.job_id = j.id
       LEFT JOIN customers c ON c.id = j.customer_id
       WHERE j.scheduled_date >= ?`,
      [today]
    );
    if (!rows.length) return;

    const oldCalId = encodeURIComponent(oldCalendarId);
    const newCalId = encodeURIComponent(newCalendarId);

    for (const row of rows) {
      // Delete from old calendar (ignore 404/410 — already gone)
      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${oldCalId}/events/${row.event_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!delRes.ok && delRes.status !== 404 && delRes.status !== 410) {
        console.error(`[gcal] resync delete failed for job ${row.id}: ${delRes.status}`);
      }

      // Create on new calendar
      const body = buildEventBody(row);
      const createRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${newCalId}/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (createRes.ok) {
        const created = await createRes.json() as { id: string };
        await run(
          "INSERT OR REPLACE INTO job_gcal_events (job_id, event_id) VALUES (?, ?)",
          [row.id, created.id]
        );
      } else {
        // Delete succeeded but create failed — clear the stale mapping so the next
        // createOrUpdateCalendarEvent call creates fresh rather than trying to PUT a dead event_id.
        await run("DELETE FROM job_gcal_events WHERE job_id = ?", [row.id]);
        console.error(`[gcal] resync create failed for job ${row.id}: ${createRes.status}`, await createRes.text());
      }
    }
  } catch (e) {
    console.error("[gcal] resyncJobsToNewCalendar error:", e);
  }
}

export async function deleteCalendarEvent(env: GoogleEnv, jobId: number): Promise<void> {
  try {
    const tokens = await readTokens(env);
    if (!tokens) return;
    const existing = await get<{ event_id: string }>(
      "SELECT event_id FROM job_gcal_events WHERE job_id = ?", [jobId]
    );
    if (!existing?.event_id) return;
    const accessToken = await ensureValidToken(env, tokens);
    if (!accessToken) return;
    const calId = encodeURIComponent(tokens.calendar_id || "primary");
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${existing.event_id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok && res.status !== 410 && res.status !== 404) {
      console.error(`[gcal] delete failed: ${res.status}`, await res.text());
    }
    await run("DELETE FROM job_gcal_events WHERE job_id = ?", [jobId]);
  } catch (e) {
    console.error("[gcal] deleteCalendarEvent error:", e);
  }
}
