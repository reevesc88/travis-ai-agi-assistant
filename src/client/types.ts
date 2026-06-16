export type View =
  | "landing"
  | "login"
  | "forgot-password"
  | "reset-password"
  | "profile"
  | "dashboard"
  | "schedule"
  | "jobs"
  | "customers"
  | "technicians"
  | "services"
  | "invoices"
  | "materials"
  | "quotes"
  | "supplier-pricing"
  | "receptionist"
  | "inbox"
  | "ai-activity"
  | "reports"
  | "settings";

export type JobStatus = "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled";
export type Priority = "low" | "normal" | "high" | "urgent";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface Job {
  id: number;
  identifier: string;
  customer_id: number;
  technician_id: number | null;
  service_type_id: number | null;
  status: JobStatus;
  priority: Priority;
  scheduled_date: string;
  scheduled_time: string;
  duration: number;
  price: number;
  address: string;
  notes: string;
  completion_notes: string;
  is_recurring: number;
  recurrence_interval: string;
  next_recurrence_date: string;
  customer_name?: string;
  customer_phone?: string;
  technician_name?: string | null;
  technician_color?: string | null;
  service_type_name?: string | null;
  service_type_color?: string | null;
  gcal_event_id?: string | null;
  job_notes?: JobNote[];
  checklist?: ChecklistItem[];
  job_materials?: JobMaterial[];
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  job_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Technician {
  id: number;
  name: string;
  email: string;
  phone: string;
  color: string;
  active: number;
  job_count?: number;
  created_at: string;
}

export interface ServiceType {
  id: number;
  name: string;
  description: string;
  default_duration: number;
  default_price: number;
  color: string;
  created_at: string;
}

export interface JobNote {
  id: number;
  job_id: number;
  content: string;
  created_at: string;
}

export interface ChecklistItem {
  id: number;
  job_id: number;
  label: string;
  checked: number;
  sort_order: number;
}

export interface Material {
  id: number;
  name: string;
  unit: string;
  unit_cost: number;
  in_stock: number;
  created_at: string;
}

export interface JobMaterial {
  id: number;
  job_id: number;
  material_id: number;
  material_name?: string;
  material_unit?: string;
  quantity: number;
  unit_cost: number;
}

export interface Invoice {
  id: number;
  identifier: string;
  customer_id: number;
  job_id: number | null;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string;
  due_date: string;
  paid_date: string;
  customer_name?: string;
  job_identifier?: string;
  lines?: InvoiceLine[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Stats {
  jobs: number;
  customers: number;
  technicians: number;
  service_types: number;
  today_jobs: number;
  upcoming_jobs: number;
  completed_jobs: number;
  revenue: number;
  invoices_outstanding: number;
  invoices_overdue: number;
  inbox_unread: number;
  quotes_open: number;
  quotes_value: number;
  stale_supplier_prices: number;
}

export type QuoteStatus = "draft" | "sent" | "viewed" | "approved" | "rejected" | "expired";
export type RiskLevel = "low" | "medium" | "high";

export interface QuoteLine {
  id: number;
  quote_id: number;
  description: string;
  kind: "labor" | "material" | "supplier";
  material_id: number | null;
  supplier_product_id: number | null;
  quantity: number;
  cost_at_time: number;
  unit_price: number;
  total: number;
  sort_order: number;
}

export interface Quote {
  id: number;
  identifier: string;
  customer_id: number;
  job_id: number | null;
  status: QuoteStatus;
  title: string;
  subtotal: number;
  cost_total: number;
  margin_amount: number;
  margin_pct: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  risk_level: RiskLevel;
  notes: string;
  valid_until: string;
  sent_at: string;
  approved_at: string;
  source_quote_id?: number | null;
  source_identifier?: string | null;
  customer_name?: string;
  job_identifier?: string;
  lines?: QuoteLine[];
  created_at: string;
  updated_at: string;
}

export interface SupplierSource {
  id: number;
  name: string;
  website: string;
  contact_email: string;
  notes: string;
  active: number;
  created_at: string;
}

export interface SupplierProduct {
  id: number;
  source_id: number;
  name: string;
  sku: string;
  unit: string;
  current_price: number;
  last_checked: string;
  created_at: string;
  source_name?: string;
  prev_price?: number | null;
  price_history?: SupplierPriceHistory[];
}

export interface SupplierPriceHistory {
  id: number;
  product_id: number;
  price: number;
  event_type: "checked" | "changed";
  user_email: string;
  recorded_at: string;
}

export interface ReceptionistCall {
  id: number;
  caller_name: string;
  caller_phone: string;
  summary: string;
  action: string;
  customer_id: number | null;
  job_id: number | null;
  duration_secs: number;
  customer_name?: string;
  job_identifier?: string;
  created_at: string;
  ai_output_summary?: string | null;
  ai_action_name?: string | null;
  ai_model?: string | null;
}

export type InboxStatus = "unread" | "read" | "actioned" | "archived";

export interface InboxItem {
  id: number;
  source: string;
  subject: string;
  body: string;
  sender: string;
  status: InboxStatus;
  customer_id: number | null;
  thread_id: number | null;
  ai_summary: string;
  ai_action: string;
  customer_name?: string;
  reply_count?: number;
  unread_replies?: number;
  latest_at?: string;
  created_at: string;
}

export interface AIActivity {
  id: number;
  module: string;
  action: string;
  input_summary: string;
  output_summary: string;
  model: string;
  tokens_used: number;
  duration_ms: number;
  created_at: string;
}

export interface ReportSummary {
  revenue_total: number;
  revenue_paid: number;
  revenue_outstanding: number;
  revenue_overdue: number;
  prior_revenue_paid: number | null;
  prior_revenue_outstanding: number | null;
  prior_revenue_overdue: number | null;
  kpi_paid_change_pct: number | null;
  kpi_outstanding_change_pct: number | null;
  kpi_overdue_change_pct: number | null;
  jobs_total: number;
  jobs_completed: number;
  jobs_scheduled: number;
  quotes_total: number;
  quotes_accepted: number;
  quotes_conversion_pct: number;
  quotes_pipeline_total: number;
  quotes_pipeline_draft: number;
  quotes_pipeline_sent: number;
  top_technicians: { technician_id: number; name: string; jobs_completed: number; revenue: number }[];
}

export interface TrendPoint {
  period: string;
  revenue_paid: number;
}

export interface TrendDualResponse {
  trend_invoices: TrendPoint[];
  trend_jobs: TrendPoint[];
  current_total: number;
  prior_total: number;
  change_pct: number | null;
}

export type TrendSource = "invoices" | "jobs";

export interface Settings {
  id: number;
  company_name: string;
  company_phone: string;
  company_email: string;
  company_address: string;
  company_logo_url: string;
  tax_rate: number;
  currency: string;
  timezone: string;
  invoice_prefix: string;
  job_prefix: string;
  quote_prefix: string;
  inbox_agent_interval_hours: number;
  ai_model: string;
  from_email: string;
  updated_at: string;
}

export interface Subscription {
  id: number;
  plan: string;
  status: string;
  modules: string[];
  trial_ends_at: string;
  renewal_date: string;
  stripe_customer_id?: string;
  stripe_configured?: boolean;
  updated_at: string;
}

export interface PaginatedState {
  page: number;
  limit: number;
  total: number;
}

export interface CustomerLookup {
  id: number;
  name: string;
  address: string;
}

export interface TechnicianLookup {
  id: number;
  name: string;
  color: string;
}
