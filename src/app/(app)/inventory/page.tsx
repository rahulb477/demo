import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import AdjustButton from "./AdjustButton";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await requirePage("inventory.read");
  const store = await getStore();
  const canWrite = user.permissions.includes("inventory.write");

  const levels = await client.execute({
    sql: `SELECT p.id, p.name, p.sku, p.low_stock_threshold, COALESCE(SUM(s.quantity),0) qty,
                 p.purchase_price, p.selling_price
          FROM products p LEFT JOIN stock s ON s.product_id=p.id
          WHERE p.is_active=1 AND p.track_stock=1 GROUP BY p.id ORDER BY qty ASC`,
  });

  const movements = await client.execute({
    sql: `SELECT m.id, m.type, m.quantity, m.note, m.created_at, p.name product, u.name user
          FROM stock_movements m JOIN products p ON p.id=m.product_id
          LEFT JOIN users u ON u.id=m.user_id ORDER BY m.id DESC LIMIT 25`,
  });

  const totalValue = levels.rows.reduce((s, r) => s + Number(r.qty) * Number(r.purchase_price), 0);
  const lowCount = levels.rows.filter((r) => Number(r.qty) <= Number(r.low_stock_threshold)).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="grid grid-3">
        <div className="card kpi"><div className="kpi-label">Stock value (at cost)</div><div className="kpi-value">{formatMoney(totalValue, store.currency, store.locale)}</div><div className="kpi-foot">{levels.rows.length} tracked products</div></div>
        <div className="card kpi"><div className="kpi-label">At / below reorder</div><div className="kpi-value">{lowCount}</div><div className="kpi-foot">Needs purchasing</div></div>
        <div className="card kpi"><div className="kpi-label">Movements logged</div><div className="kpi-value">{movements.rows.length}</div><div className="kpi-foot">Most recent 25 shown</div></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Stock levels</h2>
          <div className="toolbar">
            <a className="btn btn-sm" href="/api/export/inventory?format=csv">CSV</a>
            <a className="btn btn-sm" href="/api/export/inventory?format=xlsx">XLSX</a>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0, maxHeight: 420, overflowY: "auto" }}>
          <table className="table">
            <thead><tr><th>Product</th><th className="num">On hand</th><th className="num">Reorder</th><th className="num">Value</th><th></th></tr></thead>
            <tbody>
              {levels.rows.map((r) => {
                const qty = Number(r.qty);
                return (
                  <tr key={String(r.id)}>
                    <td><strong>{String(r.name)}</strong><div className="muted mono">{String(r.sku)}</div></td>
                    <td className="num"><span className={`badge ${qty <= 0 ? "badge-danger" : qty <= Number(r.low_stock_threshold) ? "badge-warn" : "badge-ok"}`}>{qty}</span></td>
                    <td className="num muted">{Number(r.low_stock_threshold)}</td>
                    <td className="num">{formatMoney(qty * Number(r.purchase_price), store.currency, store.locale)}</td>
                    <td className="num">{canWrite && <AdjustButton productId={Number(r.id)} name={String(r.name)} current={qty} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Recent stock movements</h2></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>When</th><th>Product</th><th>Type</th><th className="num">Qty</th><th className="hide-sm">By</th></tr></thead>
            <tbody>
              {movements.rows.map((m) => (
                <tr key={String(m.id)}>
                  <td className="muted">{new Date(Number(m.created_at)).toLocaleDateString(store.locale)}</td>
                  <td>{String(m.product)}</td>
                  <td><span className="badge badge-neutral">{String(m.type)}</span></td>
                  <td className="num" style={{ color: Number(m.quantity) < 0 ? "var(--danger)" : "var(--ok)" }}>{Number(m.quantity) > 0 ? "+" : ""}{Number(m.quantity)}</td>
                  <td className="hide-sm muted">{String(m.user ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
