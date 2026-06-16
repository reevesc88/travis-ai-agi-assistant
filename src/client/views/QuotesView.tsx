import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { Plus, Trash2, X, FileText, CheckCircle, Send, Pencil, Sparkles, Loader, Copy, Printer, Mail, ArrowLeft } from "lucide-preact";
import { api } from "../api";
import { useApp } from "../context";
import type { Quote, QuoteStatus, Settings } from "../types";
import { QUOTE_STATUS_COLORS } from "../quote-utils";

interface JobOption {
  id: number;
  identifier: string;
  address: string;
  scheduled_date: string;
  notes?: string;
}

const STATUS_COLORS = QUOTE_STATUS_COLORS;

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function fmtMoney(n: number | string | null | undefined): string {
  return "$" + Number(n ?? 0).toFixed(2);
}

// ── Create modal ──────────────────────────────────────────────────────────

interface CreateLine {
  description: string;
  quantity: string;
  unit_price: string;
  cost_at_time: string;
}

const blankLine = (): CreateLine => ({ description: "", quantity: "1", unit_price: "", cost_at_time: "" });

interface CreateModalProps {
  customers: { id: number; name: string }[];
  initialCustomerId?: number | null;
  initialJobId?: number | null;
  initialJobNotes?: string;
  onClose: () => void;
  onCreated: () => void;
  editQuote?: Quote;
  duplicateQuote?: Quote;
}

export function CreateQuoteModal({ customers, initialCustomerId, initialJobId, initialJobNotes, onClose, onCreated, editQuote, duplicateQuote }: CreateModalProps) {
  const isEdit = !!editQuote;

  const [customerId, setCustomerId] = useState(editQuote?.customer_id ?? initialCustomerId ?? (duplicateQuote ? 0 : (customers[0]?.id ?? 0)));
  const [jobId, setJobId] = useState<number | null>(initialJobId ?? null);
  const [customerJobs, setCustomerJobs] = useState<JobOption[]>([]);
  const [taxRate, setTaxRate] = useState(
    isEdit ? String(editQuote!.tax_rate ?? 10) : duplicateQuote ? String(duplicateQuote.tax_rate ?? 10) : "10"
  );
  const [validUntil, setValidUntil] = useState(() => {
    if (isEdit && editQuote!.valid_until) return editQuote!.valid_until.split("T")[0];
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState(isEdit ? (editQuote!.notes ?? "") : duplicateQuote ? (duplicateQuote.notes ?? "") : "");
  const [lines, setLines] = useState<CreateLine[]>(() => {
    if (isEdit && editQuote!.lines?.length) {
      return editQuote!.lines.map(l => ({
        description: l.description,
        quantity: String(l.quantity),
        unit_price: String(l.unit_price),
        cost_at_time: String(l.cost_at_time ?? l.unit_price),
      }));
    }
    if (duplicateQuote?.lines?.length) {
      return duplicateQuote.lines.map(l => ({
        description: l.description,
        quantity: String(l.quantity),
        unit_price: String(l.unit_price),
        cost_at_time: String(l.cost_at_time ?? l.unit_price),
      }));
    }
    return [blankLine()];
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // AI draft state — seed from initialJobNotes when launched from a job with notes
  const seedNotes = !isEdit ? (initialJobNotes?.trim() ?? "") : "";
  const [showAiPanel, setShowAiPanel] = useState(seedNotes.length > 0);
  const userToggledPanel = useRef(false);
  const [aiDescription, setAiDescription] = useState(seedNotes);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) { setCustomerJobs([]); setJobId(null); return; }
    api<{ jobs: JobOption[] }>("GET", `/api/jobs?customer_id=${customerId}&limit=100`)
      .then(d => {
        setCustomerJobs(d.jobs);
        if (initialJobId && d.jobs.some(j => j.id === initialJobId)) {
          setJobId(initialJobId);
        } else {
          setJobId(null);
        }
      })
      .catch(() => setCustomerJobs([]));
  }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill the AI draft description with the selected job's notes (if any)
  // Auto-open the panel when there are notes to show, unless the tech has already
  // manually toggled the panel (in which case respect their choice).
  // Skip the run while customerJobs is still empty to avoid overwriting the
  // initialJobNotes seed that was set before the async fetch completes.
  useEffect(() => {
    if (isEdit) return;
    if (!customerJobs.length) return;
    const job = customerJobs.find(j => j.id === jobId);
    const notes = job?.notes?.trim() ?? "";
    setAiDescription(notes);
    if (!userToggledPanel.current) {
      setShowAiPanel(notes.length > 0);
    }
  }, [jobId, customerJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const lineHasContent = (l: CreateLine) => l.description.trim() !== "" || l.unit_price.trim() !== "";
  const hasExistingLines = lines.some(lineHasContent);

  const draftWithAI = async (mode: "replace" | "append" = "replace") => {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiSource(null);
    try {
      const data = await api<{ lines: { description: string; quantity: number; unit_price: number }[]; source: string }>(
        "POST", "/api/ai/quote-draft", { description: aiDescription.trim() }
      );
      if (data.lines.length > 0) {
        const aiLines = data.lines.map(l => ({
          description: l.description,
          quantity: String(l.quantity),
          unit_price: String(l.unit_price),
          cost_at_time: String(l.unit_price),
        }));
        if (mode === "append") {
          setLines(prev => [...prev.filter(lineHasContent), ...aiLines]);
        } else {
          setLines(aiLines);
        }
        setAiSource(data.source);
        setShowAiPanel(false);
      } else {
        setAiError("AI returned no line items. Try a more detailed description.");
      }
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);
  const taxAmt = subtotal * ((parseFloat(taxRate) || 0) / 100);
  const total = subtotal + taxAmt;

  const updateLine = (i: number, field: keyof CreateLine, val: string) =>
    setLines(prev => prev.map((l, j) => j === i ? { ...l, [field]: val } : l));

  const save = async () => {
    if (!customerId) { setErr("Select a customer"); return; }
    if (lines.some(l => !l.description.trim() || !l.unit_price)) {
      setErr("Fill in description and unit price for all line items");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        tax_rate: parseFloat(taxRate) || 10,
        valid_until: validUntil,
        notes,
        lines: lines.map(l => ({
          description: l.description,
          quantity: parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price),
          cost_at_time: l.cost_at_time ? parseFloat(l.cost_at_time) : parseFloat(l.unit_price),
        })),
      };
      if (isEdit) {
        await api("PUT", `/api/quotes/${editQuote!.id}`, payload);
      } else {
        await api("POST", "/api/quotes", {
          customer_id: customerId,
          job_id: jobId ?? null,
          ...(duplicateQuote ? { source_quote_id: duplicateQuote.id } : {}),
          ...payload,
        });
      }
      onCreated();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "4px 7px",
    border: "1px solid var(--border)", borderRadius: 6, fontSize: 13,
    background: "rgba(255,255,255,0.04)", color: "var(--text)",
  };

  return (
    <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal" style={{ maxWidth: 700 }}>
        <div class="modal-header">
          <h2>{isEdit ? `Edit ${editQuote!.identifier}` : duplicateQuote ? `Duplicate ${duplicateQuote.identifier}` : "New Quote"}</h2>
          <button class="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Customer</label>
            <select
              value={customerId || ""}
              disabled={isEdit}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                setCustomerId(v ? parseInt(v, 10) : 0);
              }}
            >
              {duplicateQuote && <option value="">— Select customer —</option>}
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div class="form-group">
            <label>Job <span class="text-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
            <select
              value={jobId ?? ""}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                setJobId(v ? parseInt(v, 10) : null);
              }}
            >
              <option value="">— None —</option>
              {customerJobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.identifier} — {j.address || j.scheduled_date}
                </option>
              ))}
            </select>
          </div>
          <div class="form-group">
            <label>Tax Rate (%)</label>
            <input
              type="number" min="0" max="100" step="0.1" value={taxRate}
              onInput={(e) => setTaxRate((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="form-group">
            <label>Valid Until</label>
            <input
              type="date" value={validUntil}
              onChange={(e) => setValidUntil((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="form-group full-width">
            <label>Notes</label>
            <textarea
              rows={2} value={notes} placeholder="Optional notes…"
              onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
            />
          </div>
        </div>

        {/* AI draft panel — available in both create and edit mode */}
        <div class="quote-ai-panel" style={{ padding: "0 22px 10px" }}>
            {!showAiPanel ? (
              <button class="btn quote-ai-trigger" onClick={() => { userToggledPanel.current = true; setShowAiPanel(true); }} type="button">
                <Sparkles size={13} /> Ask AI to draft lines
              </button>
            ) : (
              <div class="quote-ai-box card">
                <div class="quote-ai-box-header">
                  <span><Sparkles size={13} /> Describe the job</span>
                  <button class="btn-icon" onClick={() => { userToggledPanel.current = true; setShowAiPanel(false); }} type="button"><X size={14} /></button>
                </div>
                <textarea
                  class="quote-ai-textarea"
                  rows={3}
                  value={aiDescription}
                  placeholder="e.g. Replace split-system AC unit in a 3-bedroom house, includes new indoor/outdoor unit, copper pipe, and commissioning…"
                  onInput={(e) => setAiDescription((e.target as HTMLTextAreaElement).value)}
                  disabled={aiLoading}
                />
                {aiError && <div class="error-inline" style={{ margin: "4px 0 0" }}>{aiError}</div>}
                <div class="quote-ai-box-footer">
                  <button class="btn btn-sm" onClick={() => { userToggledPanel.current = true; setShowAiPanel(false); }} type="button" disabled={aiLoading}>Cancel</button>
                  {hasExistingLines ? (
                    <>
                      <button
                        class="btn btn-sm"
                        onClick={() => draftWithAI("append")}
                        type="button"
                        disabled={aiLoading || !aiDescription.trim()}
                      >
                        {aiLoading ? <><Loader size={12} class="spin" /> Working…</> : <><Plus size={12} /> Add to existing</>}
                      </button>
                      <button
                        class="btn btn-primary btn-sm"
                        onClick={() => draftWithAI("replace")}
                        type="button"
                        disabled={aiLoading || !aiDescription.trim()}
                      >
                        {aiLoading ? <><Loader size={12} class="spin" /> Working…</> : <><Sparkles size={12} /> Replace all</>}
                      </button>
                    </>
                  ) : (
                    <button
                      class="btn btn-primary btn-sm"
                      onClick={() => draftWithAI("replace")}
                      type="button"
                      disabled={aiLoading || !aiDescription.trim()}
                    >
                      {aiLoading ? <><Loader size={12} class="spin" /> Generating…</> : <><Sparkles size={12} /> Generate</>}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        {/* Line items */}
        <div style={{ padding: "0 22px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span class="quote-section-label">Line Items</span>
              {aiSource && (
                <span class="quote-ai-source-badge">
                  <Sparkles size={10} /> AI {aiSource === "mock" ? "demo" : "drafted"}
                </span>
              )}
            </div>
            <button class="btn btn-sm" onClick={() => setLines(prev => [...prev, blankLine()])}>
              <Plus size={12} /> Add line
            </button>
          </div>
          <div class="card">
            <table class="table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Description</th>
                  <th style={{ width: "10%" }}>Qty</th>
                  <th style={{ width: "18%" }}>Unit Price</th>
                  <th style={{ width: "18%" }}>Cost</th>
                  <th style={{ width: "10%", textAlign: "right" }}>Total</th>
                  <th style={{ width: "4%" }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const lt = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
                  return (
                    <tr key={i} class="table-row">
                      <td>
                        <input
                          type="text" value={line.description} placeholder="Service or material"
                          style={inputStyle}
                          onInput={(e) => updateLine(i, "description", (e.target as HTMLInputElement).value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number" min="0.01" step="0.01" value={line.quantity}
                          style={inputStyle}
                          onInput={(e) => updateLine(i, "quantity", (e.target as HTMLInputElement).value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="0.01" value={line.unit_price} placeholder="0.00"
                          style={inputStyle}
                          onInput={(e) => updateLine(i, "unit_price", (e.target as HTMLInputElement).value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="0.01" value={line.cost_at_time} placeholder="= price"
                          style={inputStyle}
                          onInput={(e) => updateLine(i, "cost_at_time", (e.target as HTMLInputElement).value)}
                        />
                      </td>
                      <td class="text-right">{fmtMoney(lt)}</td>
                      <td>
                        {lines.length > 1 && (
                          <button
                            class="btn-icon danger"
                            onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} class="text-right text-muted">Subtotal</td>
                  <td class="text-right">{fmtMoney(subtotal)}</td>
                  <td />
                </tr>
                {parseFloat(taxRate) > 0 && (
                  <tr>
                    <td colSpan={4} class="text-right text-muted">Tax ({taxRate}%)</td>
                    <td class="text-right">{fmtMoney(taxAmt)}</td>
                    <td />
                  </tr>
                )}
                <tr>
                  <td colSpan={4} class="text-right text-bold">Total</td>
                  <td class="text-right text-bold">{fmtMoney(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {err && <div class="error-inline" style={{ margin: "0 22px 12px" }}>{err}</div>}

        <div class="modal-footer">
          <button class="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button class="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────

interface QuotesViewProps {
  initialQuoteId?: number;
  fromJobId?: number;
}

export function QuotesView({ initialQuoteId, fromJobId }: QuotesViewProps) {
  const { customerLookup, navigate } = useApp();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [convertMsg, setConvertMsg] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchQuotes = useCallback(async (status: string, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (status) params.set("status", status);
      if (q) params.set("search", q);
      const data = await api<{ quotes: Quote[]; total: number }>("GET", `/api/quotes?${params}`);
      setQuotes(data.quotes);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: number) => {
    setConvertMsg(null);
    setEmailMsg(null);
    try {
      const data = await api<{ quote: Quote }>("GET", `/api/quotes/${id}`);
      setSelected(data.quote);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // initial + filter load
  useEffect(() => {
    fetchQuotes(statusFilter, search);
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-select quote when navigated from another page
  useEffect(() => {
    if (initialQuoteId && !loading) {
      fetchDetail(initialQuoteId);
    }
  }, [initialQuoteId, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchQuotes(statusFilter, search), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = useCallback(async (
    id: number,
    status: QuoteStatus,
    extra?: Record<string, unknown>,
  ) => {
    setBusy(true);
    try {
      await api("PUT", `/api/quotes/${id}`, { status, ...extra });
      setQuotes(prev => prev.map(q => q.id === id ? { ...q, status, ...extra as Partial<Quote> } : q));
      if (selected?.id === id) {
        setSelected(prev => prev ? { ...prev, status, ...extra as Partial<Quote> } : null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [selected]);

  const deleteQuote = useCallback(async (id: number) => {
    if (!confirm("Delete this quote?")) return;
    setBusy(true);
    try {
      await api("DELETE", `/api/quotes/${id}`);
      setQuotes(prev => prev.filter(q => q.id !== id));
      setTotal(prev => prev - 1);
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [selected]);

  const convertToInvoice = useCallback(async (quote: Quote) => {
    setBusy(true);
    setConvertMsg(null);
    try {
      await api("POST", "/api/invoices", {
        customer_id: quote.customer_id,
        job_id: quote.job_id ?? null,
        tax_rate: quote.tax_rate,
        notes: quote.notes,
        lines: (quote.lines || []).map(l => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      });
      setConvertMsg("Invoice created — view it in Invoices.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const emailQuote = useCallback(async (quote: Quote) => {
    setEmailSending(true);
    setEmailMsg(null);
    try {
      await api("POST", `/api/quotes/${quote.id}/email`);
      setEmailMsg({ ok: true, text: `Quote emailed to customer successfully.` });
      if (quote.status === "draft") {
        setSelected(prev => prev ? { ...prev, status: "sent" } : null);
        setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: "sent" } : q));
      }
    } catch (e) {
      setEmailMsg({ ok: false, text: (e as Error).message });
    } finally {
      setEmailSending(false);
    }
  }, []);

  const printQuote = useCallback(async (quote: Quote & { customer_name?: string; job_identifier?: string }) => {
    // Open the window synchronously while the click gesture is still active,
    // so browsers don't treat it as a popup. We populate it after the API call.
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      setError("Popup blocked — please allow popups for this site and try again.");
      return;
    }

    let settings: Partial<Settings> = {};
    try {
      const data = await api<{ settings: Settings }>("GET", "/api/settings");
      settings = data.settings;
    } catch {
      // continue without settings
    }

    const esc = (s: string | null | undefined): string => {
      if (s == null) return "";
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };
    const fmt = (n: number | string | null | undefined) => "$" + Number(n ?? 0).toFixed(2);
    const fmtD = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString() : "—";

    const linesHtml = (quote.lines || []).map(l => `
      <tr>
        <td>${esc(l.description)}</td>
        <td class="num">${Number(l.quantity)}</td>
        <td class="num">${esc(fmt(l.unit_price))}</td>
        <td class="num total">${esc(fmt(l.total))}</td>
      </tr>`).join("");

    const statusBg = quote.status === "approved" ? "#d1fae5" : quote.status === "sent" ? "#dbeafe" : "#f1f5f9";
    const statusColor = quote.status === "approved" ? "#065f46" : quote.status === "sent" ? "#1e40af" : "#475569";
    const taxRow = Number(quote.tax_rate) > 0
      ? `<tr><td colspan="3" class="label">Tax (${Number(quote.tax_rate)}%)</td><td class="num">${esc(fmt(quote.tax_amount))}</td></tr>`
      : "";

    const statusUpperFirst = esc(quote.status.charAt(0).toUpperCase() + quote.status.slice(1));
    const isConfirmed = quote.status === "approved" || quote.status === "sent";

    const companyDetails = [settings.company_address, settings.company_phone, settings.company_email]
      .filter(Boolean)
      .map(esc)
      .join(" &bull; ");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Quote ${esc(quote.identifier)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #0f172a; background: #fff; padding: 40px; max-width: 820px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
  .company-logo { max-height: 64px; max-width: 200px; object-fit: contain; display: block; margin-bottom: 6px; }
  .company-name { font-size: 22px; font-weight: 700; color: #0891b2; letter-spacing: -0.5px; }
  .company-details { font-size: 12px; color: #475569; margin-top: 4px; line-height: 1.6; }
  .quote-meta { text-align: right; }
  .quote-id { font-size: 20px; font-weight: 700; color: #0f172a; }
  .quote-status { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; background: ${statusBg}; color: ${statusColor}; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 0 0 28px; }
  .billing { display: flex; gap: 48px; margin-bottom: 28px; }
  .billing-block h3 { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
  .billing-block p { font-size: 13px; color: #0f172a; line-height: 1.6; }
  .dates { display: flex; gap: 32px; margin-bottom: 28px; }
  .date-block .label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; }
  .date-block .value { font-size: 13px; color: #0f172a; ${isConfirmed ? "font-weight: 600;" : ""} }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { padding: 9px 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; }
  th.num, td.num { text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #0f172a; }
  tbody tr:last-child td { border-bottom: none; }
  tfoot td { padding: 8px 12px; font-size: 13px; }
  tfoot tr:last-child td { font-size: 15px; font-weight: 700; border-top: 2px solid #e2e8f0; padding-top: 10px; }
  .label { text-align: right; color: #64748b; }
  .total { font-weight: 500; }
  .totals-table { width: 280px; margin-left: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .notes { margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #0891b2; }
  .notes h3 { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
  .notes p { font-size: 13px; color: #334155; line-height: 1.65; white-space: pre-wrap; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print {
    body { padding: 20px; }
    @page { margin: 15mm; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    ${settings.company_logo_url ? `<img class="company-logo" src="${esc(settings.company_logo_url)}" alt="${esc(settings.company_name) || "Company logo"}" />` : `<div class="company-name">${esc(settings.company_name) || "Travis"}</div>`}
    <div class="company-details">${companyDetails}</div>
  </div>
  <div class="quote-meta">
    <div class="quote-id">${esc(quote.identifier)}</div>
    <div class="quote-status">${statusUpperFirst}</div>
  </div>
</div>
<hr class="divider" />
<div class="billing">
  <div class="billing-block">
    <h3>Prepared for</h3>
    <p>${esc(quote.customer_name) || "—"}</p>
  </div>
  ${quote.job_identifier ? `<div class="billing-block"><h3>Job</h3><p>${esc(quote.job_identifier)}</p></div>` : ""}
</div>
<div class="dates">
  <div class="date-block">
    <div class="label">Issue Date</div>
    <div class="value">${esc(fmtD(quote.created_at))}</div>
  </div>
  <div class="date-block">
    <div class="label">Valid Until</div>
    <div class="value">${esc(fmtD(quote.valid_until))}</div>
  </div>
  ${quote.approved_at ? `<div class="date-block"><div class="label">Approved</div><div class="value">${esc(fmtD(quote.approved_at))}</div></div>` : ""}
</div>
<table>
  <thead>
    <tr>
      <th>Description</th>
      <th class="num">Qty</th>
      <th class="num">Unit Price</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>${linesHtml}</tbody>
</table>
<table class="totals-table">
  <tfoot>
    <tr><td class="label">Subtotal</td><td class="num">${esc(fmt(quote.subtotal))}</td></tr>
    ${taxRow}
    <tr><td class="label">Total</td><td class="num">${esc(fmt(quote.total))}</td></tr>
  </tfoot>
</table>
${quote.notes ? `<div class="notes"><h3>Notes</h3><p>${esc(quote.notes)}</p></div>` : ""}
<div class="footer">Generated by Travis Field Service &mdash; ${esc(new Date().toLocaleDateString())}</div>
<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
  }, []);

  return (
    <div class="page">
      <div class="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {fromJobId ? (
            <button class="btn btn-back" onClick={() => navigate(`/jobs/${fromJobId}`)}>
              <ArrowLeft size={16} /> Back to Job
            </button>
          ) : (
            <>
              <h1>Quotes</h1>
              {total > 0 && <span class="quote-count-badge">{total}</span>}
            </>
          )}
        </div>
        <div class="page-header-right">
          <button class="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New Quote
          </button>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-group">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              class={`filter-btn ${statusFilter === f.value ? "active" : ""}`}
              onClick={() => { setStatusFilter(f.value); setSelected(null); setConvertMsg(null); }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          class="search-input"
          placeholder="Search ID or customer…"
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
        />
      </div>

      {error && <div class="error-inline">{error}</div>}

      <div class="quotes-layout">
        {/* ── List panel ── */}
        <div class="quotes-list card">
          {loading ? (
            <div class="empty-state"><p>Loading…</p></div>
          ) : quotes.length === 0 ? (
            <div class="empty-state">
              <FileText size={32} style={{ opacity: 0.4 }} />
              <p>{statusFilter ? `No ${statusFilter} quotes` : "No quotes yet"}</p>
              <button class="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowCreate(true)}>
                <Plus size={14} /> New Quote
              </button>
            </div>
          ) : (
            quotes.map(quote => {
              const color = STATUS_COLORS[quote.status as QuoteStatus] || "#94a3b8";
              return (
                <button
                  key={quote.id}
                  class={`quote-item ${selected?.id === quote.id ? "active" : ""}`}
                  onClick={() => fetchDetail(quote.id)}
                >
                  <div class="quote-item-top">
                    <span class="identifier">{quote.identifier}</span>
                    <span class="status-badge" style={{ background: `${color}14`, color, borderColor: `${color}30` }}>
                      <span class="status-dot" style={{ background: color }} />
                      {quote.status}
                    </span>
                  </div>
                  <div class="quote-item-customer">{(quote as any).customer_name || "—"}</div>
                  {quote.job_identifier && (
                    <div class="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>{quote.job_identifier}</div>
                  )}
                  <div class="quote-item-bottom">
                    <span class="text-muted" style={{ fontSize: 11 }}>until {fmtDate(quote.valid_until)}</span>
                    <span class="quote-item-total">{fmtMoney(quote.total)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected ? (
          <div class="quote-detail card">
            {/* header */}
            <div class="quote-detail-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span class="identifier-lg">{selected.identifier}</span>
                  {(() => {
                    const c = STATUS_COLORS[selected.status as QuoteStatus] || "#94a3b8";
                    return (
                      <span class="status-badge" style={{ background: `${c}14`, color: c, borderColor: `${c}30` }}>
                        <span class="status-dot" style={{ background: c }} />
                        {selected.status}
                      </span>
                    );
                  })()}
                </div>
                <div class="text-muted" style={{ fontSize: 13 }}>
                  {(selected as any).customer_name}
                </div>
              </div>

              <div class="quote-detail-actions">
                <button class="btn btn-sm" title="Print / Export PDF"
                  onClick={() => printQuote(selected)}>
                  <Printer size={13} /> Print / PDF
                </button>
                <button class="btn btn-sm" title="Email to customer"
                  disabled={emailSending || busy}
                  onClick={() => emailQuote(selected)}>
                  {emailSending ? <Loader size={13} class="spin" /> : <Mail size={13} />}
                  {emailSending ? "Sending…" : "Email to Customer"}
                </button>
                {(selected.status === "draft" || selected.status === "sent") && (
                  <button class="btn btn-sm" disabled={busy}
                    onClick={() => setShowEdit(true)}>
                    <Pencil size={13} /> Edit
                  </button>
                )}
                {selected.status === "draft" && (
                  <button class="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => updateStatus(selected.id, "sent")}>
                    <Send size={13} /> Mark Sent
                  </button>
                )}
                {selected.status === "sent" && (
                  <>
                    <button
                      class="btn btn-sm"
                      style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", borderColor: "rgba(52,211,153,0.3)" }}
                      disabled={busy}
                      onClick={() => updateStatus(selected.id, "approved", {
                        approved_at: new Date().toISOString().split("T")[0],
                      })}
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button class="btn btn-sm btn-danger" disabled={busy}
                      onClick={() => updateStatus(selected.id, "rejected")}>
                      Reject
                    </button>
                  </>
                )}
                {selected.status === "approved" && (
                  <button class="btn btn-primary btn-sm" disabled={busy}
                    onClick={() => convertToInvoice(selected)}>
                    <FileText size={13} /> Convert to Invoice
                  </button>
                )}
                <button class="btn btn-sm" title="Duplicate" disabled={busy}
                  onClick={() => setShowDuplicate(true)}>
                  <Copy size={13} /> Duplicate
                </button>
                <button class="btn-icon danger" title="Delete" disabled={busy}
                  onClick={() => deleteQuote(selected.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {convertMsg && (
              <div class="quote-convert-msg">
                <CheckCircle size={14} />
                {convertMsg}
              </div>
            )}
            {emailMsg && (
              <div class="quote-convert-msg" style={emailMsg.ok ? {} : { background: "rgba(248,113,113,0.1)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                {emailMsg.ok ? <CheckCircle size={14} /> : <Mail size={14} />}
                {emailMsg.text}
              </div>
            )}

            {/* meta */}
            <div class="detail-meta-grid">
              {selected.source_identifier && (
                <div class="detail-meta-item">
                  <span class="detail-meta-label">Copied from</span>
                  <span>{selected.source_identifier}</span>
                </div>
              )}
              {selected.job_identifier && (
                <div class="detail-meta-item">
                  <span class="detail-meta-label">Job</span>
                  <button
                    style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => navigate(`/jobs/${selected.job_id}`)}
                  >
                    {selected.job_identifier}
                  </button>
                </div>
              )}
              <div class="detail-meta-item">
                <span class="detail-meta-label">Valid Until</span>
                <span>{fmtDate(selected.valid_until)}</span>
              </div>
              {selected.approved_at && (
                <div class="detail-meta-item">
                  <span class="detail-meta-label">Approved</span>
                  <span>{fmtDate(selected.approved_at)}</span>
                </div>
              )}
              <div class="detail-meta-item">
                <span class="detail-meta-label">Tax Rate</span>
                <span>{selected.tax_rate}%</span>
              </div>
              {Number(selected.margin_pct) > 0 && (
                <div class="detail-meta-item">
                  <span class="detail-meta-label">Margin</span>
                  <span>{selected.margin_pct}%</span>
                </div>
              )}
            </div>

            {/* line items */}
            <div>
              <div class="quote-section-label" style={{ marginBottom: 8 }}>Line Items</div>
              <div class="card" style={{ border: "1px solid var(--border-subtle)" }}>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Cost</th>
                      <th class="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.lines || []).map(line => (
                      <tr key={line.id} class="table-row">
                        <td>{line.description}</td>
                        <td>{line.quantity}</td>
                        <td>{fmtMoney(line.unit_price)}</td>
                        <td class="text-muted">{fmtMoney(line.cost_at_time)}</td>
                        <td class="text-right">{fmtMoney(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} class="text-right text-muted">Subtotal</td>
                      <td class="text-right">{fmtMoney(selected.subtotal)}</td>
                    </tr>
                    {Number(selected.tax_rate) > 0 && (
                      <tr>
                        <td colSpan={4} class="text-right text-muted">
                          Tax ({selected.tax_rate}%)
                        </td>
                        <td class="text-right">{fmtMoney(selected.tax_amount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={4} class="text-right text-bold">Total</td>
                      <td class="text-right text-bold" style={{ fontSize: 15 }}>
                        {fmtMoney(selected.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {selected.notes && (
              <div>
                <div class="quote-section-label" style={{ marginBottom: 6 }}>Notes</div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {selected.notes}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div class="quote-detail-empty card">
            <div class="empty-state">
              <FileText size={32} style={{ opacity: 0.3 }} />
              <p>Select a quote to view details</p>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateQuoteModal
          customers={customerLookup}
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchQuotes(statusFilter, search)}
        />
      )}

      {showEdit && selected && (
        <CreateQuoteModal
          customers={customerLookup}
          editQuote={selected}
          onClose={() => setShowEdit(false)}
          onCreated={async () => {
            await fetchQuotes(statusFilter, search);
            await fetchDetail(selected.id);
          }}
        />
      )}

      {showDuplicate && selected && (
        <CreateQuoteModal
          customers={customerLookup}
          duplicateQuote={selected}
          onClose={() => setShowDuplicate(false)}
          onCreated={() => fetchQuotes(statusFilter, search)}
        />
      )}
    </div>
  );
}
