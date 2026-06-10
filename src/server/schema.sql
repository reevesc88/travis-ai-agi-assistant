-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  zip TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Technicians (field workers)
CREATE TABLE IF NOT EXISTS technicians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  color TEXT NOT NULL DEFAULT '#16a34a',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Service types (configurable per vertical)
CREATE TABLE IF NOT EXISTS service_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  default_duration INTEGER NOT NULL DEFAULT 60,
  default_price REAL NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Jobs (scheduled service visits)
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  technician_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
  service_type_id INTEGER REFERENCES service_types(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  priority TEXT NOT NULL DEFAULT 'normal',
  scheduled_date TEXT NOT NULL DEFAULT (date('now')),
  scheduled_time TEXT DEFAULT '09:00',
  duration INTEGER NOT NULL DEFAULT 60,
  price REAL NOT NULL DEFAULT 0,
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  completion_notes TEXT DEFAULT '',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_interval TEXT DEFAULT '',
  next_recurrence_date TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Job history / activity log
CREATE TABLE IF NOT EXISTS job_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Checklist items per job (inspection forms, task lists)
CREATE TABLE IF NOT EXISTS job_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Materials / inventory used on jobs
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'ea',
  unit_cost REAL NOT NULL DEFAULT 0,
  in_stock REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity REAL NOT NULL DEFAULT 1,
  unit_cost REAL NOT NULL DEFAULT 0
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  paid_date TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

-- Auto-incrementing identifier counter
CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO _meta (key, value) VALUES ('job_counter', '0');
INSERT OR IGNORE INTO _meta (key, value) VALUES ('identifier_prefix', 'JOB');
INSERT OR IGNORE INTO _meta (key, value) VALUES ('invoice_counter', '0');
INSERT OR IGNORE INTO _meta (key, value) VALUES ('invoice_prefix', 'INV');

-- Example service types (users customize for their vertical)
INSERT OR IGNORE INTO service_types (id, name, description, default_duration, default_price, color)
VALUES
  (1, 'Standard Service', 'Standard service visit', 60, 150, '#16a34a'),
  (2, 'Inspection', 'On-site inspection and assessment', 45, 75, '#0891b2'),
  (3, 'Emergency', 'Urgent same-day service call', 90, 300, '#dc2626'),
  (4, 'Follow-up', 'Follow-up visit after initial service', 30, 50, '#9333ea'),
  (5, 'Installation', 'Equipment or system installation', 120, 400, '#ea580c'),
  (6, 'Maintenance', 'Routine maintenance visit', 60, 125, '#ca8a04');

CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_technician ON jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_service_type ON jobs(service_type_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date ON jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_job_notes_job ON job_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_job_checklist_job ON job_checklist(job_id);
CREATE INDEX IF NOT EXISTS idx_job_materials_job ON job_materials(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- Example materials
INSERT OR IGNORE INTO materials (id, name, unit, unit_cost, in_stock)
VALUES
  (1, 'Service Fee', 'ea', 0, 999),
  (2, 'Filter Replacement', 'ea', 25, 50),
  (3, 'Sealant', 'tube', 12, 30),
  (4, 'Travel Surcharge', 'ea', 35, 999),
  (5, 'Disposable Supplies', 'kit', 8, 100);

-- ════════════════════════════════════════════════════════════════════
-- Travis backend foundation (Task 17): quotes, suppliers, receptionist,
-- inbox, AI activity, settings, subscription + realistic demo seed data.
-- All seed uses INSERT OR IGNORE with explicit ids so re-applying this
-- file on every boot is idempotent and never clobbers user changes.
-- ════════════════════════════════════════════════════════════════════

-- ── Supplier intelligence ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'placeholder', -- placeholder | feed | manual
  website TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  last_synced TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES supplier_sources(id) ON DELETE CASCADE,
  sku TEXT DEFAULT '',
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'ea',
  current_price REAL NOT NULL DEFAULT 0,
  previous_price REAL NOT NULL DEFAULT 0,
  in_stock INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_product_id INTEGER NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  price REAL NOT NULL DEFAULT 0,
  recorded_at TEXT DEFAULT (datetime('now'))
);

-- ── Quotes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | viewed | approved | rejected | expired
  title TEXT DEFAULT '',
  subtotal REAL NOT NULL DEFAULT 0,
  cost_total REAL NOT NULL DEFAULT 0,
  margin_amount REAL NOT NULL DEFAULT 0,
  margin_pct REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low', -- low | medium | high
  notes TEXT DEFAULT '',
  valid_until TEXT DEFAULT '',
  sent_at TEXT DEFAULT '',
  approved_at TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- cost_at_time locks the supplier/material cost when the line is added so
-- later price changes never alter an already-sent quote (historical lock).
CREATE TABLE IF NOT EXISTS quote_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'labor', -- labor | material | supplier
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  supplier_product_id INTEGER REFERENCES supplier_products(id) ON DELETE SET NULL,
  quantity REAL NOT NULL DEFAULT 1,
  cost_at_time REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── AI receptionist calls ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receptionist_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_name TEXT DEFAULT '',
  caller_phone TEXT DEFAULT '',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  status TEXT NOT NULL DEFAULT 'completed', -- completed | missed | voicemail
  intent TEXT DEFAULT '', -- booking | quote | complaint | general
  summary TEXT DEFAULT '',
  transcript TEXT DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  follow_up_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Inbox (email / SMS summaries) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'email', -- email | sms
  sender TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  preview TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  category TEXT DEFAULT '', -- quote_request | invoice | scheduling | supplier | other
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'unread', -- unread | read | actioned
  received_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── AI activity log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'assistant', -- quote_draft | invoice_chase | call_summary | insight | assistant
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed', -- completed | pending | failed
  related_type TEXT DEFAULT '', -- quote | invoice | job | call
  related_id INTEGER,
  source TEXT NOT NULL DEFAULT 'mock', -- mock | openrouter
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Settings (key/value) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── Subscription / plan state (single row) ─────────────────────────
CREATE TABLE IF NOT EXISTS subscription (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  plan TEXT NOT NULL DEFAULT 'starter', -- starter | pro | scale
  status TEXT NOT NULL DEFAULT 'trialing', -- trialing | active | past_due | cancelled
  seats INTEGER NOT NULL DEFAULT 3,
  renews_at TEXT DEFAULT '',
  trial_ends_at TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Counters for new entities ──────────────────────────────────────
INSERT OR IGNORE INTO _meta (key, value) VALUES ('quote_counter', '0');
INSERT OR IGNORE INTO _meta (key, value) VALUES ('quote_prefix', 'QTE');

-- ── Indexes for new tables ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_price_history_product ON supplier_price_history(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote ON quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_receptionist_calls_customer ON receptionist_calls(customer_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_status ON inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_ai_activity_kind ON ai_activity(kind);

-- ════════════════════════════════════════════════════════════════════
-- Demo seed data (idempotent). Dates are relative to date('now') so the
-- demo always looks live regardless of when it boots.
-- ════════════════════════════════════════════════════════════════════

-- Customers (10)
INSERT OR IGNORE INTO customers (id, name, email, phone, address, city, state, zip, notes) VALUES
  (1, 'Aldridge Property Group', 'ops@aldridge-pg.co.uk', '020 7946 0011', '14 Carnaby Street', 'London', 'LDN', 'W1F 9PS', 'Managed estate, multiple sites'),
  (2, 'Bramble Cafe', 'hello@bramblecafe.co.uk', '0161 496 0022', '8 Deansgate', 'Manchester', 'GTM', 'M3 2BW', 'Commercial kitchen, priority callouts'),
  (3, 'Sophie Hartley', 'sophie.hartley@gmail.com', '07700 900033', '22 Elm Close', 'Leeds', 'WYK', 'LS6 2AA', 'Domestic, prefers morning slots'),
  (4, 'Northgate Logistics', 'facilities@northgate-log.co.uk', '0151 496 0044', 'Unit 5 Dock Road', 'Liverpool', 'MSY', 'L3 4BP', 'Warehouse HVAC contract'),
  (5, 'Marcus Bell', 'marcus.bell@outlook.com', '07700 900055', '3 Riverside Walk', 'Bristol', 'BST', 'BS1 6XN', 'Repeat customer'),
  (6, 'Willow & Co Salon', 'bookings@willowandco.co.uk', '0117 496 0066', '41 Park Street', 'Bristol', 'BST', 'BS1 5NG', 'Annual maintenance plan'),
  (7, 'Priya Nair', 'priya.nair@gmail.com', '07700 900077', '17 Maple Avenue', 'Birmingham', 'WMD', 'B15 2TT', 'New build, boiler install'),
  (8, 'Kestrel Self Storage', 'site@kestrelstorage.co.uk', '0121 496 0088', 'Kestrel Park', 'Birmingham', 'WMD', 'B6 7EU', 'Roller-door servicing'),
  (9, 'Daniel Okafor', 'dan.okafor@gmail.com', '07700 900099', '90 Hill Lane', 'Sheffield', 'SYK', 'S10 1FG', 'Emergency leak last winter'),
  (10, 'Harbour View Apartments', 'concierge@harbourview.co.uk', '023 8049 0100', 'The Quay', 'Southampton', 'HAM', 'SO14 2AQ', 'Block of 24 units');

-- Technicians / staff (6)
INSERT OR IGNORE INTO technicians (id, name, email, phone, color, active) VALUES
  (1, 'James Carter', 'james@travisdemo.co.uk', '07700 901001', '#0891b2', 1),
  (2, 'Aisha Khan', 'aisha@travisdemo.co.uk', '07700 901002', '#16a34a', 1),
  (3, 'Tom Reilly', 'tom@travisdemo.co.uk', '07700 901003', '#9333ea', 1),
  (4, 'Grace Adeyemi', 'grace@travisdemo.co.uk', '07700 901004', '#ea580c', 1),
  (5, 'Liam Wood', 'liam@travisdemo.co.uk', '07700 901005', '#dc2626', 1),
  (6, 'Owner (You)', 'owner@travisdemo.co.uk', '07700 901006', '#ca8a04', 1);

-- Extra materials to reach 30 total (ids 6-30)
INSERT OR IGNORE INTO materials (id, name, unit, unit_cost, in_stock) VALUES
  (6, 'Copper Pipe 15mm', 'm', 4.5, 200),
  (7, 'Copper Pipe 22mm', 'm', 6.2, 150),
  (8, 'PTFE Tape', 'roll', 1.1, 120),
  (9, 'Radiator Valve', 'ea', 9.5, 60),
  (10, 'Thermostat', 'ea', 48, 25),
  (11, 'Boiler Pump', 'ea', 120, 8),
  (12, 'Expansion Vessel', 'ea', 65, 12),
  (13, 'Flue Kit', 'kit', 85, 10),
  (14, 'Condensate Pump', 'ea', 95, 6),
  (15, 'Cable 2.5mm T&E', 'm', 1.4, 300),
  (16, 'Consumer Unit', 'ea', 110, 7),
  (17, 'MCB 16A', 'ea', 6.5, 80),
  (18, 'RCD 63A', 'ea', 28, 30),
  (19, 'Socket Double', 'ea', 7.2, 90),
  (20, 'LED Downlight', 'ea', 12.5, 110),
  (21, 'Junction Box', 'ea', 3.8, 140),
  (22, 'Silicone Sealant', 'tube', 5.5, 70),
  (23, 'Drain Rods Set', 'set', 32, 9),
  (24, 'Tap Washer Kit', 'kit', 4.2, 100),
  (25, 'Ball Valve', 'ea', 11, 40),
  (26, 'Insulation Lagging', 'm', 2.3, 180),
  (27, 'Smoke Alarm', 'ea', 18, 50),
  (28, 'CO Detector', 'ea', 24, 35),
  (29, 'Compression Fitting', 'ea', 2.9, 160),
  (30, 'Waste Trap', 'ea', 6.8, 55);

-- Jobs (20) spread around today
INSERT OR IGNORE INTO jobs (id, identifier, customer_id, technician_id, service_type_id, status, priority, scheduled_date, scheduled_time, duration, price, address, notes) VALUES
  (1, 'JOB-1', 1, 1, 1, 'completed', 'normal', date('now','-5 days'), '09:00', 60, 150, '14 Carnaby Street, London', 'Routine service'),
  (2, 'JOB-2', 2, 2, 3, 'completed', 'urgent', date('now','-4 days'), '08:30', 90, 300, '8 Deansgate, Manchester', 'Emergency callout - resolved'),
  (3, 'JOB-3', 3, 1, 2, 'completed', 'normal', date('now','-3 days'), '10:00', 45, 75, '22 Elm Close, Leeds', 'Inspection passed'),
  (4, 'JOB-4', 4, 4, 6, 'completed', 'normal', date('now','-2 days'), '13:00', 60, 125, 'Unit 5 Dock Road, Liverpool', 'Quarterly maintenance'),
  (5, 'JOB-5', 5, 3, 1, 'completed', 'normal', date('now','-1 days'), '11:00', 60, 150, '3 Riverside Walk, Bristol', ''),
  (6, 'JOB-6', 1, 1, 1, 'scheduled', 'normal', date('now'), '08:30', 60, 150, '14 Carnaby Street, London', 'Panel upgrade - Acme'),
  (7, 'JOB-7', 2, 2, 2, 'confirmed', 'normal', date('now'), '11:00', 45, 75, '8 Deansgate, Manchester', 'Switchboard inspect'),
  (8, 'JOB-8', 9, 5, 3, 'scheduled', 'urgent', date('now'), '14:15', 90, 300, '90 Hill Lane, Sheffield', 'Emergency callout'),
  (9, 'JOB-9', 6, 4, 6, 'scheduled', 'normal', date('now','+1 days'), '09:30', 60, 125, '41 Park Street, Bristol', 'Annual maintenance'),
  (10, 'JOB-10', 7, 3, 5, 'scheduled', 'high', date('now','+1 days'), '12:00', 120, 400, '17 Maple Avenue, Birmingham', 'Boiler install'),
  (11, 'JOB-11', 8, 5, 6, 'scheduled', 'normal', date('now','+2 days'), '10:00', 60, 125, 'Kestrel Park, Birmingham', 'Roller-door service'),
  (12, 'JOB-12', 10, 1, 2, 'scheduled', 'normal', date('now','+2 days'), '15:00', 45, 75, 'The Quay, Southampton', 'Block inspection'),
  (13, 'JOB-13', 3, 2, 4, 'scheduled', 'low', date('now','+3 days'), '09:00', 30, 50, '22 Elm Close, Leeds', 'Follow-up'),
  (14, 'JOB-14', 4, 4, 1, 'scheduled', 'normal', date('now','+3 days'), '13:30', 60, 150, 'Unit 5 Dock Road, Liverpool', ''),
  (15, 'JOB-15', 5, 3, 6, 'scheduled', 'normal', date('now','+4 days'), '11:00', 60, 125, '3 Riverside Walk, Bristol', ''),
  (16, 'JOB-16', 6, 1, 1, 'scheduled', 'normal', date('now','+4 days'), '14:00', 60, 150, '41 Park Street, Bristol', ''),
  (17, 'JOB-17', 7, 5, 3, 'scheduled', 'high', date('now','+5 days'), '08:00', 90, 300, '17 Maple Avenue, Birmingham', ''),
  (18, 'JOB-18', 8, 2, 2, 'scheduled', 'normal', date('now','+6 days'), '10:30', 45, 75, 'Kestrel Park, Birmingham', ''),
  (19, 'JOB-19', 1, 4, 5, 'scheduled', 'normal', date('now','+7 days'), '09:00', 120, 400, '14 Carnaby Street, London', 'Install'),
  (20, 'JOB-20', 9, 3, 1, 'cancelled', 'normal', date('now','+2 days'), '16:00', 60, 150, '90 Hill Lane, Sheffield', 'Customer rescheduled');

-- Invoices (10) + lines
INSERT OR IGNORE INTO invoices (id, identifier, customer_id, job_id, status, subtotal, tax_rate, tax_amount, total, notes, due_date, paid_date, created_at) VALUES
  (1, 'INV-1', 1, 1, 'paid', 150, 20, 30, 180, '', date('now','-5 days'), date('now','-2 days'), datetime('now','-5 days')),
  (2, 'INV-2', 2, 2, 'paid', 325, 20, 65, 390, '', date('now','-4 days'), date('now','-1 days'), datetime('now','-4 days')),
  (3, 'INV-3', 3, 3, 'sent', 75, 20, 15, 90, '', date('now','+9 days'), '', datetime('now','-3 days')),
  (4, 'INV-4', 4, 4, 'sent', 125, 20, 25, 150, '', date('now','+10 days'), '', datetime('now','-2 days')),
  (5, 'INV-5', 5, 5, 'overdue', 150, 20, 30, 180, '', date('now','-3 days'), '', datetime('now','-12 days')),
  (6, 'INV-6', 9, NULL, 'overdue', 300, 20, 60, 360, '', date('now','-6 days'), '', datetime('now','-15 days')),
  (7, 'INV-7', 6, NULL, 'draft', 125, 20, 25, 150, '', '', '', datetime('now','-1 days')),
  (8, 'INV-8', 8, NULL, 'paid', 250, 20, 50, 300, '', date('now','-8 days'), date('now','-7 days'), datetime('now','-9 days')),
  (9, 'INV-9', 10, NULL, 'sent', 200, 20, 40, 240, '', date('now','+12 days'), '', datetime('now')),
  (10, 'INV-10', 7, NULL, 'draft', 400, 20, 80, 480, '', '', '', datetime('now'));

INSERT OR IGNORE INTO invoice_lines (id, invoice_id, description, quantity, unit_price, total) VALUES
  (1, 1, 'Standard Service', 1, 150, 150),
  (2, 2, 'Emergency callout', 1, 300, 300),
  (3, 2, 'Filter Replacement', 1, 25, 25),
  (4, 3, 'Inspection', 1, 75, 75),
  (5, 4, 'Maintenance', 1, 125, 125),
  (6, 5, 'Standard Service', 1, 150, 150),
  (7, 6, 'Emergency callout', 1, 300, 300),
  (8, 7, 'Maintenance', 1, 125, 125),
  (9, 8, 'Roller-door service', 1, 250, 250),
  (10, 9, 'Block inspection', 1, 200, 200),
  (11, 10, 'Boiler install', 1, 400, 400);

-- Supplier sources (3)
INSERT OR IGNORE INTO supplier_sources (id, name, kind, website, status, last_synced) VALUES
  (1, 'Wolseley', 'placeholder', 'wolseley.co.uk', 'active', datetime('now','-1 days')),
  (2, 'City Plumbing', 'placeholder', 'cityplumbing.co.uk', 'active', datetime('now','-2 days')),
  (3, 'Screwfix Trade', 'placeholder', 'screwfix.com', 'active', datetime('now','-1 days'));

-- Supplier products (8 price records) + history
INSERT OR IGNORE INTO supplier_products (id, supplier_id, sku, name, unit, current_price, previous_price, in_stock, updated_at) VALUES
  (1, 1, 'WS-CU15', 'Copper Pipe 15mm', 'm', 4.85, 4.50, 1, datetime('now','-1 days')),
  (2, 1, 'WS-CU22', 'Copper Pipe 22mm', 'm', 6.20, 6.20, 1, datetime('now','-1 days')),
  (3, 2, 'CP-RV', 'Radiator Valve', 'ea', 8.90, 9.50, 1, datetime('now','-2 days')),
  (4, 2, 'CP-THERM', 'Thermostat', 'ea', 52.00, 48.00, 1, datetime('now','-2 days')),
  (5, 3, 'SF-CU', 'Consumer Unit', 'ea', 118.00, 110.00, 1, datetime('now','-1 days')),
  (6, 3, 'SF-MCB16', 'MCB 16A', 'ea', 6.10, 6.50, 1, datetime('now','-1 days')),
  (7, 1, 'WS-PUMP', 'Boiler Pump', 'ea', 132.00, 120.00, 0, datetime('now','-1 days')),
  (8, 2, 'CP-FLUE', 'Flue Kit', 'kit', 85.00, 85.00, 1, datetime('now','-2 days'));

INSERT OR IGNORE INTO supplier_price_history (id, supplier_product_id, price, recorded_at) VALUES
  (1, 1, 4.50, datetime('now','-30 days')),
  (2, 1, 4.85, datetime('now','-1 days')),
  (3, 3, 9.50, datetime('now','-30 days')),
  (4, 3, 8.90, datetime('now','-2 days')),
  (5, 4, 48.00, datetime('now','-30 days')),
  (6, 4, 52.00, datetime('now','-2 days')),
  (7, 5, 110.00, datetime('now','-30 days')),
  (8, 5, 118.00, datetime('now','-1 days')),
  (9, 7, 120.00, datetime('now','-30 days')),
  (10, 7, 132.00, datetime('now','-1 days'));

-- Quotes (8) + lines (cost_at_time locks supplier cost)
INSERT OR IGNORE INTO quotes (id, identifier, customer_id, job_id, status, title, subtotal, cost_total, margin_amount, margin_pct, tax_rate, tax_amount, total, risk_level, notes, valid_until, sent_at, created_at) VALUES
  (1, 'QTE-1', 7, 10, 'sent', 'Combi boiler installation', 1850, 1180, 670, 36.2, 20, 370, 2220, 'medium', 'Includes flue kit and 7yr warranty', date('now','+14 days'), datetime('now','-2 days'), datetime('now','-2 days')),
  (2, 'QTE-2', 1, NULL, 'approved', 'Consumer unit upgrade x3 units', 1320, 760, 560, 42.4, 20, 264, 1584, 'low', 'Estate-wide electrical refresh', date('now','+10 days'), datetime('now','-6 days'), datetime('now','-6 days')),
  (3, 'QTE-3', 4, NULL, 'sent', 'Warehouse HVAC service contract', 4800, 3100, 1700, 35.4, 20, 960, 5760, 'high', 'Annual contract, 4 visits', date('now','+21 days'), datetime('now','-1 days'), datetime('now','-1 days')),
  (4, 'QTE-4', 3, NULL, 'draft', 'Bathroom re-pipe', 920, 540, 380, 41.3, 20, 184, 1104, 'low', '', '', '', datetime('now')),
  (5, 'QTE-5', 6, NULL, 'approved', 'Salon maintenance plan', 1500, 850, 650, 43.3, 20, 300, 1800, 'low', '12 month plan', date('now','-2 days'), datetime('now','-9 days'), datetime('now','-9 days')),
  (6, 'QTE-6', 10, NULL, 'rejected', 'Block-wide smoke alarm fit', 2640, 1900, 740, 28.0, 20, 528, 3168, 'medium', 'Lost on price', date('now','-1 days'), datetime('now','-12 days'), datetime('now','-12 days')),
  (7, 'QTE-7', 8, NULL, 'viewed', 'Roller-door motor replacement', 780, 460, 320, 41.0, 20, 156, 936, 'low', '', date('now','+12 days'), datetime('now','-3 days'), datetime('now','-3 days')),
  (8, 'QTE-8', 5, NULL, 'draft', 'Underfloor heating quote', 3200, 2200, 1000, 31.3, 20, 640, 3840, 'medium', 'Awaiting final measurements', '', '', datetime('now'));

INSERT OR IGNORE INTO quote_lines (id, quote_id, description, kind, material_id, supplier_product_id, quantity, cost_at_time, unit_price, total, sort_order) VALUES
  (1, 1, 'Combi boiler unit', 'supplier', NULL, 7, 1, 120.00, 1100, 1100, 0),
  (2, 1, 'Flue kit', 'supplier', NULL, 8, 1, 85.00, 250, 250, 1),
  (3, 1, 'Labour (install)', 'labor', NULL, NULL, 8, 35.00, 62.5, 500, 2),
  (4, 2, 'Consumer unit', 'supplier', NULL, 5, 3, 110.00, 240, 720, 0),
  (5, 2, 'Labour', 'labor', NULL, NULL, 12, 33.00, 50, 600, 1),
  (6, 3, 'Service visits (4)', 'labor', NULL, NULL, 32, 60.00, 100, 3200, 0),
  (7, 3, 'Parts allowance', 'material', NULL, NULL, 1, 1600.00, 1600, 1600, 1),
  (8, 4, 'Copper pipe 15mm', 'supplier', NULL, 1, 40, 4.50, 8, 320, 0),
  (9, 4, 'Labour', 'labor', NULL, NULL, 12, 33.00, 50, 600, 1),
  (10, 5, 'Maintenance plan (annual)', 'labor', NULL, NULL, 12, 50.00, 125, 1500, 0),
  (11, 7, 'Roller-door motor', 'material', NULL, NULL, 1, 280.00, 480, 480, 0),
  (12, 7, 'Labour', 'labor', NULL, NULL, 6, 30.00, 50, 300, 1);

-- Receptionist calls (5)
INSERT OR IGNORE INTO receptionist_calls (id, caller_name, caller_phone, customer_id, direction, status, intent, summary, duration_seconds, follow_up_required, created_at) VALUES
  (1, 'Priya Nair', '07700 900077', 7, 'inbound', 'completed', 'quote', 'Asked for a boiler installation quote; Travis captured details and created a draft quote.', 184, 1, datetime('now','-2 hours')),
  (2, 'Unknown', '07700 905512', NULL, 'inbound', 'missed', 'general', 'Missed call out of hours; voicemail transcribed, no callback number recognised.', 0, 1, datetime('now','-5 hours')),
  (3, 'Marcus Bell', '07700 900055', 5, 'inbound', 'completed', 'booking', 'Booked a standard service for next week; added to schedule.', 142, 0, datetime('now','-1 days')),
  (4, 'Bramble Cafe', '0161 496 0022', 2, 'inbound', 'completed', 'complaint', 'Reported a recurring drainage smell; flagged for urgent follow-up.', 233, 1, datetime('now','-1 days')),
  (5, 'Daniel Okafor', '07700 900099', 9, 'inbound', 'voicemail', 'quote', 'Left voicemail requesting a callback about an overdue invoice query.', 47, 1, datetime('now','-3 hours'));

-- Inbox items (5 email summaries)
INSERT OR IGNORE INTO inbox_items (id, source, sender, subject, preview, summary, category, customer_id, status, received_at) VALUES
  (1, 'email', 'priya.nair@gmail.com', 'Boiler quote follow-up', 'Hi, just checking on the quote we discussed...', 'Customer chasing the boiler installation quote sent 2 days ago.', 'quote_request', 7, 'unread', datetime('now','-1 hours')),
  (2, 'email', 'facilities@northgate-log.co.uk', 'HVAC contract questions', 'Can you confirm the visit frequency...', 'Northgate asking to clarify the 4-visit annual HVAC contract terms.', 'quote_request', 4, 'unread', datetime('now','-4 hours')),
  (3, 'email', 'accounts@aldridge-pg.co.uk', 'Remittance advice INV-1', 'Payment sent for invoice INV-1...', 'Aldridge confirmed payment of INV-1 (£180).', 'invoice', 1, 'read', datetime('now','-1 days')),
  (4, 'email', 'no-reply@wolseley.co.uk', 'Price update: copper pipe', 'Prices for selected lines have changed...', 'Supplier notice: copper pipe 15mm up to £4.85/m.', 'supplier', NULL, 'unread', datetime('now','-1 days')),
  (5, 'email', 'bookings@willowandco.co.uk', 'Reschedule maintenance visit', 'Could we move our visit to the afternoon...', 'Willow & Co requesting an afternoon slot for their maintenance visit.', 'scheduling', 6, 'actioned', datetime('now','-2 days'));

-- AI activity log (10)
INSERT OR IGNORE INTO ai_activity (id, kind, title, detail, status, related_type, related_id, source, created_at) VALUES
  (1, 'quote_draft', 'Drafted quote QTE-1 from call', 'Generated a boiler installation quote from Priya Nair''s phone enquiry.', 'completed', 'quote', 1, 'mock', datetime('now','-2 hours')),
  (2, 'call_summary', 'Summarised 5 receptionist calls', 'Transcribed and categorised today''s inbound calls.', 'completed', 'call', NULL, 'mock', datetime('now','-3 hours')),
  (3, 'invoice_chase', 'Chased 2 overdue invoices', 'Sent polite reminders for INV-5 and INV-6.', 'completed', 'invoice', 5, 'mock', datetime('now','-4 hours')),
  (4, 'insight', 'Margin alert on QTE-6', 'Flagged that QTE-6 margin (28%) is below your 35% target.', 'completed', 'quote', 6, 'mock', datetime('now','-5 hours')),
  (5, 'insight', 'Supplier price increase detected', 'Boiler pump cost up 10% at Wolseley; review open quotes.', 'completed', 'quote', NULL, 'mock', datetime('now','-6 hours')),
  (6, 'assistant', 'Answered: what is due this week?', 'Listed 3 invoices totalling £480 due in the next 7 days.', 'completed', '', NULL, 'mock', datetime('now','-1 days')),
  (7, 'quote_draft', 'Drafted quote QTE-4', 'Prepared a bathroom re-pipe quote for Sophie Hartley.', 'completed', 'quote', 4, 'mock', datetime('now','-1 days')),
  (8, 'call_summary', 'Flagged urgent complaint', 'Bramble Cafe drainage complaint marked for urgent follow-up.', 'completed', 'call', 4, 'mock', datetime('now','-1 days')),
  (9, 'insight', 'Quote win-rate this month', 'Win rate at 50% (2 approved of 4 closed).', 'completed', '', NULL, 'mock', datetime('now','-2 days')),
  (10, 'invoice_chase', 'Scheduled reminder for INV-3', 'Will follow up if INV-3 is unpaid by its due date.', 'pending', 'invoice', 3, 'mock', datetime('now','-2 days'));

-- Settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('business_name', 'Travis Demo Trades Ltd'),
  ('currency', 'GBP'),
  ('default_tax_rate', '20'),
  ('target_margin_pct', '35'),
  ('ai_enabled', '1'),
  ('ai_model', 'openai/gpt-4o-mini'),
  ('timezone', 'Europe/London');

-- Subscription (single row)
INSERT OR IGNORE INTO subscription (id, plan, status, seats, renews_at, trial_ends_at) VALUES
  (1, 'pro', 'active', 6, date('now','+24 days'), '');

-- Bump counters past seeded ids so new records never collide with seed.
UPDATE _meta SET value = '20' WHERE key = 'job_counter' AND CAST(value AS INTEGER) < 20;
UPDATE _meta SET value = '10' WHERE key = 'invoice_counter' AND CAST(value AS INTEGER) < 10;
UPDATE _meta SET value = '8' WHERE key = 'quote_counter' AND CAST(value AS INTEGER) < 8;
