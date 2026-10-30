import ExcelJS from "exceljs";
import { client } from "@/db";
import { handler, requireUser, ApiError } from "@/lib/api";

export const runtime = "nodejs";

const QUERIES: Record<string, { sql: string; name: string }> = {
  products: {
    name: "products",
    sql: `SELECT p.id, p.name, p.sku, p.barcode, COALESCE(c.name,'') category, COALESCE(b.name,'') brand,
                 p.purchase_price/100.0 purchase_price, p.selling_price/100.0 selling_price, p.tax_rate,
                 p.low_stock_threshold, COALESCE(SUM(s.quantity),0) stock
          FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
          LEFT JOIN stock s ON s.product_id=p.id WHERE p.is_active=1 GROUP BY p.id ORDER BY p.name`,
  },
  sales: {
    name: "sales",
    sql: `SELECT s.invoice_no, datetime(s.created_at/1000,'unixepoch','localtime') date,
                 COALESCE(c.name,'Walk-in') customer, COALESCE(u.name,'') cashier,
                 s.subtotal/100.0 subtotal, s.discount/100.0 discount, s.tax/100.0 tax, s.total/100.0 total,
                 s.paid/100.0 paid, s.status
          FROM sales s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.user_id
          ORDER BY s.created_at DESC`,
  },
  customers: {
    name: "customers",
    sql: `SELECT id, name, COALESCE(phone,'') phone, COALESCE(email,'') email, COALESCE(address,'') address,
                 loyalty_points, balance/100.0 balance FROM customers ORDER BY name`,
  },
  suppliers: {
    name: "suppliers",
    sql: `SELECT id, name, COALESCE(phone,'') phone, COALESCE(email,'') email, COALESCE(address,'') address,
                 balance/100.0 balance FROM suppliers ORDER BY name`,
  },
  inventory: {
    name: "inventory",
    sql: `SELECT p.name, p.sku, COALESCE(SUM(s.quantity),0) on_hand, p.low_stock_threshold reorder_level,
                 p.purchase_price/100.0 unit_cost, (COALESCE(SUM(s.quantity),0)*p.purchase_price)/100.0 stock_value
          FROM products p LEFT JOIN stock s ON s.product_id=p.id WHERE p.is_active=1 GROUP BY p.id ORDER BY p.name`,
  },
  movements: {
    name: "stock_movements",
    sql: `SELECT datetime(m.created_at/1000,'unixepoch','localtime') date, p.name product, p.sku, m.type,
                 m.quantity, m.note, COALESCE(u.name,'') user
          FROM stock_movements m JOIN products p ON p.id=m.product_id LEFT JOIN users u ON u.id=m.user_id
          ORDER BY m.id DESC LIMIT 5000`,
  },
  expenses: {
    name: "expenses",
    sql: `SELECT datetime(date/1000,'unixepoch','localtime') date, category, amount/100.0 amount, COALESCE(note,'') note
          FROM expenses ORDER BY date DESC`,
  },
  payments: {
    name: "sale_payments",
    sql: `SELECT s.invoice_no, sp.method, sp.amount/100.0 amount, COALESCE(sp.reference,'') reference
          FROM sale_payments sp JOIN sales s ON s.id=sp.sale_id ORDER BY s.id DESC`,
  },
};

const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET = handler(async (request: Request, ctx: { params: Promise<{ entity: string }> }) => {
  await requireUser("exports.run");
  const { entity } = await ctx.params;
  const def = QUERIES[entity];
  if (!def) throw new ApiError(404, `Unknown export: ${entity}`);

  const format = new URL(request.url).searchParams.get("format") ?? "csv";
  const res = await client.execute(def.sql);
  const columns = res.columns.length ? res.columns : Object.keys(res.rows[0] ?? {});
  const rows = res.rows as Record<string, unknown>[];
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Orbit POS";
    wb.created = new Date();
    const ws = wb.addWorksheet(def.name);
    ws.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(12, c.length + 4) }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
    for (const r of rows) ws.addRow(r);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${def.name}-${stamp}.xlsx"`,
      },
    });
  }

  const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","))].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${def.name}-${stamp}.csv"`,
    },
  });
});
