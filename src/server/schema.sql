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

-- Example materials (ids 1-5, original)
INSERT OR IGNORE INTO materials (id, name, unit, unit_cost, in_stock)
VALUES
  (1, 'Service Fee', 'ea', 0, 999),
  (2, 'Filter Replacement', 'ea', 25, 50),
  (3, 'Sealant', 'tube', 12, 30),
  (4, 'Travel Surcharge', 'ea', 35, 999),
  (5, 'Disposable Supplies', 'kit', 8, 100);

-- Extended materials (ids 6-30)
INSERT OR IGNORE INTO materials (id, name, unit, unit_cost, in_stock) VALUES
  (6,  'Capacitor 35/5 MFD',      'ea',   18.50,  40),
  (7,  'Contactor 24V',            'ea',   32.00,  25),
  (8,  'Digital Thermostat',       'ea',   85.00,  15),
  (9,  'Refrigerant R-410A',       'lb',   22.00,  60),
  (10, 'Blower Motor 1/2HP',       'ea',  145.00,  10),
  (11, 'P-Trap 1.5"',              'ea',    6.50,  80),
  (12, 'Ball Valve 3/4"',          'ea',   12.00,  50),
  (13, 'Teflon Tape',              'roll',  1.50, 200),
  (14, 'Copper Elbow 3/4"',        'ea',    3.20, 100),
  (15, 'Drain Auger 25ft',         'ea',   48.00,   8),
  (16, 'Circuit Breaker 20A',      'ea',   14.00,  30),
  (17, 'Wire Nuts (bag/100)',       'bag',   4.50,  60),
  (18, 'Electrical Tape',          'roll',  2.00, 120),
  (19, 'Conduit 3/4" x 10ft',      'ea',    8.50,  35),
  (20, 'Junction Box 4"',          'ea',    5.50,  55),
  (21, 'Caulk Gun',                'ea',   11.00,  20),
  (22, 'Silicone Sealant',         'tube',  7.50,  70),
  (23, 'Mounting Screws (box/50)', 'box',   3.80,  90),
  (24, 'Wall Anchors (pack/20)',   'pack',  4.20,  85),
  (25, 'Cable Ties (pack/100)',    'pack',  3.50, 150),
  (26, 'Diagnostic Fee',           'ea',   65.00, 999),
  (27, 'After Hours Surcharge',    'ea',   95.00, 999),
  (28, 'Material Freight',         'ea',   18.00, 999),
  (29, 'PPE Kit (single use)',     'kit',   9.50, 200),
  (30, 'Consumables Allowance',    'ea',   15.00, 999);

-- ── Customers seed ────────────────────────────────────────────────────
INSERT OR IGNORE INTO customers (id, name, email, phone, address, city, state, zip, notes) VALUES
  (1,  'James Hartley',    'james.hartley@email.com',    '0412 001 001', '14 Banksia Dr',       'Manly',         'NSW', '2095', 'Long-term client. Prefers morning slots.'),
  (2,  'Sarah Chen',       'sarah.chen@email.com',       '0413 002 002', '28 Eucalyptus Ave',   'Surry Hills',   'NSW', '2010', 'Referral from James Hartley.'),
  (3,  'Robert Mitchell',  'r.mitchell@tradeco.com.au',  '0414 003 003', '55 Wattle St',        'Parramatta',    'NSW', '2150', 'Commercial client. Multiple sites.'),
  (4,  'Emma Wilson',      'emma.wilson@email.com',      '0415 004 004', '6 Jacaranda Pl',      'Balmain',       'NSW', '2041', ''),
  (5,  'David Nguyen',     'david.nguyen@email.com',     '0416 005 005', '103 Rosewood Ct',     'Liverpool',     'NSW', '2170', 'Prefers SMS updates.'),
  (6,  'Lisa Kowalski',    'lisa.k@email.com',           '0417 006 006', '9 Cedar Lane',        'Cronulla',      'NSW', '2230', 'Has a dog on premises.'),
  (7,  'Tom O''Brien',     'tom.obrien@email.com',       '0418 007 007', '44 Paperbark Way',    'Castle Hill',   'NSW', '2154', 'Elderly — allow extra time.'),
  (8,  'Anna Peterson',    'a.peterson@email.com',       '0419 008 008', '71 Ironbark Rd',      'Penrith',       'NSW', '2750', ''),
  (9,  'Mark Sullivan',    'mark.s@email.com',           '0420 009 009', '23 Frangipani Cres',  'Dee Why',       'NSW', '2099', 'Flexible scheduling.'),
  (10, 'Karen Thompson',   'karen.t@email.com',          '0421 010 010', '18 Bottlebrush St',   'Campbelltown',  'NSW', '2560', 'Referred by Lisa Kowalski.');

-- ── Technicians seed ──────────────────────────────────────────────────
INSERT OR IGNORE INTO technicians (id, name, email, phone, color, active) VALUES
  (1, 'Jake Reynolds', 'jake@company.com',  '0431 100 001', '#0ea5e9', 1),
  (2, 'Maria Santos',  'maria@company.com', '0431 100 002', '#10b981', 1),
  (3, 'Chris Walker',  'chris@company.com', '0431 100 003', '#f59e0b', 1),
  (4, 'Priya Sharma',  'priya@company.com', '0431 100 004', '#8b5cf6', 1),
  (5, 'Ben Tran',      'ben@company.com',   '0431 100 005', '#ec4899', 1),
  (6, 'Sam Okafor',    'sam@company.com',   '0431 100 006', '#06b6d4', 1);

-- ── Jobs seed (20 jobs) ───────────────────────────────────────────────
INSERT OR IGNORE INTO jobs (id, identifier, customer_id, technician_id, service_type_id, status, priority, scheduled_date, scheduled_time, duration, price, address, notes) VALUES
  (1,  'JOB-1',  1,    1,    1, 'completed',   'normal', date('now','-14 days'), '09:00', 90,  185.00, '14 Banksia Dr, Manly NSW 2095',         'Annual service check.'),
  (2,  'JOB-2',  2,    2,    2, 'completed',   'normal', date('now','-12 days'), '10:30', 60,   95.00, '28 Eucalyptus Ave, Surry Hills NSW 2010','Pre-purchase inspection.'),
  (3,  'JOB-3',  3,    3,    3, 'completed',   'high',   date('now','-10 days'), '07:30', 90,  385.00, '55 Wattle St, Parramatta NSW 2150',      'Emergency call — unit down.'),
  (4,  'JOB-4',  4,    1,    6, 'completed',   'normal', date('now', '-8 days'), '11:00', 60,  145.00, '6 Jacaranda Pl, Balmain NSW 2041',       'Routine maintenance.'),
  (5,  'JOB-5',  5,    2,    1, 'completed',   'normal', date('now', '-6 days'), '08:30', 90,  195.00, '103 Rosewood Ct, Liverpool NSW 2170',    'Annual service.'),
  (6,  'JOB-6',  6,    4,    5, 'completed',   'high',   date('now', '-5 days'), '09:00',120,  480.00, '9 Cedar Lane, Cronulla NSW 2230',         'New system installation.'),
  (7,  'JOB-7',  7,    3,    1, 'completed',   'normal', date('now', '-3 days'), '13:00', 90,  210.00, '44 Paperbark Way, Castle Hill NSW 2154', 'Service + filter swap.'),
  (8,  'JOB-8',  8,    5,    2, 'completed',   'low',    date('now', '-2 days'), '14:00', 45,   95.00, '71 Ironbark Rd, Penrith NSW 2750',       'Follow-up inspection.'),
  (9,  'JOB-9',  9,    1,    1, 'in_progress', 'normal', date('now'),            '09:00', 90,  215.00, '23 Frangipani Cres, Dee Why NSW 2099',   'Standard service.'),
  (10, 'JOB-10', 10,   6,    4, 'in_progress', 'high',   date('now'),            '10:00', 60,   75.00, '18 Bottlebrush St, Campbelltown NSW 2560','Follow-up from quote.'),
  (11, 'JOB-11', 1,    2,    6, 'scheduled',   'normal', date('now',  '+1 day'), '08:30', 60,  145.00, '14 Banksia Dr, Manly NSW 2095',          'Maintenance visit.'),
  (12, 'JOB-12', 2,    3,    1, 'scheduled',   'low',    date('now',  '+2 days'),'11:00', 90,  185.00, '28 Eucalyptus Ave, Surry Hills NSW 2010', ''),
  (13, 'JOB-13', 3,    4,    2, 'scheduled',   'normal', date('now',  '+3 days'),'09:30', 60,   95.00, '55 Wattle St, Parramatta NSW 2150',      'Site inspection.'),
  (14, 'JOB-14', 4,    5,    3, 'scheduled',   'urgent', date('now',  '+4 days'),'07:00', 90,  395.00, '6 Jacaranda Pl, Balmain NSW 2041',       'Emergency follow-up.'),
  (15, 'JOB-15', 5,    6,    5, 'scheduled',   'high',   date('now',  '+7 days'),'10:00',120,  480.00, '103 Rosewood Ct, Liverpool NSW 2170',    'Split system install.'),
  (16, 'JOB-16', 6,    1,    1, 'scheduled',   'normal', date('now', '+10 days'),'09:00', 90,  185.00, '9 Cedar Lane, Cronulla NSW 2230',         ''),
  (17, 'JOB-17', 7,    2,    6, 'confirmed',   'normal', date('now', '+14 days'),'08:00', 60,  145.00, '44 Paperbark Way, Castle Hill NSW 2154', 'Confirmed by customer.'),
  (18, 'JOB-18', 8,    3,    2, 'confirmed',   'low',    date('now', '+21 days'),'13:00', 60,   95.00, '71 Ironbark Rd, Penrith NSW 2750',       ''),
  (19, 'JOB-19', 9,    1,    1, 'confirmed',   'normal', date('now', '+28 days'),'09:00', 90,  220.00, '23 Frangipani Cres, Dee Why NSW 2099',   ''),
  (20, 'JOB-20', 10, NULL, NULL, 'cancelled',  'normal', date('now',  '-1 day'), '10:00', 60,    0.00, '18 Bottlebrush St, Campbelltown NSW 2560','Customer cancelled same day.');

-- ── Invoices seed (10) ────────────────────────────────────────────────
INSERT OR IGNORE INTO invoices (id, identifier, customer_id, job_id, status, subtotal, tax_rate, tax_amount, total, notes, due_date, paid_date) VALUES
  (1,  'INV-1',  1,  1,  'paid',    185.00, 10, 18.50,  203.50, '',  date('now','-10 days'), date('now', '-8 days')),
  (2,  'INV-2',  2,  2,  'paid',     95.00, 10,  9.50,  104.50, '',  date('now', '-8 days'), date('now', '-7 days')),
  (3,  'INV-3',  3,  3,  'paid',    385.00, 10, 38.50,  423.50, '',  date('now', '-6 days'), date('now', '-5 days')),
  (4,  'INV-4',  4,  4,  'paid',    145.00, 10, 14.50,  159.50, '',  date('now', '-4 days'), date('now', '-3 days')),
  (5,  'INV-5',  5,  5,  'sent',    195.00, 10, 19.50,  214.50, '',  date('now',  '+7 days'), ''),
  (6,  'INV-6',  6,  6,  'sent',    480.00, 10, 48.00,  528.00, '',  date('now', '+14 days'), ''),
  (7,  'INV-7',  7,  7,  'sent',    210.00, 10, 21.00,  231.00, '',  date('now',  '+7 days'), ''),
  (8,  'INV-8',  8,  8,  'overdue',  95.00, 10,  9.50,  104.50, '',  date('now', '-7 days'), ''),
  (9,  'INV-9',  9, NULL,'overdue', 220.00, 10, 22.00,  242.00, 'Service call + parts', date('now','-14 days'), ''),
  (10, 'INV-10',10, NULL,'draft',   350.00, 10, 35.00,  385.00, 'Pending job completion', '', '');

INSERT OR IGNORE INTO invoices (id, identifier, customer_id, job_id, status, subtotal, tax_rate, tax_amount, total, notes, due_date, paid_date, created_at) VALUES
  (91, 'INV-91', 1, NULL, 'paid', 220.00, 10, 22.00, 242.00, '', date('now','-15 days'), date('now','-14 days'), date('now','-15 days')),
  (92, 'INV-92', 2, NULL, 'paid', 155.00, 10, 15.50, 170.50, '', date('now','-35 days'), date('now','-34 days'), date('now','-35 days'));

INSERT OR IGNORE INTO invoice_lines (id, invoice_id, description, quantity, unit_price, total) VALUES
  (1,  1,  'Standard Service',         1, 185.00, 185.00),
  (2,  2,  'Inspection',               1,  95.00,  95.00),
  (3,  3,  'Emergency Call-out',       1, 350.00, 350.00),
  (4,  3,  'After Hours Surcharge',    1,  35.00,  35.00),
  (5,  4,  'Routine Maintenance',      1, 125.00, 125.00),
  (6,  4,  'Filter Replacement',       1,  20.00,  20.00),
  (7,  5,  'Annual Service',           1, 185.00, 185.00),
  (8,  5,  'Refrigerant Top-up',       1,  10.00,  10.00),
  (9,  6,  'Split System Installation',1, 420.00, 420.00),
  (10, 6,  'Material Freight',         1,  60.00,  60.00),
  (11, 7,  'Service Visit',            1, 185.00, 185.00),
  (12, 7,  'Filter x2',                2,  12.50,  25.00),
  (13, 8,  'Follow-up Inspection',     1,  95.00,  95.00),
  (14, 9,  'Standard Service',         1, 185.00, 185.00),
  (15, 9,  'Capacitor Replacement',    1,  35.00,  35.00),
  (16, 10, 'Diagnostic Assessment',    1,  65.00,  65.00),
  (17, 10, 'Repair Labour 3hr',        3,  95.00, 285.00);

-- ── New tables ────────────────────────────────────────────────────────
-- Recreate module tables on local dev bootstrap so column changes apply.
DROP TABLE IF EXISTS quote_lines;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS supplier_price_history;
DROP TABLE IF EXISTS supplier_products;
DROP TABLE IF EXISTS supplier_sources;
DROP TABLE IF EXISTS inbox_items;
DROP TABLE IF EXISTS ai_activity;
DROP TABLE IF EXISTS receptionist_calls;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS subscription;

CREATE TABLE IF NOT EXISTS supplier_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  website TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES supplier_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'ea',
  current_price REAL NOT NULL DEFAULT 0,
  last_checked TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'changed',
  user_email TEXT NOT NULL DEFAULT '',
  recorded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  source_quote_id INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT DEFAULT '',
  subtotal REAL NOT NULL DEFAULT 0,
  cost_total REAL NOT NULL DEFAULT 0,
  margin_amount REAL NOT NULL DEFAULT 0,
  margin_pct REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  notes TEXT DEFAULT '',
  valid_until TEXT DEFAULT '',
  sent_at TEXT DEFAULT '',
  approved_at TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quote_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'labor',
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  supplier_product_id INTEGER REFERENCES supplier_products(id) ON DELETE SET NULL,
  quantity REAL NOT NULL DEFAULT 1,
  cost_at_time REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS receptionist_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_name TEXT NOT NULL DEFAULT '',
  caller_phone TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  duration_secs INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inbox_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'email',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  sender TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unread',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  thread_id INTEGER REFERENCES inbox_items(id) ON DELETE SET NULL,
  ai_summary TEXT DEFAULT '',
  ai_action TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  input_summary TEXT NOT NULL DEFAULT '',
  output_summary TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'My Business',
  company_phone TEXT NOT NULL DEFAULT '',
  company_email TEXT NOT NULL DEFAULT '',
  company_address TEXT NOT NULL DEFAULT '',
  company_logo_url TEXT NOT NULL DEFAULT '',
  tax_rate REAL NOT NULL DEFAULT 10,
  currency TEXT NOT NULL DEFAULT 'AUD',
  timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  job_prefix TEXT NOT NULL DEFAULT 'JOB',
  quote_prefix TEXT NOT NULL DEFAULT 'QUO',
  inbox_agent_interval_hours REAL NOT NULL DEFAULT 1,
  ai_model TEXT NOT NULL DEFAULT 'anthropic/claude-3-haiku',
  from_email TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscription (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'active',
  modules TEXT NOT NULL DEFAULT '[]',
  trial_ends_at TEXT DEFAULT '',
  renewal_date TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── New _meta keys ────────────────────────────────────────────────────
INSERT OR IGNORE INTO _meta (key, value) VALUES ('quote_counter', '0');
INSERT OR IGNORE INTO _meta (key, value) VALUES ('quote_prefix',  'QUO');

-- Bump counters past seeded maximums (never reduce)
UPDATE _meta SET value = '20' WHERE key = 'job_counter'     AND CAST(value AS INTEGER) < 20;
UPDATE _meta SET value = '10' WHERE key = 'invoice_counter' AND CAST(value AS INTEGER) < 10;
UPDATE _meta SET value = '8'  WHERE key = 'quote_counter'   AND CAST(value AS INTEGER) < 8;

-- ── New indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotes_customer       ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status         ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote     ON quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_src ON supplier_products(source_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON supplier_price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_inbox_status          ON inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_ai_activity_module    ON ai_activity(module);
CREATE INDEX IF NOT EXISTS idx_rcalls_customer       ON receptionist_calls(customer_id);

-- ── Supplier sources seed ─────────────────────────────────────────────
INSERT OR IGNORE INTO supplier_sources (id, name, website, contact_email, notes, active) VALUES
  (1, 'TradeEasy Supplies',    'https://tradeeasy.com.au',  'orders@tradeeasy.com.au',  'Preferred HVAC supplier. Net 30.',  1),
  (2, 'BuildMart Direct',      'https://buildmart.com.au',  'sales@buildmart.com.au',   'Plumbing & building materials.',    1),
  (3, 'ProTech Components',    'https://protechcomp.com.au','info@protechcomp.com.au',  'Electrical & control components.',  1);

-- ── Supplier products seed (8) ────────────────────────────────────────
INSERT OR IGNORE INTO supplier_products (id, source_id, name, sku, unit, current_price, last_checked) VALUES
  (1, 1, 'Capacitor 35/5 MFD Dual Run',   'CAP-3505',  'ea',   19.80, datetime('now', '-1 day')),
  (2, 1, 'Contactor 24V 40A',             'CON-2440',  'ea',   34.50, datetime('now', '-1 day')),
  (3, 1, 'Refrigerant R-410A 25lb jug',   'REF-410A',  'jug', 285.00, datetime('now', '-2 days')),
  (4, 1, 'Blower Motor 1/2HP ECM',        'BLW-05ECM', 'ea',  162.00, datetime('now', '-2 days')),
  (5, 2, 'Ball Valve 3/4" Full Port',     'BV-75FP',   'ea',   13.20, datetime('now', '-1 day')),
  (6, 2, 'P-Trap 1.5" ABS',              'PT-15ABS',  'ea',    7.10, datetime('now', '-1 day')),
  (7, 3, 'Circuit Breaker 2P 20A',        'CB-220',    'ea',   15.90, datetime('now', '-3 days')),
  (8, 3, 'Wire Connector Assortment 100pk','WC-100',   'bag',   5.20, datetime('now', '-3 days'));

-- ── Supplier price history seed ───────────────────────────────────────
INSERT OR IGNORE INTO supplier_price_history (id, product_id, price, recorded_at) VALUES
  (1,  1, 17.50, datetime('now', '-30 days')),
  (2,  1, 18.20, datetime('now', '-15 days')),
  (3,  1, 19.80, datetime('now',  '-1 day')),
  (4,  2, 31.00, datetime('now', '-30 days')),
  (5,  2, 34.50, datetime('now',  '-1 day')),
  (6,  3, 270.00,datetime('now', '-30 days')),
  (7,  3, 285.00,datetime('now',  '-2 days')),
  (8,  4, 155.00,datetime('now', '-30 days')),
  (9,  4, 162.00,datetime('now',  '-2 days')),
  (10, 7, 14.50, datetime('now', '-30 days')),
  (11, 7, 15.90, datetime('now',  '-3 days'));

-- ── Quotes seed (8) ───────────────────────────────────────────────────
INSERT OR IGNORE INTO quotes (id, identifier, customer_id, job_id, status, title, subtotal, cost_total, margin_amount, margin_pct, tax_rate, tax_amount, total, risk_level, notes, valid_until, sent_at, approved_at) VALUES
  (1, 'QUO-1', 1, NULL, 'approved', 'Ducted system replacement', 2590.91, 1813.64, 777.27, 30, 10, 259.09, 2850.00, 'medium', 'Ducted system replacement + install.', date('now','+30 days'), datetime('now','-6 days'), datetime('now','-5 days')),
  (2, 'QUO-2', 2, NULL, 'sent',     'Split system install',      1090.91,  818.18, 272.73, 25, 10, 109.09, 1200.00, 'low',    'Split system supply & install.', date('now','+14 days'), datetime('now','-2 days'), ''),
  (3, 'QUO-3', 3, NULL, 'approved', 'Commercial 3-zone HVAC',    4090.91, 2659.09, 1431.82, 35, 10, 409.09, 4500.00, 'high',   'Commercial 3-zone HVAC system.', date('now','+30 days'), datetime('now','-3 days'), datetime('now','-2 days')),
  (4, 'QUO-4', 4, NULL, 'draft',    'Evaporative cooler service', 772.73,  618.18, 154.55, 20, 10,  77.27,  850.00, 'low',    'Evaporative cooler service + parts.', '', '', ''),
  (5, 'QUO-5', 5, NULL, 'sent',     'HVAC service contract',     1909.09, 1374.54, 534.55, 28, 10, 190.91, 2100.00, 'medium', 'Full HVAC system service contract.', date('now','+21 days'), datetime('now','-1 day'), ''),
  (6, 'QUO-6', 6, NULL, 'rejected', 'Reverse cycle install',     2909.09, 2036.36, 872.73, 30, 10, 290.91, 3200.00, 'medium', 'Ducted reverse cycle installation.', date('now','-7 days'), datetime('now','-10 days'), ''),
  (7, 'QUO-7', 7, NULL, 'expired',  'Bedroom split systems',     1636.36, 1227.27, 409.09, 25, 10, 163.64, 1800.00, 'low',    'Split system x2 bedrooms.', date('now','-14 days'), datetime('now','-20 days'), ''),
  (8, 'QUO-8', 8, NULL, 'draft',    'Maintenance plan',           863.64,  690.91, 172.73, 20, 10,  86.36,  950.00, 'low',    'Maintenance plan 12 months.', '', '', '');

INSERT OR IGNORE INTO quote_lines (id, quote_id, description, kind, quantity, unit_price, cost_at_time, total, sort_order) VALUES
  (1,  1, 'Ducted Unit 10kW Supply',           'material', 1, 1200.00, 980.00, 1200.00, 1),
  (2,  1, 'Installation Labour 6hr',           'labor',    6,  145.00, 145.00,  870.00, 2),
  (3,  1, 'Refrigerant R-410A 10lb',          'material', 10,   22.00,  22.00,  220.00, 3),
  (4,  1, 'Material Freight',                  'other',    1,   60.00,  60.00,   60.00, 4),
  (5,  2, 'Split System 5kW Supply',           'material', 1,  750.00, 620.00,  750.00, 1),
  (6,  2, 'Installation Labour 3hr',           'labor',    3,  145.00, 145.00,  435.00, 2),
  (7,  3, '3-Zone Control Board',              'material', 1,  850.00, 680.00,  850.00, 1),
  (8,  3, 'Zone Dampers x6',                  'material', 6,   95.00,  72.00,  570.00, 2),
  (9,  3, 'Installation Labour 8hr',           'labor',    8,  145.00, 145.00, 1160.00, 3),
  (10, 3, 'Commissioning',                     'labor',    1,  240.00, 240.00,  240.00, 4),
  (11, 4, 'Evaporative Cooler Service',        'labor',    1,  185.00, 185.00,  185.00, 1),
  (12, 4, 'Belt & Pads Kit',                   'material', 1,   85.00,  62.00,   85.00, 2),
  (13, 4, 'Motor Capacitor',                   'material', 1,   35.00,  18.50,   35.00, 3),
  (14, 5, 'Annual Service Contract (4 visits)','labor',    4,  425.00, 350.00, 1700.00, 1),
  (15, 5, 'Priority Call-out Included',        'other',    1,    0.00,   0.00,    0.00, 2),
  (16, 6, 'Reverse Cycle 8kW Supply',          'material', 1, 1200.00, 980.00, 1200.00, 1),
  (17, 6, 'Installation Labour 7hr',           'labor',    7,  145.00, 145.00, 1015.00, 2),
  (18, 7, 'Split System 2.5kW x2',             'material', 2,  680.00, 560.00, 1360.00, 1),
  (19, 7, 'Installation Labour 4hr',           'labor',    4,  145.00, 145.00,  580.00, 2),
  (20, 8, 'Annual Maintenance x4',             'labor',    4,  195.00, 195.00,  780.00, 1),
  (21, 8, 'Filter Pack x4',                    'material', 4,   20.00,  12.00,   80.00, 2);

-- ── Receptionist calls seed (5) ───────────────────────────────────────
INSERT OR IGNORE INTO receptionist_calls (id, caller_name, caller_phone, summary, action, customer_id, job_id, duration_secs) VALUES
  (1, 'James Hartley',   '0412 001 001', 'Called to confirm upcoming maintenance visit. Requested 8am start.', 'booked',   1, 11,   87),
  (2, 'Unknown Caller',  '0400 999 123', 'Urgent: system not cooling. Requested emergency visit ASAP.', 'booked',         NULL, NULL, 143),
  (3, 'Sarah Chen',      '0413 002 002', 'Asked about quote status for split system. Travis sent follow-up email.', 'callback', 2, NULL, 62),
  (4, 'Spam Caller',     '1300 555 000', 'Telemarketer. Blocked.', 'spam',                                          NULL, NULL,  18),
  (5, 'Tom O''Brien',    '0418 007 007', 'Rescheduled confirmed job to +14 days. Updated in system.', 'callback',    7,   17,  105);

-- ── Inbox items seed (5) ──────────────────────────────────────────────
INSERT OR IGNORE INTO inbox_items (id, source, subject, body, sender, status, customer_id, ai_summary, ai_action) VALUES
  (1, 'email', 'Request for quote — commercial HVAC',
     'Hi, we manage a 6-office building in Parramatta and need a full HVAC assessment and quote. Can you visit this week?',
     'r.mitchell@tradeco.com.au', 'actioned', 3,
     'Commercial client requesting HVAC assessment quote for 6-office building.',
     'create_quote'),
  (2, 'email', 'Invoice query — INV-8',
     'Hello, I received invoice INV-8 but I thought the job was covered under warranty. Can you clarify?',
     'a.peterson@email.com', 'unread', 8,
     'Customer querying invoice INV-8 — potential warranty dispute.',
     'flag_for_review'),
  (3, 'sms',   'Booking confirmation',
     'Hi this is David Nguyen confirming the install job next week. All good on our end.',
     '0416 005 005', 'read', 5,
     'Customer confirmed installation booking for next week.',
     'none'),
  (4, 'email', 'Referral — Karen Thompson',
     'I was referred by Lisa Kowalski. Looking for a reliable HVAC tech for ongoing maintenance. Do you offer contracts?',
     'karen.t@email.com', 'unread', 10,
     'New customer referral from Lisa Kowalski. Interested in maintenance contract.',
     'create_quote'),
  (5, 'email', 'Five-star review — thank you!',
     'Just wanted to say Jake did an amazing job yesterday. Very professional. Will definitely use you again.',
     'emma.wilson@email.com', 'read', 4,
     'Positive review from customer about technician Jake Reynolds.',
     'none'),
  (6, 'sms', 'New enquiry — service request',
     'Hi I found your number online. I need someone to look at my ducted air con, it stopped working yesterday. Can you help?',
     '0421 999 333', 'unread', NULL,
     'Unknown caller requesting ducted air conditioning repair.',
     'none');

-- ── Inbox thread replies seed (thread_id set by runtime migration) ────
INSERT OR IGNORE INTO inbox_items (id, source, subject, body, sender, status, customer_id, ai_summary, ai_action) VALUES
  (6, 'email_out', 'Re: Request for quote — commercial HVAC',
     'Hi Robert, thanks for reaching out. We''d be happy to carry out a full HVAC assessment for your building. We have availability this Thursday at 2pm — would that work for your team?',
     'r.mitchell@tradeco.com.au', 'actioned', 3, '', ''),
  (7, 'email', 'Re: Request for quote — commercial HVAC',
     'Thursday 2pm works perfectly. I''ll make sure our facilities manager is on-site. Looking forward to it.',
     'r.mitchell@tradeco.com.au', 'actioned', 3, '', ''),
  (8, 'email_out', 'Re: Invoice query — INV-8',
     'Hi Anna, thanks for getting in touch. After reviewing the job, I can confirm that the work carried out falls outside the warranty period. I''d be happy to walk you through the details — please give us a call at your convenience.',
     'a.peterson@email.com', 'actioned', 8, '', '');

-- ── AI activity seed (10) ─────────────────────────────────────────────
INSERT OR IGNORE INTO ai_activity (id, module, action, input_summary, output_summary, model, tokens_used, duration_ms) VALUES
  (1,  'quotes',      'draft_quote',     'Job notes for 3-zone commercial install',       'Generated 4-line quote draft, total $4,500',         'claude-3-haiku', 1240, 1820),
  (2,  'inbox',       'triage_email',    'Email from r.mitchell@tradeco.com.au',           'Categorised: quote request. Suggested action: create_quote', 'claude-3-haiku', 890, 1105),
  (3,  'receptionist','call_summary',    '143s call, unknown caller, emergency cooling',   'Booked emergency call-out. Created job JOB-3.',     'claude-3-haiku', 640,  980),
  (4,  'quotes',      'draft_quote',     'Split system install 2 bedrooms, Castle Hill',   'Generated 2-line quote draft, total $1,800',         'claude-3-haiku', 980, 1340),
  (5,  'inbox',       'triage_email',    'Invoice query from a.peterson@email.com',        'Flagged warranty dispute on INV-8 for review.',      'claude-3-haiku', 720, 1050),
  (6,  'assistant',   'answer_question', 'What jobs are overdue for invoicing?',           'Jobs 9 and 10 completed but no invoice issued.',     'claude-3-haiku', 580,  760),
  (7,  'quotes',      'margin_check',    'QUO-3 line items vs supplier prices',            'Margin 35% — within target range. Approved.',        'claude-3-haiku', 430,  620),
  (8,  'receptionist','call_summary',    '105s call, Tom O''Brien, reschedule request',    'Rescheduled JOB-17 to +14 days. Updated record.',   'claude-3-haiku', 510,  720),
  (9,  'inbox',       'draft_reply',     'Referral email from karen.t@email.com',          'Drafted welcome email + maintenance contract outline.','claude-3-haiku',1100, 1560),
  (10, 'assistant',   'answer_question', 'Summarise this week''s revenue',                 'Completed jobs this week: $475. 2 invoices sent.',   'claude-3-haiku', 610,  840);

-- ── Settings seed (single row) ────────────────────────────────────────
INSERT OR IGNORE INTO settings (id, company_name, company_phone, company_email, company_address, tax_rate, currency, timezone, invoice_prefix, job_prefix, quote_prefix) VALUES
  (1, 'AirPro Services', '02 9000 1234', 'admin@airproservices.com.au', '1/45 Industrial Ave, Artarmon NSW 2064', 10, 'AUD', 'Australia/Sydney', 'INV', 'JOB', 'QUO');

-- ── Subscription seed (single row) ───────────────────────────────────
INSERT OR IGNORE INTO subscription (id, plan, status, modules, trial_ends_at, renewal_date) VALUES
  (1, 'pro', 'active', '["quotes","schedule","invoices","receptionist","inbox","supplier-pricing","reports"]', '', date('now','+365 days'));

-- ── Stripe billing IDs (singleton, separate from subscription table) ────
CREATE TABLE IF NOT EXISTS billing_stripe (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  stripe_customer_id TEXT NOT NULL DEFAULT '',
  stripe_subscription_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO billing_stripe (id, stripe_customer_id, stripe_subscription_id) VALUES (1, '', '');

-- ── Users (authentication) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default owner: email=owner@travis.app, password=changeme123
INSERT OR IGNORE INTO users (id, email, password_hash, role) VALUES
  (1, 'owner@travis.app', 'pbkdf2$travis-owner-salt$ZDpMGLEO9UgxX42avb9xvTpk9yxKxW__3wxOuQ5O3_A', 'owner');

-- ── Google Calendar OAuth tokens (singleton) ───────────────────────
CREATE TABLE IF NOT EXISTS google_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL DEFAULT '',
  refresh_token TEXT NOT NULL DEFAULT '',
  token_expiry TEXT NOT NULL DEFAULT '',
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  google_email TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO google_tokens (id) VALUES (1);

-- ── Password reset tokens ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Google Calendar event ID per job (for update/delete)
CREATE TABLE IF NOT EXISTS job_gcal_events (
  job_id INTEGER PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL
);
