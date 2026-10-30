import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requirePage("customers.read");
  const store = await getStore();
  const rows = await client.execute({
    sql: `SELECT c.*, (SELECT COUNT(*) FROM sales s WHERE s.customer_id=c.id) orders,
                 (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.customer_id=c.id) spend
          FROM customers c ORDER BY c.name`,
  });

  return (
    <div className="card">
      <div className="card-head">
        <h2>Customers</h2>
        <a className="btn btn-sm" href="/api/export/customers?format=xlsx">Export XLSX</a>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {rows.rows.length === 0 ? (
          <div className="empty"><div className="empty-title">No customers</div>Customers are created at checkout or here.</div>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th className="hide-sm">Phone</th><th className="num">Orders</th><th className="num">Spend</th><th className="num">Loyalty</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {rows.rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><strong>{String(r.name)}</strong>{r.email ? <div className="muted mono">{String(r.email)}</div> : null}</td>
                  <td className="hide-sm">{r.phone ? String(r.phone) : "—"}</td>
                  <td className="num">{Number(r.orders)}</td>
                  <td className="num">{formatMoney(Number(r.spend), store.currency, store.locale)}</td>
                  <td className="num">{Number(r.loyalty_points)}</td>
                  <td className="num">{formatMoney(Number(r.balance), store.currency, store.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
