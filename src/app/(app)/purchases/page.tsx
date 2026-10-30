import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  await requirePage("purchases.read");
  const store = await getStore();
  const m = (v: number) => formatMoney(v, store.currency, store.locale);
  const purchases = await client.execute(
    `SELECT p.id, p.invoice_no, p.total, p.status, p.created_at, COALESCE(s.name,'—') supplier
     FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.id DESC LIMIT 50`,
  );
  const suppliers = await client.execute(
    `SELECT s.id, s.name, COALESCE(s.phone,'') phone, (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id=s.id) orders,
            (SELECT COALESCE(SUM(total-paid),0) FROM purchases p WHERE p.supplier_id=s.id) due
     FROM suppliers s ORDER BY s.name`,
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <div className="card-head"><h2>Suppliers</h2><a className="btn btn-sm" href="/api/export/suppliers?format=xlsx">Export XLSX</a></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Supplier</th><th className="hide-sm">Phone</th><th className="num">Orders</th><th className="num">Outstanding</th></tr></thead>
            <tbody>
              {suppliers.rows.map((s) => (
                <tr key={String(s.id)}>
                  <td><strong>{String(s.name)}</strong></td>
                  <td className="hide-sm">{String(s.phone) || "—"}</td>
                  <td className="num">{Number(s.orders)}</td>
                  <td className="num">{m(Number(s.due))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Purchase invoices</h2></div>
        <div className="card-body" style={{ padding: 0 }}>
          {purchases.rows.length === 0 ? (
            <div className="empty"><div className="empty-title">No purchases yet</div>Record supplier invoices to build stock.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Invoice</th><th>Supplier</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>
                {purchases.rows.map((p) => (
                  <tr key={String(p.id)}>
                    <td className="mono">{String(p.invoice_no)}</td>
                    <td>{String(p.supplier)}</td>
                    <td><span className="badge badge-neutral">{String(p.status)}</span></td>
                    <td className="num">{m(Number(p.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
