import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDailySeries, getKpis, getLowStock, getPaymentMix, getRecentSales, getTopProducts } from "@/lib/queries";
import { getStore } from "@/lib/store";
import { RevenueChart, PaymentDonut } from "@/components/Chart";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [user, store, kpis, series, payments, top, recent, low] = await Promise.all([
    getSession(),
    getStore(),
    getKpis(),
    getDailySeries(14),
    getPaymentMix(),
    getTopProducts(5),
    getRecentSales(7),
    getLowStock(5),
  ]);

  const m = (v: number) => formatMoney(v, store.currency, store.locale);
  const isCashier = user?.role === "Cashier";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ fontSize: 19 }}>Welcome back, {user?.name.split(" ")[0]}</h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            {isCashier
              ? "Open the register to start selling. Your shift totals update live."
              : `${kpis.salesToday} orders today · ${kpis.lowStock} items at or below reorder level.`}
          </p>
        </div>
        <Link href="/pos" className="btn btn-primary">Open Point of Sale</Link>
      </div>

      <div className="grid grid-4">
        <div className="card kpi">
          <div className="kpi-label">Revenue today</div>
          <div className="kpi-value">{m(kpis.revenueToday)}</div>
          <div className="kpi-foot">{kpis.salesToday} orders</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Revenue · 7 days</div>
          <div className="kpi-value">{m(kpis.revenue7d)}</div>
          <div className="kpi-foot">
            Gross profit <span className="kpi-up">{m(kpis.profit7d)}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Expenses · 30 days</div>
          <div className="kpi-value">{m(kpis.expenses30d)}</div>
          <div className="kpi-foot">Rent, payroll, utilities</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Low stock</div>
          <div className="kpi-value">{kpis.lowStock}</div>
          <div className="kpi-foot">
            of {kpis.products} active products
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="card">
          <div className="card-head">
            <h2>Revenue · last 14 days</h2>
            <span className="badge badge-neutral">{series.reduce((s, d) => s + d.orders, 0)} orders</span>
          </div>
          <div className="card-body">
            <RevenueChart data={series} currency={store.currency} locale={store.locale} />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Payment mix</h2></div>
          <div className="card-body">
            {payments.length ? (
              <PaymentDonut data={payments} currency={store.currency} locale={store.locale} />
            ) : (
              <div className="empty">No payments recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-head"><h2>Top products</h2></div>
          <div className="card-body" style={{ padding: 0 }}>
            {top.length ? (
              <table className="table">
                <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Revenue</th></tr></thead>
                <tbody>
                  {top.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td className="num">{p.qty}</td>
                      <td className="num">{m(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty">No sales yet.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Low stock</h2>
            <Link href="/inventory" className="btn btn-sm">View</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {low.length ? (
              <table className="table">
                <thead><tr><th>Item</th><th className="num">On hand</th><th className="num">Reorder</th></tr></thead>
                <tbody>
                  {low.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}<div className="muted mono">{p.sku}</div></td>
                      <td className="num">
                        <span className={`badge ${p.qty <= 0 ? "badge-danger" : "badge-warn"}`}>{p.qty}</span>
                      </td>
                      <td className="num muted">{p.threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty"><div className="empty-title">All stocked</div>No item is below its reorder level.</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Recent transactions</h2>
            <Link href="/sales" className="btn btn-sm">All sales</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recent.length ? (
              <table className="table">
                <thead><tr><th>Invoice</th><th>Customer</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id}>
                      <td><Link href={`/sales/${s.id}`} className="mono">{s.invoiceNo}</Link></td>
                      <td className="hide-sm">{s.customer}</td>
                      <td className="num">{m(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty">No transactions yet.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        {[
          { label: "Products", value: kpis.products, href: "/products" },
          { label: "Customers", value: kpis.customers, href: "/customers" },
          { label: "Suppliers", value: kpis.suppliers, href: "/purchases" },
          { label: "Reports", value: "→", href: "/reports" },
        ].map((x) => (
          <Link key={x.label} href={x.href} className="card kpi" style={{ display: "block" }}>
            <div className="kpi-label">{x.label}</div>
            <div className="kpi-value" style={{ fontSize: 20 }}>{x.value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
