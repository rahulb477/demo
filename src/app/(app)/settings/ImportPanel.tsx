"use client";

import { useState } from "react";

interface Preview {
  totalRows: number; validRows: number; errorCount: number;
  errors: { row: number; message: string }[];
  conflictCount: number; conflicts: string[];
  sample: unknown[];
}

export default function ImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(mode: "preview" | "commit") {
    if (!file) { setError("Choose a CSV file first"); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const res = await fetch("/api/import/products", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      if (mode === "preview") setPreview(data);
      else { setResult(`Imported ${data.inserted} products · skipped ${data.skipped} · ${data.errorCount} errors`); setPreview(null); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
        Required columns: <span className="mono">name, sku, selling_price</span>. Optional: barcode, category,
        purchase_price, tax_rate, opening_stock. Existing SKUs are skipped, never overwritten.
      </p>
      <input className="input" type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
      <div className="toolbar">
        <button className="btn" onClick={() => upload("preview")} disabled={busy || !file}>Validate & preview</button>
        <button className="btn btn-primary" onClick={() => upload("commit")} disabled={busy || !file}>Import</button>
      </div>
      {error && <div className="error-text">{error}</div>}
      {result && <div className="badge badge-ok">{result}</div>}
      {preview && (
        <div style={{ display: "grid", gap: 6, fontSize: 12.5 }}>
          <div className="toolbar">
            <span className="badge badge-neutral">{preview.totalRows} rows</span>
            <span className="badge badge-ok">{preview.validRows} valid</span>
            <span className="badge badge-danger">{preview.errorCount} errors</span>
            <span className="badge badge-warn">{preview.conflictCount} existing SKUs</span>
          </div>
          {preview.errors.length > 0 && (
            <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
              {preview.errors.map((e, i) => <div key={i} className="error-text">row {e.row}: {e.message}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
