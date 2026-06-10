import { useState } from "preact/hooks";
import { useApp } from "../context";
import { X, Plus, Trash2, ChevronRight, ChevronLeft, Check } from "lucide-preact";
import type { RiskLevel } from "../types";
import type { QuoteLineInput } from "../hooks/use-app";
import { RISK_OPTIONS, riskAdjustedTotal, riskMultiplier, fmtMoney } from "../quote-utils";

interface DraftLine {
  description: string;
  kind: "labor" | "material" | "supplier";
  quantity: string;
  unit_price: string;
  cost_at_time: string;
}

const emptyLine = (): DraftLine => ({ description: "", kind: "labor", quantity: "1", unit_price: "0", cost_at_time: "0" });

const STEPS = ["Project", "Line Items", "Assumptions", "Confidence", "Review"];

export function CreateQuote({ onClose, presetCustomerId }: { onClose: () => void; presetCustomerId?: number }) {
  const { addQuote, customerLookup, navigate, setError } = useApp();

  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState(presetCustomerId ? String(presetCustomerId) : "");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [assumptions, setAssumptions] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [risk, setRisk] = useState<RiskLevel>("low");
  const [submitting, setSubmitting] = useState(false);

  const updateLine = (i: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const validLines = lines.filter((l) => l.description.trim() && Number(l.quantity) > 0);
  // Client-side preview only. The authoritative total is recomputed server-side.
  const previewSubtotal = validLines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0);
  const previewTax = previewSubtotal * (Number(taxRate) / 100);
  const previewBase = previewSubtotal + previewTax;
  const previewAdjusted = riskAdjustedTotal(previewBase, risk);

  const canNext = () => {
    if (step === 0) return !!customerId;
    if (step === 1) return validLines.length > 0;
    return true;
  };

  const next = () => {
    if (!canNext()) {
      if (step === 0) setError("Please select a customer");
      else if (step === 1) setError("Add at least one line item with a description and quantity");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const buildNotes = () => {
    const parts: string[] = [];
    if (assumptions.trim()) parts.push(`Assumptions:\n${assumptions.trim()}`);
    if (exclusions.trim()) parts.push(`Exclusions:\n${exclusions.trim()}`);
    return parts.join("\n\n");
  };

  const handleSubmit = async () => {
    if (validLines.length === 0) { setError("Add at least one line item"); setStep(1); return; }
    setSubmitting(true);
    try {
      const payload = {
        customer_id: parseInt(customerId, 10),
        title: title.trim(),
        tax_rate: Number(taxRate) || 0,
        risk_level: risk,
        notes: buildNotes(),
        valid_until: validUntil || undefined,
        lines: validLines.map<QuoteLineInput>((l) => ({
          description: l.description.trim(),
          kind: l.kind,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          cost_at_time: Number(l.cost_at_time) || 0,
        })),
      };
      const created = await addQuote(payload);
      onClose();
      navigate(`/quotes/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>New Quote</h2>
          <button class="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div class="wizard-steps">
          {STEPS.map((label, i) => (
            <div key={label} class={`wizard-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
              <span class="wizard-step-num">{i < step ? <Check size={12} /> : i + 1}</span>
              <span class="wizard-step-label">{label}</span>
            </div>
          ))}
        </div>

        <div class="wizard-body">
          {step === 0 && (
            <div class="form-grid">
              <div class="form-group full-width">
                <label>Customer *</label>
                <select value={customerId} onChange={(e) => setCustomerId((e.target as HTMLSelectElement).value)} required>
                  <option value="">Select customer...</option>
                  {customerLookup.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div class="form-group full-width">
                <label>Quote Title</label>
                <input type="text" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} placeholder="e.g. Boiler replacement & system flush" />
              </div>
              <div class="form-group">
                <label>Valid Until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil((e.target as HTMLInputElement).value)} />
              </div>
              <div class="form-group">
                <label>Tax Rate (%)</label>
                <input type="number" min="0" step="0.1" value={taxRate} onInput={(e) => setTaxRate((e.target as HTMLInputElement).value)} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div class="quote-lines-editor">
              <table class="table quote-lines-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Type</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Cost</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <input type="text" value={l.description} onInput={(e) => updateLine(i, { description: (e.target as HTMLInputElement).value })} placeholder="Item or labor description" />
                      </td>
                      <td>
                        <select value={l.kind} onChange={(e) => updateLine(i, { kind: (e.target as HTMLSelectElement).value as DraftLine["kind"] })}>
                          <option value="labor">Labor</option>
                          <option value="material">Material</option>
                          <option value="supplier">Supplier</option>
                        </select>
                      </td>
                      <td><input class="num-input" type="number" min="0" step="1" value={l.quantity} onInput={(e) => updateLine(i, { quantity: (e.target as HTMLInputElement).value })} /></td>
                      <td><input class="num-input" type="number" min="0" step="0.01" value={l.cost_at_time} onInput={(e) => updateLine(i, { cost_at_time: (e.target as HTMLInputElement).value })} /></td>
                      <td><input class="num-input" type="number" min="0" step="0.01" value={l.unit_price} onInput={(e) => updateLine(i, { unit_price: (e.target as HTMLInputElement).value })} /></td>
                      <td class="text-right">{fmtMoney(Number(l.quantity) * Number(l.unit_price) || 0)}</td>
                      <td>
                        {lines.length > 1 && (
                          <button class="btn-icon danger" onClick={() => removeLine(i)}><Trash2 size={13} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button class="btn btn-sm" onClick={addLine}><Plus size={13} /> Add Line</button>
              <p class="text-muted wizard-hint">Cost locks the historical price for margin tracking. Totals are recalculated on the server when you save.</p>
            </div>
          )}

          {step === 2 && (
            <div class="form-grid">
              <div class="form-group full-width">
                <label>Assumptions</label>
                <textarea rows={4} value={assumptions} onInput={(e) => setAssumptions((e.target as HTMLTextAreaElement).value)} placeholder="What this quote assumes (e.g. existing pipework is sound, parking available on site)..." />
              </div>
              <div class="form-group full-width">
                <label>Exclusions</label>
                <textarea rows={4} value={exclusions} onInput={(e) => setExclusions((e.target as HTMLTextAreaElement).value)} placeholder="What is not included (e.g. making good of plasterwork, electrical certification)..." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div class="confidence-picker">
              <p class="wizard-hint">How clear is the scope? Lower confidence applies a larger contingency on top of the base total.</p>
              {RISK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  class={`confidence-option ${risk === opt.value ? "active" : ""}`}
                  onClick={() => setRisk(opt.value)}
                >
                  <div class="confidence-option-head">
                    <span class={`risk-pill risk-${opt.value}`}>{opt.label}</span>
                    <span class="confidence-pct">{opt.pct}</span>
                  </div>
                  <span class="confidence-blurb">{opt.blurb}</span>
                </button>
              ))}
              <div class="confidence-preview">
                <div><span class="text-muted">Base total</span><span>{fmtMoney(previewBase)}</span></div>
                <div class="confidence-preview-arrow">×{riskMultiplier(risk).toFixed(2)}</div>
                <div><span class="text-muted">Risk-adjusted</span><span class="text-bold">{fmtMoney(previewAdjusted)}</span></div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div class="quote-review">
              <div class="quote-review-meta">
                <div><span class="detail-meta-label">Customer</span><span>{customerLookup.find((c) => String(c.id) === customerId)?.name || "—"}</span></div>
                <div><span class="detail-meta-label">Title</span><span>{title || "—"}</span></div>
                <div><span class="detail-meta-label">Confidence</span><span class={`risk-pill risk-${risk}`}>{risk}</span></div>
                {validUntil && <div><span class="detail-meta-label">Valid Until</span><span>{validUntil}</span></div>}
              </div>

              <table class="table">
                <thead>
                  <tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {validLines.map((l, i) => (
                    <tr key={i} class="table-row">
                      <td>{l.description}</td>
                      <td class="text-right">{l.quantity}</td>
                      <td class="text-right">{fmtMoney(Number(l.unit_price))}</td>
                      <td class="text-right">{fmtMoney(Number(l.quantity) * Number(l.unit_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div class="quote-totals">
                <div class="quote-total-row"><span class="text-muted">Subtotal</span><span>{fmtMoney(previewSubtotal)}</span></div>
                {Number(taxRate) > 0 && <div class="quote-total-row"><span class="text-muted">Tax ({taxRate}%)</span><span>{fmtMoney(previewTax)}</span></div>}
                <div class="quote-total-row"><span class="text-muted">Base total</span><span>{fmtMoney(previewBase)}</span></div>
                <div class="quote-total-row quote-total-risk"><span>Risk-adjusted (×{riskMultiplier(risk).toFixed(2)})</span><span class="text-bold">{fmtMoney(previewAdjusted)}</span></div>
              </div>
              <p class="text-muted wizard-hint">Final figures are recalculated on the server when you save.</p>
            </div>
          )}
        </div>

        <div class="modal-footer wizard-footer">
          {step > 0 ? (
            <button type="button" class="btn" onClick={back}><ChevronLeft size={14} /> Back</button>
          ) : (
            <button type="button" class="btn" onClick={onClose}>Cancel</button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" class="btn btn-primary" onClick={next}>Next <ChevronRight size={14} /></button>
          ) : (
            <button type="button" class="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Creating..." : "Create Quote"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
