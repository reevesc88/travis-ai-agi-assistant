import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { initDB, query, get, run } from "./db.js";
import { aiComplete, aiConfigured, aiBuild, anthropicConfigured } from "./ai.js";

type Env = { Bindings: { DB: D1Database; OPENROUTER_API_KEY?: string; AI_MODEL?: string } };

const app = new OpenAPIHono<Env>();

app.use("*", async (c, next) => { initDB(c.env); await next(); });

// ── Shared Schemas ─────────────────────────────────────────────────

const ErrorSchema = z.object({ error: z.string() }).openapi("Error");
const OkSchema = z.object({ ok: z.boolean() }).openapi("Ok");

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
  job_notes: z.array(JobNoteSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).openapi("Job");

const IdParam = z.object({ id: z.string().openapi({ description: "Resource ID" }) });

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

  const countRow = await get<{ count: number }>(
    `SELECT COUNT(*) as count FROM jobs j LEFT JOIN customers c ON j.customer_id = c.id ${where}`,
    params
  );

  const jobs = await query<Record<string, unknown>>(
    `SELECT j.*, c.name as customer_name, c.phone as customer_phone,
       t.name as technician_name, t.color as technician_color,
       st.name as service_type_name, st.color as service_type_color
     FROM jobs j
     LEFT JOIN customers c ON j.customer_id = c.id
     LEFT JOIN technicians t ON j.technician_id = t.id
     LEFT JOIN service_types st ON j.service_type_id = st.id
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
       st.name as service_type_name, st.color as service_type_color
     FROM jobs j
     LEFT JOIN customers c ON j.customer_id = c.id
     LEFT JOIN technicians t ON j.technician_id = t.id
     LEFT JOIN service_types st ON j.service_type_id = st.id
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
    200: { description: "Customer detail", content: { "application/json": { schema: z.object({ customer: CustomerSchema, jobs: z.array(JobSchema), quotes: z.array(z.any()) }) } } },
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
  const quotes = await query<Record<string, unknown>>(
    `SELECT qt.*, c.name as customer_name FROM quotes qt
     LEFT JOIN customers c ON qt.customer_id = c.id
     WHERE qt.customer_id = ?
     ORDER BY qt.created_at DESC
     LIMIT 50`,
    [id]
  );
  return c.json({ customer, jobs, quotes }, 200);
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

  let subtotal = 0;
  let taxRate = 0;
  let notes = "";
  const lines: { description: string; quantity: number; unit_price: number; total: number }[] = [];

  // If a quote was approved into this job, the quote's agreed line items and tax
  // inform the invoice (quote-to-cash continuity). Otherwise fall back to the
  // job price plus any materials logged on the job.
  const quote = await get<Record<string, unknown>>(
    "SELECT * FROM quotes WHERE job_id = ? ORDER BY id DESC LIMIT 1", [id]
  );

  if (quote) {
    const qlines = await query<Record<string, unknown>>(
      "SELECT * FROM quote_lines WHERE quote_id = ? ORDER BY sort_order ASC, id ASC", [quote.id]
    );
    for (const l of qlines) {
      lines.push({
        description: l.description as string,
        quantity: l.quantity as number,
        unit_price: l.unit_price as number,
        total: l.total as number,
      });
      subtotal += l.total as number;
    }
    taxRate = (quote.tax_rate as number) || 0;
    notes = `Generated from quote ${quote.identifier as string}`;
  } else {
    const price = job.price as number;
    lines.push({ description: (job.service_type_name as string) || "Service", quantity: 1, unit_price: price, total: price });
    subtotal = price;
    const mats = await query<Record<string, unknown>>(
      `SELECT jm.*, m.name as material_name FROM job_materials jm
       LEFT JOIN materials m ON jm.material_id = m.id WHERE jm.job_id = ?`, [id]
    );
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
  }

  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  await run(
    `INSERT INTO invoices (identifier, customer_id, job_id, status, subtotal, tax_rate, tax_amount, total, notes, due_date)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, '')`,
    [identifier, job.customer_id, job.id, subtotal, taxRate, taxAmount, total, notes]
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

// ════════════════════════════════════════════════════════════════════
// Travis backend foundation (Task 17): quotes, supplier pricing,
// receptionist, inbox, AI (activity + assistant), reports, settings.
// ════════════════════════════════════════════════════════════════════

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

// ── Supplier pricing ───────────────────────────────────────────────

const SupplierProductSchema = z.object({
  id: z.number().int(),
  supplier_id: z.number().int(),
  sku: z.string(),
  name: z.string(),
  unit: z.string(),
  current_price: z.number(),
  previous_price: z.number(),
  in_stock: z.number().int(),
  supplier_name: z.string().optional(),
  change_pct: z.number().optional(),
  updated_at: z.string(),
}).openapi("SupplierProduct");

const listSupplierPricing = createRoute({
  method: "get",
  path: "/api/supplier-pricing",
  request: { query: z.object({ search: z.string().optional() }) },
  responses: {
    200: { description: "Supplier products with price change", content: { "application/json": { schema: z.object({ products: z.array(SupplierProductSchema) }) } } },
  },
});

app.openapi(listSupplierPricing, async (c) => {
  const q = c.req.valid("query");
  let where = "";
  const params: unknown[] = [];
  if (q.search) {
    where = "WHERE sp.name LIKE ? OR sp.sku LIKE ? OR s.name LIKE ?";
    const t = `%${q.search}%`;
    params.push(t, t, t);
  }
  const rows = await query<Record<string, number | string>>(
    `SELECT sp.*, s.name as supplier_name FROM supplier_products sp
     LEFT JOIN supplier_sources s ON sp.supplier_id = s.id
     ${where}
     ORDER BY sp.name ASC`, params
  );
  const products = rows.map((r) => {
    const cur = r.current_price as number;
    const prev = r.previous_price as number;
    const change = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
    return { ...r, change_pct: Math.round(change * 10) / 10 };
  });
  return c.json({ products }, 200);
});

const listSupplierSources = createRoute({
  method: "get",
  path: "/api/supplier-pricing/sources",
  responses: {
    200: { description: "Supplier sources", content: { "application/json": { schema: z.object({ sources: z.array(z.any()) }) } } },
  },
});

app.openapi(listSupplierSources, async (c) => {
  const sources = await query<Record<string, unknown>>("SELECT * FROM supplier_sources ORDER BY name ASC");
  return c.json({ sources }, 200);
});

const supplierPriceHistory = createRoute({
  method: "get",
  path: "/api/supplier-pricing/{id}/history",
  request: { params: IdParam },
  responses: {
    200: { description: "Price history for a product", content: { "application/json": { schema: z.object({ history: z.array(z.any()) }) } } },
  },
});

app.openapi(supplierPriceHistory, async (c) => {
  const { id } = c.req.valid("param");
  const history = await query<Record<string, unknown>>(
    "SELECT * FROM supplier_price_history WHERE supplier_product_id = ? ORDER BY recorded_at ASC", [id]
  );
  return c.json({ history }, 200);
});

// ── Receptionist calls ─────────────────────────────────────────────

const listCalls = createRoute({
  method: "get",
  path: "/api/receptionist/calls",
  request: { query: z.object({ status: z.string().optional() }) },
  responses: {
    200: { description: "Receptionist calls", content: { "application/json": { schema: z.object({ calls: z.array(z.any()) }) } } },
  },
});

app.openapi(listCalls, async (c) => {
  const q = c.req.valid("query");
  let where = "";
  const params: unknown[] = [];
  if (q.status) { where = "WHERE rc.status = ?"; params.push(q.status); }
  const calls = await query<Record<string, unknown>>(
    `SELECT rc.*, c.name as customer_name FROM receptionist_calls rc
     LEFT JOIN customers c ON rc.customer_id = c.id
     ${where}
     ORDER BY rc.created_at DESC`, params
  );
  return c.json({ calls }, 200);
});

const getCall = createRoute({
  method: "get",
  path: "/api/receptionist/calls/{id}",
  request: { params: IdParam },
  responses: {
    200: { description: "Call detail", content: { "application/json": { schema: z.object({ call: z.any() }) } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(getCall, async (c) => {
  const { id } = c.req.valid("param");
  const call = await get<Record<string, unknown>>(
    `SELECT rc.*, c.name as customer_name FROM receptionist_calls rc
     LEFT JOIN customers c ON rc.customer_id = c.id WHERE rc.id = ?`, [id]
  );
  if (!call) return c.json({ error: "Call not found" }, 404);
  return c.json({ call }, 200);
});

// ── Inbox ──────────────────────────────────────────────────────────

const listInbox = createRoute({
  method: "get",
  path: "/api/inbox",
  request: { query: z.object({ status: z.string().optional(), category: z.string().optional() }) },
  responses: {
    200: { description: "Inbox items", content: { "application/json": { schema: z.object({ items: z.array(z.any()) }) } } },
  },
});

app.openapi(listInbox, async (c) => {
  const q = c.req.valid("query");
  let where = "WHERE 1=1";
  const params: unknown[] = [];
  if (q.status) { where += " AND ib.status = ?"; params.push(q.status); }
  if (q.category) { where += " AND ib.category = ?"; params.push(q.category); }
  const items = await query<Record<string, unknown>>(
    `SELECT ib.*, c.name as customer_name FROM inbox_items ib
     LEFT JOIN customers c ON ib.customer_id = c.id
     ${where}
     ORDER BY ib.received_at DESC`, params
  );
  return c.json({ items }, 200);
});

const updateInbox = createRoute({
  method: "put",
  path: "/api/inbox/{id}",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: z.object({ status: z.string() }) } } },
  },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(updateInbox, async (c) => {
  const { id } = c.req.valid("param");
  const { status } = c.req.valid("json");
  await run("UPDATE inbox_items SET status = ? WHERE id = ?", [status, id]);
  return c.json({ ok: true }, 200);
});

// ── AI: activity log + assistant ───────────────────────────────────

const listAiActivity = createRoute({
  method: "get",
  path: "/api/ai/activity",
  request: { query: z.object({ kind: z.string().optional(), limit: z.string().optional() }) },
  responses: {
    200: { description: "AI activity log", content: { "application/json": { schema: z.object({ activity: z.array(z.any()) }) } } },
  },
});

app.openapi(listAiActivity, async (c) => {
  const q = c.req.valid("query");
  const limit = parseInt(q.limit || "50", 10);
  let where = "";
  const params: unknown[] = [];
  if (q.kind) { where = "WHERE kind = ?"; params.push(q.kind); }
  const activity = await query<Record<string, unknown>>(
    `SELECT * FROM ai_activity ${where} ORDER BY created_at DESC LIMIT ?`, [...params, limit]
  );
  return c.json({ activity }, 200);
});

const aiStatus = createRoute({
  method: "get",
  path: "/api/ai/status",
  responses: {
    200: { description: "AI provider status", content: { "application/json": { schema: z.object({ configured: z.boolean(), source: z.string() }) } } },
  },
});

app.openapi(aiStatus, async (c) => {
  const configured = aiConfigured(c.env);
  return c.json({ configured, source: configured ? "openrouter" : "mock" }, 200);
});

const askAssistant = createRoute({
  method: "post",
  path: "/api/ai/assistant",
  request: {
    body: { content: { "application/json": { schema: z.object({ prompt: z.string() }) } } },
  },
  responses: {
    200: { description: "Assistant reply", content: { "application/json": { schema: z.object({ reply: z.string(), source: z.string(), model: z.string() }) } } },
    500: { description: "AI failure", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(askAssistant, async (c) => {
  const { prompt } = c.req.valid("json");
  try {
    const result = await aiComplete(c.env, {
      prompt,
      system: "You are Travis, an AI co-worker for a UK trades/field-service business. Be concise, practical and money-aware. Help with quotes, invoices, scheduling and calls.",
    });
    await run(
      "INSERT INTO ai_activity (kind, title, detail, status, source) VALUES ('assistant', ?, ?, 'completed', ?)",
      [`Answered: ${prompt.slice(0, 60)}`, result.text.slice(0, 500), result.source]
    );
    return c.json({ reply: result.text, source: result.source, model: result.model }, 200);
  } catch (err) {
    await run(
      "INSERT INTO ai_activity (kind, title, detail, status, source) VALUES ('assistant', ?, ?, 'failed', 'openrouter')",
      [`Failed: ${prompt.slice(0, 60)}`, (err as Error).message.slice(0, 500)]
    );
    return c.json({ error: (err as Error).message }, 500);
  }
});

const buildTask = createRoute({
  method: "post",
  path: "/api/ai/build",
  request: {
    body: { content: { "application/json": { schema: z.object({ task: z.string() }) } } },
  },
  responses: {
    200: { description: "Build plan", content: { "application/json": { schema: z.object({ steps: z.array(z.any()), summary: z.string(), source: z.string(), model: z.string() }) } } },
    500: { description: "Build failure", content: { "application/json": { schema: ErrorSchema } } },
  },
});

app.openapi(buildTask, async (c) => {
  const { task } = c.req.valid("json");
  try {
    const result = await aiBuild(c.env, task);
    await run(
      "INSERT INTO ai_activity (kind, title, detail, status, source) VALUES ('assistant', ?, ?, 'completed', ?)",
      [`Build: ${task.slice(0, 60)}`, result.summary.slice(0, 500), result.source]
    );
    return c.json(result, 200);
  } catch (err) {
    await run(
      "INSERT INTO ai_activity (kind, title, detail, status, source) VALUES ('assistant', ?, ?, 'failed', 'anthropic')",
      [`Build failed: ${task.slice(0, 60)}`, (err as Error).message.slice(0, 500)]
    );
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── Reports ────────────────────────────────────────────────────────

const getReports = createRoute({
  method: "get",
  path: "/api/reports",
  responses: {
    200: {
      description: "Business reports summary",
      content: { "application/json": { schema: z.object({
        revenue_paid: z.number(),
        revenue_outstanding: z.number(),
        revenue_overdue: z.number(),
        quotes_total: z.number().int(),
        quotes_approved: z.number().int(),
        quotes_win_rate: z.number(),
        avg_margin_pct: z.number(),
        jobs_completed: z.number().int(),
        jobs_upcoming: z.number().int(),
        revenue_by_month: z.array(z.object({ month: z.string(), total: z.number() })),
      }) } },
    },
  },
});

app.openapi(getReports, async (c) => {
  const revPaid = await get<{ total: number }>("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE status = 'paid'");
  const revOut = await get<{ total: number }>("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE status = 'sent'");
  const revOver = await get<{ total: number }>("SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE status = 'overdue'");
  const qTotal = await get<{ count: number }>("SELECT COUNT(*) as count FROM quotes");
  const qAccepted = await get<{ count: number }>("SELECT COUNT(*) as count FROM quotes WHERE status = 'approved'");
  const qClosed = await get<{ count: number }>("SELECT COUNT(*) as count FROM quotes WHERE status IN ('approved','rejected')");
  const avgMargin = await get<{ avg: number }>("SELECT COALESCE(AVG(margin_pct),0) as avg FROM quotes");
  const jobsDone = await get<{ count: number }>("SELECT COUNT(*) as count FROM jobs WHERE status = 'completed'");
  const today = new Date().toISOString().split("T")[0];
  const jobsUpcoming = await get<{ count: number }>("SELECT COUNT(*) as count FROM jobs WHERE status IN ('scheduled','confirmed') AND scheduled_date >= ?", [today]);
  const byMonth = await query<{ month: string; total: number }>(
    `SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total),0) as total
     FROM invoices WHERE status IN ('paid','sent','overdue')
     GROUP BY month ORDER BY month ASC`
  );
  const closed = qClosed?.count || 0;
  const approved = qAccepted?.count || 0;
  return c.json({
    revenue_paid: revPaid?.total || 0,
    revenue_outstanding: revOut?.total || 0,
    revenue_overdue: revOver?.total || 0,
    quotes_total: qTotal?.count || 0,
    quotes_approved: approved,
    quotes_win_rate: closed > 0 ? Math.round((approved / closed) * 1000) / 10 : 0,
    avg_margin_pct: Math.round((avgMargin?.avg || 0) * 10) / 10,
    jobs_completed: jobsDone?.count || 0,
    jobs_upcoming: jobsUpcoming?.count || 0,
    revenue_by_month: byMonth,
  }, 200);
});

// ── Settings & subscription ────────────────────────────────────────

const getSettings = createRoute({
  method: "get",
  path: "/api/settings",
  responses: {
    200: { description: "Settings map", content: { "application/json": { schema: z.object({ settings: z.record(z.string()) }) } } },
  },
});

app.openapi(getSettings, async (c) => {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM settings");
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return c.json({ settings }, 200);
});

const updateSettings = createRoute({
  method: "put",
  path: "/api/settings",
  request: {
    body: { content: { "application/json": { schema: z.record(z.string()) } } },
  },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: OkSchema } } } },
});

app.openapi(updateSettings, async (c) => {
  const data = c.req.valid("json");
  for (const [key, value] of Object.entries(data)) {
    await run(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
      [key, value]
    );
  }
  return c.json({ ok: true }, 200);
});

const getSubscription = createRoute({
  method: "get",
  path: "/api/subscription",
  responses: {
    200: { description: "Subscription state", content: { "application/json": { schema: z.object({ subscription: z.any() }) } } },
  },
});

app.openapi(getSubscription, async (c) => {
  const subscription = await get<Record<string, unknown>>("SELECT * FROM subscription WHERE id = 1");
  return c.json({ subscription: subscription || null }, 200);
});

export default app;
