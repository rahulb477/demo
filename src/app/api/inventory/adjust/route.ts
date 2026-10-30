import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema, client } from "@/db";
import { ApiError, handler, logActivity, ok, requireUser } from "@/lib/api";

const input = z.object({
  productId: z.number().int().positive(),
  delta: z.number().int().refine((v) => v !== 0, "Delta must be non-zero"),
  note: z.string().max(240).default("Manual adjustment"),
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser("inventory.write");
  const body = input.parse(await request.json());

  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, body.productId)).limit(1);
  if (!product) throw new ApiError(404, "Product not found");

  const [loc] = await db.select().from(schema.locations).limit(1);

  const tx = await client.transaction("write");
  try {
    const existing = await tx.execute({
      sql: "SELECT quantity FROM stock WHERE product_id=? AND location_id=?",
      args: [body.productId, loc.id],
    });
    if (existing.rows.length === 0) {
      await tx.execute({
        sql: "INSERT INTO stock (product_id, location_id, quantity) VALUES (?,?,?)",
        args: [body.productId, loc.id, body.delta],
      });
    } else {
      const next = Number(existing.rows[0].quantity) + body.delta;
      if (next < 0) throw new ApiError(409, "Adjustment would make stock negative");
      await tx.execute({
        sql: "UPDATE stock SET quantity=? WHERE product_id=? AND location_id=?",
        args: [next, body.productId, loc.id],
      });
    }
    await tx.execute({
      sql: `INSERT INTO stock_movements (product_id, location_id, type, quantity, unit_cost, note, user_id, created_at)
            VALUES (?,?,'adjustment',?,?,?,?,?)`,
      args: [body.productId, loc.id, body.delta, product.purchasePrice, body.note, user.id, Date.now()],
    });
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  await logActivity(user.id, "inventory.adjust", "product", body.productId, { delta: body.delta });
  return ok({ ok: true });
});
