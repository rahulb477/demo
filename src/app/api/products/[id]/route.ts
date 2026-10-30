import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError, handler, logActivity, ok, requireUser } from "@/lib/api";

const patch = z.object({
  name: z.string().min(1).max(160).optional(),
  barcode: z.string().max(60).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  brandId: z.number().int().positive().nullable().optional(),
  unitId: z.number().int().positive().nullable().optional(),
  purchasePrice: z.number().int().min(0).optional(),
  sellingPrice: z.number().int().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountValue: z.number().int().min(0).optional(),
  isWeighted: z.boolean().optional(),
  trackStock: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser("products.read");
  const { id } = await ctx.params;
  const [row] = await db.select().from(schema.products).where(eq(schema.products.id, Number(id))).limit(1);
  if (!row) throw new ApiError(404, "Product not found");
  return ok(row);
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("products.write");
  const { id } = await ctx.params;
  const body = patch.parse(await request.json());
  const [updated] = await db
    .update(schema.products)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(schema.products.id, Number(id)))
    .returning();
  if (!updated) throw new ApiError(404, "Product not found");
  await logActivity(user.id, "product.update", "product", updated.id, body);
  return ok(updated);
});

export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("products.delete");
  const { id } = await ctx.params;
  // Soft delete: sales history must keep referencing the row.
  const [updated] = await db
    .update(schema.products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(schema.products.id, Number(id)))
    .returning();
  if (!updated) throw new ApiError(404, "Product not found");
  await logActivity(user.id, "product.delete", "product", updated.id);
  return ok({ ok: true });
});
