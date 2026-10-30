import { client } from "@/db";

export interface Kpi {
  revenueToday: number;
  salesToday: number;
  revenue7d: number;
  profit7d: number;
  expenses30d: number;
  products: number;
  customers: number;
  suppliers: number;
  lowStock: number;
}

const scalar = async (sql: string, args: unknown[] = []): Promise<number> => {
  const res = await client.execute({ sql, args: args as never });
  return Number(res.rows[0]?.v ?? 0);
};

const DAY = 86_400_000;

export async function getKpis(): Promise<Kpi> {
  const nowMs = Date.now();
  const startToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

  const [revenueToday, salesToday, revenue7d, expenses30d, products, customers, suppliers, lowStock] =
    await Promise.all([
      scalar("SELECT COALESCE(SUM(total),0) v FROM sales WHERE status!='void' AND created_at >= ?", [startToday]),
      scalar("SELECT COUNT(*) v FROM sales WHERE status!='void' AND created_at >= ?", [startToday]),
      scalar("SELECT COALESCE(SUM(total),0) v FROM sales WHERE status!='void' AND created_at >= ?", [nowMs - 7 * DAY]),
      scalar("SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE date >= ?", [nowMs - 30 * DAY]),
      scalar("SELECT COUNT(*) v FROM products WHERE is_active=1"),
      scalar("SELECT COUNT(*) v FROM customers"),
      scalar("SELECT COUNT(*) v FROM suppliers"),
      scalar(
        `SELECT COUNT(*) v FROM products p
         LEFT JOIN (SELECT product_id, SUM(quantity) q FROM stock GROUP BY product_id) s
           ON s.product_id = p.id
         WHERE p.is_active=1 AND p.track_stock=1 AND COALESCE(s.q,0) <= p.low_stock_threshold`,
      ),
    ]);

  // Profit = line revenue minus product cost at time of sale.
  const profit7d = await scalar(
    `SELECT COALESCE(SUM(si.line_total - (si.quantity * p.purchase_price)),0) v
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE s.status!='void' AND s.created_at >= ?`,
    [nowMs - 7 * DAY],
  );

  return { revenueToday, salesToday, revenue7d, profit7d, expenses30d, products, customers, suppliers, lowStock };
}

export interface DaySeries {
  day: string;
  revenue: number;
  orders: number;
}

export async function getDailySeries(days = 14): Promise<DaySeries[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const res = await client.execute({
    sql: `SELECT date(created_at/1000,'unixepoch','localtime') d,
                 COALESCE(SUM(total),0) revenue, COUNT(*) orders
          FROM sales WHERE status!='void' AND created_at >= ?
          GROUP BY d ORDER BY d`,
    args: [start.getTime()],
  });

  const byDay = new Map(res.rows.map((r) => [String(r.d), { revenue: Number(r.revenue), orders: Number(r.orders) }]));
  const out: DaySeries[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const hit = byDay.get(key);
    out.push({ day: key, revenue: hit?.revenue ?? 0, orders: hit?.orders ?? 0 });
  }
  return out;
}

export async function getPaymentMix(): Promise<{ method: string; amount: number }[]> {
  const res = await client.execute(
    `SELECT method, COALESCE(SUM(amount),0) amount FROM sale_payments GROUP BY method ORDER BY amount DESC`,
  );
  return res.rows.map((r) => ({ method: String(r.method), amount: Number(r.amount) }));
}

export async function getTopProducts(limit = 5) {
  const res = await client.execute({
    sql: `SELECT p.name, SUM(si.quantity) qty, SUM(si.line_total) revenue
          FROM sale_items si JOIN products p ON p.id = si.product_id
          GROUP BY p.id ORDER BY revenue DESC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => ({ name: String(r.name), qty: Number(r.qty), revenue: Number(r.revenue) }));
}

export async function getRecentSales(limit = 8) {
  const res = await client.execute({
    sql: `SELECT s.id, s.invoice_no, s.total, s.status, s.created_at, COALESCE(c.name,'Walk-in') customer
          FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
          ORDER BY s.created_at DESC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    invoiceNo: String(r.invoice_no),
    total: Number(r.total),
    status: String(r.status),
    customer: String(r.customer),
    createdAt: Number(r.created_at),
  }));
}

export async function getLowStock(limit = 6) {
  const res = await client.execute({
    sql: `SELECT p.id, p.name, p.sku, p.low_stock_threshold, COALESCE(s.q,0) qty
          FROM products p
          LEFT JOIN (SELECT product_id, SUM(quantity) q FROM stock GROUP BY product_id) s ON s.product_id = p.id
          WHERE p.is_active=1 AND p.track_stock=1 AND COALESCE(s.q,0) <= p.low_stock_threshold
          ORDER BY COALESCE(s.q,0) ASC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    sku: String(r.sku),
    threshold: Number(r.low_stock_threshold),
    qty: Number(r.qty),
  }));
}
