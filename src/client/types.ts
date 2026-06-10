export type View = "landing" | "dashboard" | "schedule" | "jobs" | "customers" | "technicians" | "services" | "invoices" | "materials" | "quotes" | "assistant" | "receptionist" | "inbox" | "suppliers" | "reports" | "settings";

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
  customer_name?: string;
  lines?: QuoteLine[];
  created_at: string;
  updated_at: string;
}

export interface SupplierSource {
  id: number;
  name: string;
  kind: string;
  website: string;
  status: string;
  last_synced: string;
  created_at: string;
}

export interface SupplierProduct {
  id: number;
  supplier_id: number;
  sku: string;
  name: string;
  unit: string;
  current_price: number;
  previous_price: number;
  in_stock: number;
  supplier_name?: string;
  change_pct?: number;
  updated_at: string;
}

export interface SupplierPriceHistory {
  id: number;
  supplier_product_id: number;
  price: number;
  recorded_at: string;
}

export interface ReceptionistCall {
  id: number;
  caller_name: string;
  caller_phone: string;
  customer_id: number | null;
  direction: string;
  status: "completed" | "missed" | "voicemail";
  intent: string;
  summary: string;
  transcript: string;
  duration_seconds: number;
  follow_up_required: number;
  customer_name?: string;
  created_at: string;
}

export interface InboxItem {
  id: number;
  source: "email" | "sms";
  sender: string;
  subject: string;
  preview: string;
  summary: string;
  category: string;
  customer_id: number | null;
  status: "unread" | "read" | "actioned";
  customer_name?: string;
  received_at: string;
  created_at: string;
}

export interface AIActivity {
  id: number;
  kind: "quote_draft" | "invoice_chase" | "call_summary" | "insight" | "assistant";
  title: string;
  detail: string;
  status: "completed" | "pending" | "failed";
  related_type: string;
  related_id: number | null;
  source: "mock" | "openrouter";
  created_at: string;
}

export interface ReportSummary {
  revenue_paid: number;
  revenue_outstanding: number;
  revenue_overdue: number;
  quotes_total: number;
  quotes_approved: number;
  quotes_win_rate: number;
  avg_margin_pct: number;
  jobs_completed: number;
  jobs_upcoming: number;
  revenue_by_month: { month: string; total: number }[];
}

export interface Subscription {
  id: number;
  plan: "starter" | "pro" | "scale";
  status: "trialing" | "active" | "past_due" | "cancelled";
  seats: number;
  renews_at: string;
  trial_ends_at: string;
  created_at: string;
}

export type Settings = Record<string, string>;

export interface AIStatus {
  configured: boolean;
  source: "openrouter" | "mock";
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
