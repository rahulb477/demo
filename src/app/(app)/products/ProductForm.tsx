"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProductForm({ categories }: { categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", sku: "", barcode: "", categoryId: "", purchasePrice: "", sellingPrice: "",
    taxRate: "0", lowStockThreshold: "10", openingStock: "0",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim(),
          barcode: form.barcode.trim() || null,
          categoryId: form.categoryId ? Number(form.categoryId) : null,
          purchasePrice: Math.round(Number(form.purchasePrice || 0) * 100),
          sellingPrice: Math.round(Number(form.sellingPrice || 0) * 100),
          taxRate: Number(form.taxRate || 0),
          lowStockThreshold: Number(form.lowStockThreshold || 0),
          openingStock: Number(form.openingStock || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save product");
      setOpen(false);
      setForm({ name: "", sku: "", barcode: "", categoryId: "", purchasePrice: "", sellingPrice: "", taxRate: "0", lowStockThreshold: "10", openingStock: "0" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>+ New product</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="modal-head"><h2>New product</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button></div>
            <div className="modal-body">
              <div className="field"><label>Name</label><input className="input" required value={form.name} onChange={set("name")} /></div>
              <div className="grid grid-2">
                <div className="field"><label>SKU</label><input className="input" required value={form.sku} onChange={set("sku")} /></div>
                <div className="field"><label>Barcode</label><input className="input" value={form.barcode} onChange={set("barcode")} /></div>
              </div>
              <div className="field">
                <label>Category</label>
                <select className="select" value={form.categoryId} onChange={set("categoryId")}>
                  <option value="">Uncategorised</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-2">
                <div className="field"><label>Purchase price</label><input className="input" inputMode="decimal" value={form.purchasePrice} onChange={set("purchasePrice")} /></div>
                <div className="field"><label>Selling price</label><input className="input" inputMode="decimal" value={form.sellingPrice} onChange={set("sellingPrice")} /></div>
              </div>
              <div className="grid grid-2">
                <div className="field"><label>Tax rate %</label><input className="input" inputMode="decimal" value={form.taxRate} onChange={set("taxRate")} /></div>
                <div className="field"><label>Reorder level</label><input className="input" inputMode="numeric" value={form.lowStockThreshold} onChange={set("lowStockThreshold")} /></div>
              </div>
              <div className="field"><label>Opening stock</label><input className="input" inputMode="numeric" value={form.openingStock} onChange={set("openingStock")} /></div>
              {error && <div className="error-text">{error}</div>}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save product"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
