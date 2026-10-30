"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdjustButton({ productId, name, current }: { productId: number; name: string; current: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Cycle count");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const delta = Number(qty);
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, delta: Number.isFinite(delta) ? Math.trunc(delta) : 0, note: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Adjustment failed");
      setOpen(false); setQty("");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>Adjust</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="modal-head"><h2>Adjust stock</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button></div>
            <div className="modal-body">
              <div className="muted">{name} — currently {current} on hand</div>
              <div className="field"><label>Change (+ / −)</label><input className="input" inputMode="numeric" placeholder="e.g. 5 or -3" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
              <div className="field"><label>Reason</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              {error && <div className="error-text">{error}</div>}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Apply"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
