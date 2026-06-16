import { useState, useEffect, useCallback } from "preact/hooks";
import { ShoppingBag, Plus, RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink, ChevronDown, ChevronUp, X, Clock, AlertTriangle, Check, Pencil, Trash2 } from "lucide-preact";
import { api } from "../api";
import type { SupplierSource, SupplierProduct, SupplierPriceHistory } from "../types";

const STALE_DAYS = 30;

function fmtPrice(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function staleDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function isStale(iso: string): boolean {
  return staleDays(iso) >= STALE_DAYS;
}

function PriceChange({ current, prev }: { current: number; prev?: number | null }) {
  if (prev == null || prev === 0) return <span class="sp-no-change"><Minus size={11} /></span>;
  const delta = current - prev;
  const pct = ((delta / prev) * 100).toFixed(1);
  if (Math.abs(delta) < 0.001) return <span class="sp-no-change"><Minus size={11} /></span>;
  if (delta > 0) {
    return (
      <span class="sp-price-up">
        <TrendingUp size={12} /> +{pct}%
      </span>
    );
  }
  return (
    <span class="sp-price-down">
      <TrendingDown size={12} /> {pct}%
    </span>
  );
}

interface AddSupplierModalProps {
  onClose: () => void;
  onCreated: (s: SupplierSource) => void;
}

function AddSupplierModal({ onClose, onCreated }: AddSupplierModalProps) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSubmitting(true); setError(null);
    try {
      const source = await api<SupplierSource>("POST", "/api/supplier-sources", {
        name: name.trim(), website: website.trim(), contact_email: email.trim(), notes: notes.trim(),
      });
      onCreated(source);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Add Supplier</h2>
          <button class="btn-icon" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div class="form-grid">
            <div class="form-group full-width">
              <label>Supplier name *</label>
              <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="e.g. TradeEasy Supplies" required />
            </div>
            <div class="form-group">
              <label>Website</label>
              <input type="text" value={website} onInput={(e) => setWebsite((e.target as HTMLInputElement).value)} placeholder="https://..." />
            </div>
            <div class="form-group">
              <label>Contact email</label>
              <input type="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} placeholder="orders@supplier.com" />
            </div>
            <div class="form-group full-width">
              <label>Notes</label>
              <textarea value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} rows={2} placeholder="Payment terms, account notes…" />
            </div>
            {error && <div class="error-inline" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" class="btn-primary" disabled={submitting}>
              <Plus size={14} />{submitting ? "Saving…" : "Add Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditSupplierModalProps {
  source: SupplierSource;
  onClose: () => void;
  onSaved: (s: SupplierSource) => void;
}

function EditSupplierModal({ source, onClose, onSaved }: EditSupplierModalProps) {
  const [name, setName] = useState(source.name);
  const [website, setWebsite] = useState(source.website);
  const [email, setEmail] = useState(source.contact_email);
  const [notes, setNotes] = useState(source.notes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSubmitting(true); setError(null);
    try {
      await api("PATCH", `/api/supplier-sources/${source.id}`, {
        name: name.trim(), website: website.trim(), contact_email: email.trim(), notes: notes.trim(),
      });
      onSaved({ ...source, name: name.trim(), website: website.trim(), contact_email: email.trim(), notes: notes.trim() });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Edit Supplier</h2>
          <button class="btn-icon" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div class="form-grid">
            <div class="form-group full-width">
              <label>Supplier name *</label>
              <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="e.g. TradeEasy Supplies" required />
            </div>
            <div class="form-group">
              <label>Website</label>
              <input type="text" value={website} onInput={(e) => setWebsite((e.target as HTMLInputElement).value)} placeholder="https://..." />
            </div>
            <div class="form-group">
              <label>Contact email</label>
              <input type="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} placeholder="orders@supplier.com" />
            </div>
            <div class="form-group full-width">
              <label>Notes</label>
              <textarea value={notes} onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)} rows={2} placeholder="Payment terms, account notes…" />
            </div>
            {error && <div class="error-inline" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" class="btn-primary" disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddProductModalProps {
  sourceId: number;
  sourceName: string;
  onClose: () => void;
  onCreated: (p: SupplierProduct) => void;
}

function AddProductModal({ sourceId, sourceName, onClose, onCreated }: AddProductModalProps) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("ea");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) { setError("Product name is required"); return; }
    setSubmitting(true); setError(null);
    try {
      const product = await api<SupplierProduct>("POST", "/api/supplier-products", {
        source_id: sourceId, name: name.trim(), sku: sku.trim(),
        unit: unit.trim() || "ea", current_price: price ? parseFloat(price) : 0,
      });
      onCreated(product);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Add Product</h2>
          <button class="btn-icon" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <p class="sp-modal-sub">Supplier: <strong>{sourceName}</strong></p>
        <form onSubmit={handleSubmit}>
          <div class="form-grid">
            <div class="form-group full-width">
              <label>Product name *</label>
              <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="e.g. Capacitor 35/5 MFD" required />
            </div>
            <div class="form-group">
              <label>SKU</label>
              <input type="text" value={sku} onInput={(e) => setSku((e.target as HTMLInputElement).value)} placeholder="CAP-3505" />
            </div>
            <div class="form-group">
              <label>Unit</label>
              <input type="text" value={unit} onInput={(e) => setUnit((e.target as HTMLInputElement).value)} placeholder="ea" />
            </div>
            <div class="form-group full-width">
              <label>Current price ($)</label>
              <input type="number" step="0.01" min="0" value={price} onInput={(e) => setPrice((e.target as HTMLInputElement).value)} placeholder="0.00" />
            </div>
            {error && <div class="error-inline" style={{ gridColumn: "1 / -1" }}>{error}</div>}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" class="btn-primary" disabled={submitting}>
              <Plus size={14} />{submitting ? "Saving…" : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProductRowProps {
  product: SupplierProduct;
  onPriceUpdated: (id: number, newPrice: number) => void;
  onPriceConfirmed: (id: number) => void;
  onDeleted: (id: number) => void;
}

function ProductRow({ product, onPriceUpdated, onPriceConfirmed, onDeleted }: ProductRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<SupplierPriceHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState(String(product.current_price));
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: Event) => {
    e.stopPropagation();
    if (!confirm(`Delete product "${product.name}"? This also removes its price history.`)) return;
    setDeleting(true);
    try {
      await api("DELETE", `/api/supplier-products/${product.id}`);
      onDeleted(product.id);
    } catch {
      setDeleting(false);
    }
  };

  const toggleExpand = async () => {
    if (!expanded && history.length === 0) {
      setLoadingHistory(true);
      try {
        const data = await api<{ history: SupplierPriceHistory[] }>("GET", `/api/supplier-products/${product.id}/history`);
        setHistory(data.history.slice(0, 5));
      } catch {
        // ignore
      } finally {
        setLoadingHistory(false);
      }
    }
    setExpanded((v) => !v);
  };

  const savePrice = async () => {
    const p = parseFloat(priceInput);
    if (isNaN(p) || p < 0) return;
    setSaving(true);
    try {
      await api("POST", `/api/supplier-products/${product.id}/price`, { price: p, event_type: "changed" });
      onPriceUpdated(product.id, p);
      setHistory([]); // reset so it reloads fresh next expand
      setEditingPrice(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const confirmPrice = async () => {
    setConfirming(true);
    try {
      await api("POST", `/api/supplier-products/${product.id}/price`, { price: product.current_price, event_type: "checked" });
      onPriceConfirmed(product.id);
      setHistory([]); // reset so it reloads fresh next expand
    } catch {
      // ignore
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <tr
        class={`sp-product-row ${expanded ? "sp-product-row-expanded" : ""}`}
        onClick={toggleExpand}
      >
        <td class="sp-product-name">
          <span>{product.name}</span>
        </td>
        <td class="sp-product-sku">{product.sku || "—"}</td>
        <td class="sp-product-unit">{product.unit}</td>
        <td class="sp-product-price">
          {editingPrice ? (
            <span class="sp-price-edit" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                step="0.01"
                min="0"
                class="sp-price-input"
                value={priceInput}
                onInput={(e) => setPriceInput((e.target as HTMLInputElement).value)}
                autoFocus
              />
              <button class="btn-primary sp-price-save" onClick={savePrice} disabled={saving}>
                {saving ? "…" : "Save"}
              </button>
              <button class="btn-icon" onClick={() => setEditingPrice(false)}><X size={12} /></button>
            </span>
          ) : (
            <span class="sp-price-cell">
              <span
                class="sp-price-value"
                title="Click to update price"
                onClick={(e) => { e.stopPropagation(); setEditingPrice(true); setPriceInput(String(product.current_price)); }}
              >
                {fmtPrice(product.current_price)}
              </span>
              <button
                class="btn-icon sp-price-confirm"
                title="Confirm price — mark as checked today"
                disabled={confirming}
                onClick={(e) => { e.stopPropagation(); confirmPrice(); }}
              >
                <Clock size={12} class={confirming ? "spin" : ""} />
              </button>
            </span>
          )}
        </td>
        <td class="sp-product-change">
          <PriceChange current={product.current_price} prev={product.prev_price} />
        </td>
        <td class="sp-product-checked">
          {isStale(product.last_checked) ? (
            <span class="sp-stale-badge" title={`Not checked in ${staleDays(product.last_checked)} days — price may be out of date`}>
              <AlertTriangle size={11} /> {fmtDate(product.last_checked)}
            </span>
          ) : (
            fmtDate(product.last_checked)
          )}
        </td>
        <td class="sp-product-actions">
          <button
            class="btn-icon sp-product-delete"
            title="Delete product"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 size={13} />
          </button>
          <span class="sp-product-expand-btn">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr class="sp-history-row">
          <td colSpan={7}>
            {loadingHistory ? (
              <div class="sp-history-loading">Loading…</div>
            ) : history.length === 0 ? (
              <div class="sp-history-loading">No price history recorded yet.</div>
            ) : (
              <table class="sp-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Price</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} class={h.event_type === "checked" ? "sp-history-checked" : "sp-history-changed"}>
                      <td>{new Date(h.recorded_at).toLocaleString()}</td>
                      <td>
                        {h.event_type === "checked" ? (
                          <span class="sp-event-badge sp-event-checked">
                            <Check size={11} /> Checked
                          </span>
                        ) : (
                          <span class="sp-event-badge sp-event-changed">
                            <TrendingUp size={11} /> Changed
                          </span>
                        )}
                      </td>
                      <td>{fmtPrice(h.price)}</td>
                      <td class="sp-history-user">{h.user_email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function SupplierPricingView() {
  const [sources, setSources] = useState<SupplierSource[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [selectedSource, setSelectedSource] = useState<SupplierSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [staleFirst, setStaleFirst] = useState(() =>
    new URLSearchParams(window.location.search).get("stale") === "1"
  );
  const [editingSource, setEditingSource] = useState<SupplierSource | null>(null);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ sources: SupplierSource[] }>("GET", "/api/supplier-sources");
      setSources(data.sources);
      if (data.sources.length > 0 && !selectedSource) {
        setSelectedSource(data.sources[0]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProducts = useCallback(async (sourceId: number) => {
    setLoadingProducts(true);
    try {
      const data = await api<{ products: SupplierProduct[] }>(
        "GET", `/api/supplier-products?source_id=${sourceId}`
      );
      setProducts(data.products);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  useEffect(() => {
    if (selectedSource) fetchProducts(selectedSource.id);
  }, [selectedSource, fetchProducts]);

  const toggleActive = async (source: SupplierSource) => {
    const newActive = source.active === 1 ? 0 : 1;
    try {
      await api("PATCH", `/api/supplier-sources/${source.id}`, { active: newActive });
      setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, active: newActive } : s));
      if (selectedSource?.id === source.id) setSelectedSource((s) => s ? { ...s, active: newActive } : s);
    } catch {
      // ignore
    }
  };

  const handleSourceCreated = (source: SupplierSource) => {
    setSources((prev) => [...prev, source]);
    setSelectedSource(source);
  };

  const handleProductCreated = (product: SupplierProduct) => {
    setProducts((prev) => [...prev, product].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handlePriceUpdated = (id: number, newPrice: number) => {
    setProducts((prev) => prev.map((p) =>
      p.id === id ? { ...p, current_price: newPrice, prev_price: p.current_price, last_checked: new Date().toISOString() } : p
    ));
  };

  const handlePriceConfirmed = (id: number) => {
    setProducts((prev) => prev.map((p) =>
      p.id === id ? { ...p, last_checked: new Date().toISOString() } : p
    ));
  };

  const staleCount = products.filter((p) => isStale(p.last_checked)).length;
  const displayedProducts = staleFirst
    ? [...products].sort((a, b) => {
        const sa = isStale(a.last_checked) ? 1 : 0;
        const sb = isStale(b.last_checked) ? 1 : 0;
        if (sa !== sb) return sb - sa;
        return new Date(a.last_checked).getTime() - new Date(b.last_checked).getTime();
      })
    : products;

  const handleProductDeleted = (id: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSourceSaved = (updated: SupplierSource) => {
    setSources((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    if (selectedSource?.id === updated.id) setSelectedSource(updated);
  };

  const handleDeleteSource = async (source: SupplierSource) => {
    if (!confirm(`Delete supplier "${source.name}"? This also removes all its products and price history.`)) return;
    try {
      await api("DELETE", `/api/supplier-sources/${source.id}`);
      setSources((prev) => {
        const next = prev.filter((s) => s.id !== source.id);
        if (selectedSource?.id === source.id) {
          setSelectedSource(next[0] ?? null);
        }
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div class="page">
      <div class="page-header">
        <div class="page-header-left">
          <h1>Supplier Pricing</h1>
          <span class="sp-source-count">{sources.length} supplier{sources.length !== 1 ? "s" : ""}</span>
        </div>
        <div class="page-header-actions">
          <button class="btn-secondary" onClick={() => setShowAddSupplier(true)}>
            <Plus size={14} /> Add Supplier
          </button>
          <button
            class="btn-icon"
            onClick={() => { fetchSources(); if (selectedSource) fetchProducts(selectedSource.id); }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={14} class={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && <div class="error-inline">{error}</div>}

      <div class="sp-layout">
        {/* ── Supplier list ── */}
        <div class="sp-source-panel card">
          <div class="sp-source-panel-header">Suppliers</div>
          {loading ? (
            <div class="empty-state"><p>Loading…</p></div>
          ) : sources.length === 0 ? (
            <div class="empty-state">
              <ShoppingBag size={28} style={{ opacity: 0.4 }} />
              <p>No suppliers yet</p>
            </div>
          ) : (
            sources.map((s) => (
              <button
                key={s.id}
                class={`sp-source-item ${selectedSource?.id === s.id ? "active" : ""}`}
                onClick={() => setSelectedSource(s)}
              >
                <div class="sp-source-item-main">
                  <span class="sp-source-name">{s.name}</span>
                  <span
                    class={`sp-source-active-badge ${s.active === 1 ? "active" : "inactive"}`}
                    onClick={(e) => { e.stopPropagation(); toggleActive(s); }}
                    title={s.active === 1 ? "Click to deactivate" : "Click to activate"}
                  >
                    {s.active === 1 ? "Active" : "Inactive"}
                  </span>
                </div>
                <div class="sp-source-item-actions">
                  <span
                    class="sp-source-action"
                    role="button"
                    title="Edit supplier"
                    onClick={(e) => { e.stopPropagation(); setEditingSource(s); }}
                  >
                    <Pencil size={12} />
                  </span>
                  <span
                    class="sp-source-action sp-source-action-delete"
                    role="button"
                    title="Delete supplier"
                    onClick={(e) => { e.stopPropagation(); handleDeleteSource(s); }}
                  >
                    <Trash2 size={12} />
                  </span>
                </div>
                {s.website && (
                  <a
                    class="sp-source-website"
                    href={s.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={10} /> {s.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </button>
            ))
          )}
        </div>

        {/* ── Product panel ── */}
        <div class="sp-product-panel card">
          {!selectedSource ? (
            <div class="empty-state">
              <ShoppingBag size={32} style={{ opacity: 0.3 }} />
              <p>Select a supplier to view products</p>
            </div>
          ) : (
            <>
              <div class="sp-product-panel-header">
                <div class="sp-product-panel-title">
                  <span>{selectedSource.name}</span>
                  {selectedSource.contact_email && (
                    <span class="sp-source-email">{selectedSource.contact_email}</span>
                  )}
                </div>
                <div class="sp-product-panel-actions">
                  {staleCount > 0 && (
                    <button
                      class={`btn-secondary sp-stale-toggle ${staleFirst ? "active" : ""}`}
                      onClick={() => setStaleFirst((v) => !v)}
                      title={`${staleCount} price${staleCount !== 1 ? "s" : ""} not checked in over ${STALE_DAYS} days`}
                    >
                      <AlertTriangle size={13} /> {staleCount} need{staleCount !== 1 ? "" : "s"} checking
                    </button>
                  )}
                  <button class="btn-primary" onClick={() => setShowAddProduct(true)}>
                    <Plus size={14} /> Add Product
                  </button>
                </div>
              </div>

              {loadingProducts ? (
                <div class="empty-state"><p>Loading products…</p></div>
              ) : products.length === 0 ? (
                <div class="empty-state">
                  <p>No products for this supplier yet.</p>
                  <button class="btn-secondary" style={{ marginTop: 8 }} onClick={() => setShowAddProduct(true)}>
                    <Plus size={13} /> Add first product
                  </button>
                </div>
              ) : (
                <div class="sp-product-table-wrap">
                  <table class="sp-product-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Unit</th>
                        <th>Price</th>
                        <th>Change</th>
                        <th>Checked</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedProducts.map((p) => (
                        <ProductRow
                          key={p.id}
                          product={p}
                          onPriceUpdated={handlePriceUpdated}
                          onPriceConfirmed={handlePriceConfirmed}
                          onDeleted={handleProductDeleted}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddSupplier && (
        <AddSupplierModal
          onClose={() => setShowAddSupplier(false)}
          onCreated={handleSourceCreated}
        />
      )}

      {showAddProduct && selectedSource && (
        <AddProductModal
          sourceId={selectedSource.id}
          sourceName={selectedSource.name}
          onClose={() => setShowAddProduct(false)}
          onCreated={handleProductCreated}
        />
      )}

      {editingSource && (
        <EditSupplierModal
          source={editingSource}
          onClose={() => setEditingSource(null)}
          onSaved={handleSourceSaved}
        />
      )}
    </div>
  );
}
