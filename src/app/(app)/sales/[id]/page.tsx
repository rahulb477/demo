import Link from "next/link";
import { notFound } from "next/navigation";
import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SaleDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("sales.read");
  const { id } = await params;
  const store = await getStore();
  const m = (v: number) => formatMoney(v, store.currency, store.locale);

  const saleRes = await client.execute({
    sql: `SELECT s.*, COALESCE(c.name,'Walk-in customer') customer, u.name cashier
          FROM sales s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.user_id
          WHERE s.id=?`,
    args: [Number(id)],
  });
  const sale = saleRes.rows[0];
  if (!sale) notFound();

  const items = await client.execute({ sql: "SELECT * FROM sale_items WHERE sale_id=?", args: [Number(id)] });
  const payments = await client.execute({ sql: "SELECT * FROM sale_payments WHERE sale_id=?", args: [Number(id)] });

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 860 }}>
      <div className="toolbar no-print">
        <Link href="/sales" className="btn btn-sm btn-ghost">← Back</Link>
        <div className="spacer" />
        <a className="btn btn-sm" href={`/api/sales/${id}/invoice`} target="_blank" rel="noreferrer">Open PDF</a>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="mono">{String(sale.invoice_no)}</h2>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {new Date(Number(sale.created_at)).toLocaleString(store.locale)} · {String(sale.cashier ?? "—")}
            </div>
          </div>
          <span className={`badge ${sale.status === "completed" ? "badge-ok" : "badge-neutral"}`}>{String(sale.status)}</span>
        </div>
        <div className="card-body">
          <div className="grid grid-2">
            <div>
              <div className="kpi-label">Customer</div>
              <div>{String(sale.customer)}</div>
            </div>
            <div>
              <div className="kpi-label">Payment</div>
              <div>{payments.rows.map((p) => `${String(p.method)}: ${m(Number(p.amount))}`).join(" · ") || "—"}</div>
            </div>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0, borderTop: "1px solid var(--border)" }}>
          <table className="table">
            <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Tax %</th><th className="num">Line total</th></tr></thead>
            <tbody>
              {items.rows.map((it) => (
                <tr key={String(it.id)}>
                  <td>{String(it.name_snapshot)}</td>
                  <td className="num">{Number(it.quantity)}</td>
                  <td className="num">{m(Number(it.unit_price))}</td>
                  <td className="num muted">{Number(it.tax_rate)}%</td>
                  <td className="num">{m(Number(it.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="totals" style={{ maxWidth: 300, marginLeft: "auto" }}>
            <div className="row"><span className="muted">Subtotal</span><span>{m(Number(sale.subtotal))}</span></div>
            <div className="row"><span className="muted">Discount</span><span>−{m(Number(sale.discount))}</span></div>
            <div className="row"><span className="muted">Tax</span><span>{m(Number(sale.tax))}</span></div>
            <div className="row grand"><span>Total</span><span>{m(Number(sale.total))}</span></div>
            <div className="row"><span className="muted">Paid</span><span>{m(Number(sale.paid))}</span></div>
            <div className="row"><span className="muted">Change</span><span>{m(Number(sale.change_due))}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
