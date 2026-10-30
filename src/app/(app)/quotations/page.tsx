import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function QuotationsPage() {
  await requirePage("quotations.read");
  const store = await getStore();
  const rows = await client.execute(
    `SELECT q.id, q.quote_no, q.total, q.status, q.created_at, COALESCE(c.name,'—') customer
     FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id ORDER BY q.id DESC LIMIT 50`,
  );

  return (
    <div className="card">
      <div className="card-head"><h2>Quotations</h2></div>
      <div className="card-body" style={{ padding: 0 }}>
        {rows.rows.length === 0 ? (
          <div className="empty"><div className="empty-title">No quotations</div>Quotation drafting is queued for the next build stage.</div>
        ) : (
          <table className="table">
            <thead><tr><th>Quote</th><th>Customer</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>
              {rows.rows.map((q) => (
                <tr key={String(q.id)}>
                  <td className="mono">{String(q.quote_no)}</td>
                  <td>{String(q.customer)}</td>
                  <td><span className="badge badge-neutral">{String(q.status)}</span></td>
                  <td className="num">{formatMoney(Number(q.total), store.currency, store.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
