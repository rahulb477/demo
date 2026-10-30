import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, schema, client } from "@/db";
import { ApiError, handler, logActivity, ok, requireUser } from "@/lib/api";
import { computeCart } from "@/lib/money";

const itemInput = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive().max(100000),
  unitPrice: z.number().int().min(0).optional(),
  discount: z.number().int().min(0).default(0),
  taxRate: z.number().min(0).max(100).optional(),
});

const saleInput = z.object({
  clientUuid: z.string().min(8).max(80),
  customerId: z.number().int().positive().nullable().optional(),
  items: z.array(itemInput).min(1),
  orderDiscount: z.number().int().min(0).default(0),
  payments: z.array(z.object({
    method: z.enum(["cash", "card", "qr", "bank", "credit", "loyalty"]),
    amount: z.number().int().min(0),
    reference: z.string().max(120).nullable().optional(),
  })).min(1),
  note: z.string().max(500).nullable().optional(),
  status: z.enum(["completed", "held"]).default("completed"),
});

export const GET = handler(async (request: Request) => {
  await requireUser("sales.read");
  const url = new URL(request.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
  const rows = await db.select().from(schema.sales).orderBy(desc(schema.sales.id)).limit(limit);
  return ok({ data: rows });
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser("sales.write");
  const body = saleInput.parse(await request.json());

  // Idempotency: a retried offline checkout must never double-charge.
  const [existing] = await db
    .select()
    .from(schema.sales)
    .where(eq(schema.sales.clientUuid, body.clientUuid))
    .limit(1);
  if (existing) return ok({ ...existing, duplicate: true }, { status: 200 });

  const products = await Promise.all(
    body.items.map(async (i) => {
      const [p] = await db.select().from(schema.products).where(eq(schema.products.id, i.productId)).limit(1);
      if (!p) throw new ApiError(422, `Product ${i.productId} not found`);
      return p;
    }),
  );

  const lineInputs = body.items.map((i, idx) => ({
    quantity: i.quantity,
    unitPrice: i.unitPrice ?? products[idx].sellingPrice,
    discount: i.discount,
    taxRate: i.taxRate ?? products[idx].taxRate,
  }));

  if (body.status === "held") {
    const totals = computeCart(lineInputs, body.orderDiscount);
    const held = await db.insert(schema.sales).values({
      invoiceNo: `HOLD-${Date.now()}`,
      clientUuid: body.clientUuid,
      customerId: body.customerId ?? null,
      subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total,
      paid: 0, status: "held", note: body.note ?? null, userId: user.id,
    }).returning();
    await db.insert(schema.saleItems).values(body.items.map((i, idx) => ({
      saleId: held[0].id, productId: i.productId, nameSnapshot: products[idx].name,
      quantity: i.quantity, unitPrice: lineInputs[idx].unitPrice,
      discount: i.discount, taxRate: lineInputs[idx].taxRate ?? 0,
      lineTotal: totals.lines[idx].total,
    })));
    return ok(held[0], { status: 201 });
  }

  const totals = computeCart(lineInputs, body.orderDiscount);
  const paid = body.payments.reduce((s, p) => s + p.amount, 0);
  if (paid < totals.total) {
    throw new ApiError(422, `Payment short by ${totals.total - paid} minor units`);
  }

  const [loc] = await db.select().from(schema.locations).limit(1);

  // Invoice numbers must be unique. Retry if a concurrent writer claimed the
  // same number between our read and insert (the sequence is not gapless-by-design).
  for (let attempt = 0; attempt < 5; attempt++) {
  const tx = await client.transaction("write");
  try {
    const seqRes = await tx.execute(
      "INSERT INTO seq (name, value) VALUES ('INV', 1) ON CONFLICT(name) DO UPDATE SET value = value + 1 RETURNING value",
    );
    const invoiceNo = `INV-${new Date().getFullYear()}-${String(Number(seqRes.rows[0].value)).padStart(4, "0")}`;

    const saleRes = await tx.execute({
      sql: `INSERT INTO sales (invoice_no, client_uuid, customer_id, subtotal, discount, tax, total, paid, change_due, status, note, user_id, created_at, synced_at)
            VALUES (?,?,?,?,?,?,?,?,?,'completed',?,?,?,?) RETURNING id`,
      args: [
        invoiceNo, body.clientUuid, body.customerId ?? null, totals.subtotal, totals.discount,
        totals.tax, totals.total, paid, paid - totals.total, body.note ?? null, user.id, Date.now(), Date.now(),
      ],
    });
    const saleId = Number(saleRes.rows[0].id);

    for (let idx = 0; idx < body.items.length; idx++) {
      const i = body.items[idx];
      const p = products[idx];
      await tx.execute({
        sql: `INSERT INTO sale_items (sale_id, product_id, variant_id, name_snapshot, quantity, unit_price, discount, tax_rate, line_total)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [saleId, i.productId, i.variantId ?? null, p.name, i.quantity,
               lineInputs[idx].unitPrice, i.discount, lineInputs[idx].taxRate ?? 0, totals.lines[idx].total],
      });

      if (p.trackStock) {
        // Atomic decrement: the WHERE clause is the concurrency guard.
        const upd = await tx.execute({
          sql: "UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND location_id = ? AND quantity >= ?",
          args: [i.quantity, i.productId, loc.id, i.quantity],
        });
        if (upd.rowsAffected === 0) {
          const cur = await tx.execute({
            sql: "SELECT quantity FROM stock WHERE product_id = ? AND location_id = ?",
            args: [i.productId, loc.id],
          });
          if (cur.rows.length === 0) {
            await tx.execute({
              sql: "INSERT INTO stock (product_id, location_id, quantity) VALUES (?,?,?)",
              args: [i.productId, loc.id, -i.quantity],
            });
          } else {
            throw new ApiError(409, `Insufficient stock for ${p.name}`);
          }
        }
        await tx.execute({
          sql: `INSERT INTO stock_movements (product_id, location_id, type, quantity, unit_cost, ref_type, ref_id, user_id, created_at)
                VALUES (?,?,'sale',?,?,'sale',?,?,?)`,
          args: [i.productId, loc.id, -i.quantity, p.purchasePrice, saleId, user.id, Date.now()],
        });
      }
    }

    for (const p of body.payments) {
      await tx.execute({
        sql: "INSERT INTO sale_payments (sale_id, method, amount, reference) VALUES (?,?,?,?)",
        args: [saleId, p.method, p.amount, p.reference ?? null],
      });
    }

    if (body.customerId) {
      const points = Math.floor(totals.total / 10000);
      if (points > 0) {
        await tx.execute({
          sql: "UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ?",
          args: [points, body.customerId],
        });
        await tx.execute({
          sql: "INSERT INTO loyalty_transactions (customer_id, points, type, ref_type, ref_id, created_at) VALUES (?,?,'earn','sale',?,?)",
          args: [body.customerId, points, saleId, Date.now()],
        });
      }
    }

    await tx.commit();
    await logActivity(user.id, "sale.complete", "sale", saleId, { invoiceNo, total: totals.total });

    return ok({
      id: saleId, invoiceNo, subtotal: totals.subtotal, discount: totals.discount,
      tax: totals.tax, total: totals.total, paid, changeDue: paid - totals.total, status: "completed",
    }, { status: 201 });
  } catch (e) {
    await tx.rollback();
    const msg = String((e as Error).message ?? "");
    if (msg.includes("UNIQUE constraint failed: sales.invoice_no") && attempt < 4) continue;
    throw e;
  }
  }
  throw new ApiError(500, "Could not allocate an invoice number");
});
