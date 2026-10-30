import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePage("reports.view");
  const store = await getStore();
  const m = (v: number) => formatMoney(v, store.currency, store.locale);

  const [daily, byCategory, profit, topCustomers, payMix] = await Promise.all([
    client.execute(`SELECT date(created_at/1000,'unixepoch','localtime') d, COUNT(*) orders, SUM(total) revenue, SUM(tax) tax
                    FROM sales WHERE status!='void' GROUP BY d ORDER BY d DESC LIMIT 14`),
    client.execute(`SELECT COALESCE(c.name,'Uncategorised') cat, SUM(si.line_total) revenue, SUM(si.quantity) qty
                    FROM sale_items si JOIN products p ON p.id=si.product_id
                    LEFT JOIN categories c ON c.id=p.category_id GROUP BY cat ORDER BY revenue DESC`),
    client.execute(`SELECT COALESCE(SUM(si.line_total - si.quantity*p.purchase_price),0) profit,
                           COALESCE(SUM(si.line_total),0) revenue
                    FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id
                    WHERE s.status!='void'`),
    client.execute(`SELECT c.name, COUNT(s.id) orders, SUM(s.total) spend FROM sales s
                    JOIN customers c ON c.id=s.customer_id GROUP BY c.id ORDER BY spend DESC LIMIT 8`),
    client.execute(`SELECT method, SUM(amount) amount FROM sale_payments GROUP BY method ORDER BY amount DESC`),
  ]);

  const p = profit.rows[0];
  const margin = Number(p.revenue) > 0 ? (Number(p.profit) / Number(p.revenue)) * 100 : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="grid grid-3">
        <div className="card kpi"><div className="kpi-label">Gross revenue</div><div className="kpi-value">{m(Number(p.revenue))}</div></div>
        <div className="card kpi"><div className="kpi-label">Gross profit</div><div className="kpi-value">{m(Number(p.profit))}</div><div className="kpi-foot">Margin {margin.toFixed(1)}%</div></div>
        <div className="card kpi"><div className="kpi-label">Export</div>
          <div className="toolbar" style={{ marginTop: 8 }}>
            <a className="btn btn-sm" href="/api/export/sales?format=csv">Sales CSV</a>
            <a className="btn btn-sm" href="/api/export/sales?format=xlsx">Sales XLSX</a>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Daily sales</h2></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Date</th><th className="num">Orders</th><th className="num">Tax</th><th className="num">Revenue</th></tr></thead>
              <tbody>
                {daily.rows.map((r) => (
                  <tr key={String(r.d)}><td className="mono">{String(r.d)}</td><td className="num">{Number(r.orders)}</td>
                    <td className="num muted">{m(Number(r.tax))}</td><td className="num"><strong>{m(Number(r.revenue))}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Revenue by category</h2></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Category</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
              <tbody>
                {byCategory.rows.map((r) => (
                  <tr key={String(r.cat)}><td>{String(r.cat)}</td><td className="num">{Number(r.qty)}</td><td className="num">{m(Number(r.revenue))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Top customers</h2></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Customer</th><th className="num">Orders</th><th className="num">Spend</th></tr></thead>
              <tbody>
                {topCustomers.rows.map((r) => (
                  <tr key={String(r.name)}><td>{String(r.name)}</td><td className="num">{Number(r.orders)}</td><td className="num">{m(Number(r.spend))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Payments</h2></div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead><tr><th>Method</th><th className="num">Collected</th></tr></thead>
              <tbody>
                {payMix.rows.map((r) => (
                  <tr key={String(r.method)}><td style={{ textTransform: "capitalize" }}>{String(r.method)}</td><td className="num">{m(Number(r.amount))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
