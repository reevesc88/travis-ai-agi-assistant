import { useEffect, useState } from "preact/hooks";
import { useApp } from "../context";
import { api } from "../api";
import type { SupplierSource, SupplierProduct } from "../types";
import { fmtMoney } from "../quote-utils";
import { Search, TrendingUp, TrendingDown, Minus, Truck, RefreshCw } from "lucide-preact";

function relTime(iso: string): string {
  if (!iso) return "never";
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const hrs = Math.round((Date.now() - then) / 3600000);
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function Suppliers() {
  const { setError } = useApp();
  const [sources, setSources] = useState<SupplierSource[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<{ sources: SupplierSource[] }>("GET", "/api/supplier-pricing/sources")
      .then((d) => setSources(d.sources))
      .catch((err) => setError((err as Error).message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    api<{ products: SupplierProduct[] }>("GET", `/api/supplier-pricing${params}`)
      .then((d) => setProducts(d.products))
      .catch((err) => setError((err as Error).message));
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const movers = products.filter((p) => Math.abs(p.change_pct || 0) > 0)
    .sort((a, b) => Math.abs(b.change_pct || 0) - Math.abs(a.change_pct || 0));
  const rises = movers.filter((p) => (p.change_pct || 0) > 0).length;

  return (
    <div class="page">
      <div class="page-header">
        <h1>Supplier Price Monitor</h1>
        <div class="page-header-right">
          <span class="provider-badge mock"><RefreshCw size={12} /> Crawl simulated</span>
        </div>
      </div>

      <p class="page-intro">
        Travis tracks supplier catalogues and flags price movements that affect your margins. Live
        crawling is a placeholder — prices and "last checked" times below are seeded demo data.
      </p>

      <div class="supplier-sources">
        {sources.map((s) => (
          <div key={s.id} class="supplier-source-card">
            <div class="supplier-source-icon"><Truck size={16} /></div>
            <div class="supplier-source-body">
              <div class="supplier-source-name">{s.name}</div>
              <div class="supplier-source-meta">{s.website}</div>
            </div>
            <div class="supplier-source-status">
              <span class={`source-dot ${s.status}`} />
              <span class="text-muted">checked {relTime(s.last_synced)}</span>
            </div>
          </div>
        ))}
      </div>

      {movers.length > 0 && (
        <div class="section">
          <div class="section-head">
            <h2 class="section-title">Recent price changes</h2>
            <span class="section-aside">{rises} up · {movers.length - rises} down</span>
          </div>
          <div class="alert-row">
            {movers.slice(0, 4).map((p) => {
              const up = (p.change_pct || 0) > 0;
              return (
                <div key={p.id} class={`alert-card ${up ? "up" : "down"}`}>
                  <div class="alert-card-head">
                    {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span class="alert-pct">{up ? "+" : ""}{p.change_pct}%</span>
                  </div>
                  <div class="alert-name">{p.name}</div>
                  <div class="alert-meta">{p.supplier_name} · {fmtMoney(p.current_price)}/{p.unit}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div class="toolbar">
        <div class="search-box">
          <Search size={14} class="search-icon" />
          <input type="text" placeholder="Search products or suppliers…" value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
        </div>
      </div>

      <div class="card">
        {products.length === 0 ? (
          <div class="empty-state"><p>No products found</p></div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Supplier</th>
                <th class="text-right">Current</th>
                <th class="text-right">Previous</th>
                <th class="text-right">Change</th>
                <th>Stock</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const change = p.change_pct || 0;
                return (
                  <tr key={p.id} class="table-row">
                    <td><span class="identifier">{p.sku}</span></td>
                    <td class="text-bold">{p.name}</td>
                    <td class="text-muted">{p.supplier_name}</td>
                    <td class="text-right">{fmtMoney(p.current_price)}<span class="unit-suffix">/{p.unit}</span></td>
                    <td class="text-right text-muted">{fmtMoney(p.previous_price)}</td>
                    <td class="text-right">
                      <span class={`change-pill ${change > 0 ? "up" : change < 0 ? "down" : "flat"}`}>
                        {change > 0 ? <TrendingUp size={11} /> : change < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
                        {change > 0 ? "+" : ""}{change}%
                      </span>
                    </td>
                    <td>{p.in_stock ? <span class="stock-tag in">In stock</span> : <span class="stock-tag out">Out</span>}</td>
                    <td class="text-muted">{relTime(p.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
