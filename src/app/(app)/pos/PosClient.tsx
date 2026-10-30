"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { computeCart, formatMoney } from "@/lib/money";

interface P {
  id: number; name: string; sku: string; barcode: string | null;
  price: number; taxRate: number; isWeighted: boolean; qty: number; category: string;
}
interface C { id: number; name: string; phone: string | null; points: number }
interface CartLine { product: P; quantity: number; discount: number }

const OFFLINE_KEY = "orbit-offline-queue";

export default function PosClient({ products, customers, categories }: { products: P[]; customers: C[]; categories: string[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<"cash" | "card" | "qr">("cash");
  const [cashIn, setCashIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ invoiceNo: string; total: number; change: number } | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [online, setOnline] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    searchRef.current?.focus();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").includes(q);
    });
  }, [products, query, category]);

  const totals = useMemo(
    () => computeCart(lines.map((l) => ({ quantity: l.quantity, unitPrice: l.product.price, discount: l.discount, taxRate: l.product.taxRate })), orderDiscount),
    [lines, orderDiscount],
  );

  function add(p: P) {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { product: p, quantity: 1, discount: 0 }];
    });
  }
  function setQty(id: number, delta: number) {
    setLines((prev) =>
      prev.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l)).filter((l) => l.quantity > 0),
    );
  }
  function clearCart() { setLines([]); setOrderDiscount(0); setCustomerId(null); }

  async function completeSale() {
    if (!lines.length) return;
    setBusy(true);
    const clientUuid = crypto.randomUUID();
    const paid = cashIn ? Math.round(Number(cashIn) * 100) : totals.total;
    const payload = {
      clientUuid,
      customerId,
      orderDiscount,
      items: lines.map((l) => ({
        productId: l.product.id, quantity: l.quantity, unitPrice: l.product.price,
        discount: l.discount, taxRate: l.product.taxRate,
      })),
      payments: [{ method, amount: paid }],
    };

    try {
      const res = await fetch("/api/sales", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      setReceipt({ invoiceNo: data.invoiceNo, total: data.total, change: data.changeDue });
      setPayOpen(false); setCashIn(""); clearCart();
      setToast({ kind: "ok", text: `Sale ${data.invoiceNo} completed` });
      // If we were offline-queued, drain the queue now that the network is back.
      await drainQueue();
    } catch (e) {
      // Never lose a transaction: persist locally and retry on reconnect.
      const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? "[]");
      queue.push(payload);
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
      setToast({ kind: "err", text: `${(e as Error).message} — saved offline (${queue.length} queued)` });
      setPayOpen(false);
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 4200);
    }
  }

  async function drainQueue() {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? "[]");
    if (!queue.length) return;
    const remaining: unknown[] = [];
    for (const payload of queue) {
      try {
        const res = await fetch("/api/sales", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!res.ok) remaining.push(payload);
      } catch { remaining.push(payload); }
    }
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
    if (remaining.length === 0) setToast({ kind: "ok", text: "Offline sales synced" });
  }

  useEffect(() => {
    if (online) void drainQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const m = (v: number) => formatMoney(v, "INR", "en-IN");

  return (
    <div className="pos">
      <div className="card">
        <div className="card-head" style={{ gap: 10, flexWrap: "wrap" }}>
          <input ref={searchRef} className="input" style={{ maxWidth: 320 }} placeholder="Scan barcode or search name / SKU…"
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length === 1) { add(filtered[0]); setQuery(""); }
            }} />
          <span className={`badge ${online ? "badge-ok" : "badge-warn"}`}>{online ? "Online" : "Offline — queued"}</span>
          <div className="spacer" />
          <span className="muted" style={{ fontSize: 12 }}>{filtered.length} items</span>
        </div>
        <div className="card-body">
          <div className="toolbar" style={{ marginBottom: 12, overflowX: "auto" }}>
            <div className="pill-tabs">
              {["All", ...categories].map((c) => (
                <a key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)} style={{ cursor: "pointer" }}>{c}</a>
              ))}
            </div>
          </div>
          <div className="pos-grid">
            {filtered.map((p) => (
              <button className="tile" key={p.id} onClick={() => add(p)}>
                <div className="tile-name">{p.name}</div>
                <div className="tile-meta">{p.sku} · {p.qty} in stock</div>
                <div className="tile-price">{m(p.price)}</div>
              </button>
            ))}
            {!filtered.length && <div className="empty" style={{ gridColumn: "1/-1" }}>No products match “{query}”.</div>}
          </div>
        </div>
      </div>

      <div className="card cart-panel">
        <div className="card-head">
          <h2>Current sale</h2>
          <button className="btn btn-sm btn-ghost" onClick={clearCart} disabled={!lines.length}>Clear</button>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          <select className="select" value={customerId ?? ""} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Walk-in customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
          </select>

          <div className="cart-items">
            {lines.length === 0 && <div className="empty" style={{ padding: "26px 8px" }}><div className="empty-title">Cart is empty</div>Tap a product to start a sale.</div>}
            {lines.map((l) => {
              const line = totals.lines[lines.indexOf(l)];
              return (
                <div className="cart-row" key={l.product.id}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12.8 }}>{l.product.name}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{m(l.product.price)} each · tax {l.product.taxRate}%</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="qty">
                      <button onClick={() => setQty(l.product.id, -1)} aria-label="Decrease">−</button>
                      <span>{l.quantity}</span>
                      <button onClick={() => setQty(l.product.id, 1)} aria-label="Increase">+</button>
                    </div>
                    <div className="num" style={{ minWidth: 70, fontWeight: 600 }}>{m(line?.total ?? 0)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="totals">
            <div className="row"><span className="muted">Subtotal</span><span>{m(totals.subtotal)}</span></div>
            <div className="row"><span className="muted">Tax</span><span>{m(totals.tax)}</span></div>
            <div className="row">
              <span className="muted">Order discount</span>
              <input className="input" style={{ width: 96, height: 28, textAlign: "right" }} inputMode="decimal" placeholder="0.00"
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value || "0");
                  setOrderDiscount(Number.isFinite(v) ? Math.max(0, Math.round(v * 100)) : 0);
                }} />
            </div>
            <div className="row grand"><span>Total</span><span>{m(totals.total)}</span></div>
          </div>

          <button className="btn btn-primary" style={{ height: 44, fontSize: 15 }} disabled={!lines.length} onClick={() => { setCashIn(""); setPayOpen(true); }}>
            Charge {m(totals.total)}
          </button>
          {receipt && (
            <div className="badge badge-ok" style={{ justifyContent: "center", padding: "8px 10px" }}>
              Last: {receipt.invoiceNo} · change {m(receipt.change)}
            </div>
          )}
        </div>
      </div>

      {payOpen && (
        <div className="modal-backdrop" onClick={() => setPayOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Take payment</h2><button className="btn btn-ghost btn-sm" onClick={() => setPayOpen(false)}>✕</button></div>
            <div className="modal-body">
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Amount due</span><strong style={{ fontSize: 19 }}>{m(totals.total)}</strong>
              </div>
              <div className="field">
                <label>Method</label>
                <div className="toolbar">
                  {(["cash", "card", "qr"] as const).map((x) => (
                    <button key={x} className={`btn btn-sm ${method === x ? "btn-primary" : ""}`} onClick={() => setMethod(x)} style={{ textTransform: "capitalize" }}>{x}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Cash received / tender</label>
                <input className="input" inputMode="decimal" placeholder={(totals.total / 100).toFixed(2)} value={cashIn} onChange={(e) => setCashIn(e.target.value)} />
                <span className="hint">
                  {cashIn && Number(cashIn) * 100 >= totals.total
                    ? `Change: ${m(Math.round(Number(cashIn) * 100) - totals.total)}`
                    : "Leave blank for exact payment"}
                </span>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setPayOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={completeSale} disabled={busy}>{busy ? "Processing…" : "Complete sale"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-stack"><div className={`toast ${toast.kind === "ok" ? "toast-ok" : "toast-err"}`}>{toast.text}</div></div>
      )}
    </div>
  );
}
