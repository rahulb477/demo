import Link from "next/link";
import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  await requirePage("sales.read");
  const store = await getStore();
  const rows = await client.execute({
    sql: `SELECT s.id, s.invoice_no, s.total, s.tax, s.discount, s.status, s.created_at,
                 COALESCE(c.name,'Walk-in') customer, u.name cashier
          FROM sales s
          LEFT JOIN customers c ON c.id=s.customer_id
          LEFT JOIN users u ON u.id=s.user_id
          ORDER BY s.created_at DESC LIMIT 100`,
  });

  return (
    <div className="card">
      <div className="card-head">
        <h2>Sales history</h2>
        <div className="toolbar">
          <a className="btn btn-sm" href="/api/export/sales?format=csv">CSV</a>
          <a className="btn btn-sm" href="/api/export/sales?format=xlsx">XLSX</a>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {rows.rows.length === 0 ? (
          <div className="empty"><div className="empty-title">No sales yet</div>Completed checkouts appear here.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Invoice</th><th className="hide-sm">Customer</th><th className="hide-sm">Cashier</th><th>Status</th><th className="num">Tax</th><th className="num">Total</th><th></th></tr></thead>
              <tbody>
                {rows.rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td><Link href={`/sales/${r.id}`} className="mono">{String(r.invoice_no)}</Link></td>
                    <td className="hide-sm">{String(r.customer)}</td>
                    <td className="hide-sm muted">{String(r.cashier ?? "—")}</td>
                    <td><span className={`badge ${r.status === "completed" ? "badge-ok" : r.status === "held" ? "badge-warn" : "badge-neutral"}`}>{String(r.status)}</span></td>
                    <td className="num muted">{formatMoney(Number(r.tax), store.currency, store.locale)}</td>
                    <td className="num"><strong>{formatMoney(Number(r.total), store.currency, store.locale)}</strong></td>
                    <td className="num"><a className="btn btn-sm" href={`/api/sales/${r.id}/invoice`}>PDF</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
