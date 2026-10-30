import PDFDocument from "pdfkit";
import { client } from "@/db";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import { handler, requireUser } from "@/lib/api";

export const runtime = "nodejs";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser("sales.read");
  const { id } = await ctx.params;
  const store = await getStore();

  const saleRes = await client.execute({
    sql: `SELECT s.*, COALESCE(c.name,'Walk-in customer') customer, COALESCE(c.phone,'') phone, u.name cashier
          FROM sales s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN users u ON u.id=s.user_id
          WHERE s.id = ?`,
    args: [Number(id)],
  });
  const sale = saleRes.rows[0];
  if (!sale) return new Response("Not found", { status: 404 });

  const items = await client.execute({
    sql: "SELECT name_snapshot, quantity, unit_price, tax_rate, line_total FROM sale_items WHERE sale_id = ?",
    args: [Number(id)],
  });
  const payments = await client.execute({
    sql: "SELECT method, amount FROM sale_payments WHERE sale_id = ?",
    args: [Number(id)],
  });

  const money = (v: number) => formatMoney(v, store.currency, store.locale);
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).fillColor("#111").text(store.name, { continued: false });
  doc.fontSize(9).fillColor("#666").text(store.address).text(store.phone);
  doc.moveDown(1);
  doc.fontSize(16).fillColor("#111").text("INVOICE", { align: "right" });
  doc.fontSize(9).fillColor("#444")
    .text(`Invoice: ${sale.invoice_no}`, { align: "right" })
    .text(`Date: ${new Date(Number(sale.created_at)).toLocaleString(store.locale)}`, { align: "right" })
    .text(`Cashier: ${sale.cashier ?? "—"}`, { align: "right" });
  doc.moveDown(1);
  doc.fontSize(10).fillColor("#111").text(`Billed to: ${sale.customer}`);
  if (sale.phone) doc.fontSize(9).fillColor("#666").text(String(sale.phone));
  doc.moveDown(1.2);

  const top = doc.y;
  doc.fontSize(9).fillColor("#666");
  doc.text("Item", 48, top); doc.text("Qty", 330, top, { width: 50, align: "right" });
  doc.text("Unit", 390, top, { width: 70, align: "right" }); doc.text("Amount", 470, top, { width: 78, align: "right" });
  doc.moveTo(48, top + 14).lineTo(548, top + 14).strokeColor("#ddd").stroke();

  let y = top + 22;
  doc.fillColor("#111").fontSize(9.5);
  for (const it of items.rows) {
    doc.text(String(it.name_snapshot), 48, y, { width: 270 });
    doc.text(String(it.quantity), 330, y, { width: 50, align: "right" });
    doc.text(money(Number(it.unit_price)), 390, y, { width: 70, align: "right" });
    doc.text(money(Number(it.line_total)), 470, y, { width: 78, align: "right" });
    y += 18;
  }

  doc.moveTo(300, y + 4).lineTo(548, y + 4).strokeColor("#ddd").stroke();
  const rowsOut: [string, number][] = [
    ["Subtotal", Number(sale.subtotal)],
    ["Discount", -Number(sale.discount)],
    ["Tax", Number(sale.tax)],
  ];
  let ty = y + 12;
  doc.fontSize(9.5).fillColor("#444");
  for (const [label, value] of rowsOut) {
    doc.text(label, 300, ty, { width: 160, align: "right" });
    doc.text(money(value), 470, ty, { width: 78, align: "right" });
    ty += 16;
  }
  doc.fontSize(12).fillColor("#111").text("Total", 300, ty + 4, { width: 160, align: "right" });
  doc.text(money(Number(sale.total)), 470, ty + 4, { width: 78, align: "right" });

  ty += 30;
  doc.fontSize(9).fillColor("#666").text("Paid via", 300, ty, { width: 248, align: "right" });
  for (const p of payments.rows) {
    ty += 14;
    doc.text(`${String(p.method)} — ${money(Number(p.amount))}`, 300, ty, { width: 248, align: "right" });
  }

  doc.fontSize(9).fillColor("#888").text(store.receiptFooter, 48, 760, { align: "center", width: 500 });
  doc.end();

  const pdf = await done;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${sale.invoice_no}.pdf"`,
    },
  });
});
