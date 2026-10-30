import { z } from "zod";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, logActivity, ok, requireUser } from "@/lib/api";

const productInput = z.object({
  name: z.string().min(1).max(160),
  sku: z.string().min(1).max(60),
  barcode: z.string().max(60).optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  brandId: z.number().int().positive().optional().nullable(),
  unitId: z.number().int().positive().optional().nullable(),
  purchasePrice: z.number().int().min(0),
  sellingPrice: z.number().int().min(0),
  taxRate: z.number().min(0).max(100).default(0),
  discountValue: z.number().int().min(0).default(0),
  isWeighted: z.boolean().default(false),
  trackStock: z.boolean().default(true),
  lowStockThreshold: z.number().int().min(0).default(5),
  imageUrl: z.string().max(500).optional().nullable(),
  openingStock: z.number().int().min(0).optional(),
});

export const GET = handler(async (request: Request) => {
  await requireUser("products.read");
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const categoryId = url.searchParams.get("categoryId");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));

  const filters = [eq(schema.products.isActive, true)];
  if (q) {
    filters.push(
      or(
        like(schema.products.name, `%${q}%`),
        like(schema.products.sku, `%${q}%`),
        like(schema.products.barcode, `%${q}%`),
      )!,
    );
  }
  if (categoryId) filters.push(eq(schema.products.categoryId, Number(categoryId)));

  const where = and(...filters);
  const rows = await db.select().from(schema.products).where(where).orderBy(desc(schema.products.id)).limit(pageSize).offset((page - 1) * pageSize);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(schema.products).where(where);

  return ok({ data: rows, page, pageSize, total: Number(count) });
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser("products.write");
  const body = productInput.parse(await request.json());

  const exists = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.sku, body.sku))
    .limit(1);
  if (exists.length) {
    return ok({ error: "SKU already exists" }, { status: 409 });
  }

  const [created] = await db
    .insert(schema.products)
    .values({
      name: body.name,
      sku: body.sku,
      barcode: body.barcode ?? null,
      categoryId: body.categoryId ?? null,
      brandId: body.brandId ?? null,
      unitId: body.unitId ?? null,
      purchasePrice: body.purchasePrice,
      sellingPrice: body.sellingPrice,
      taxRate: body.taxRate,
      discountValue: body.discountValue,
      isWeighted: body.isWeighted,
      trackStock: body.trackStock,
      lowStockThreshold: body.lowStockThreshold,
      imageUrl: body.imageUrl ?? null,
    })
    .returning();

  if (body.openingStock && body.openingStock > 0) {
    const [loc] = await db.select().from(schema.locations).limit(1);
    await db.insert(schema.stock).values({
      productId: created.id,
      locationId: loc.id,
      quantity: body.openingStock,
    });
    await db.insert(schema.stockMovements).values({
      productId: created.id,
      locationId: loc.id,
      type: "opening",
      quantity: body.openingStock,
      unitCost: body.purchasePrice,
      note: "Opening stock on product creation",
      userId: user.id,
    });
  }

  await logActivity(user.id, "product.create", "product", created.id, { sku: created.sku });
  return ok(created, { status: 201 });
});
