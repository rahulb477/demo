import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApiError, handler, logActivity, ok, requireUser } from "@/lib/api";

export const runtime = "nodejs";

const REQUIRED = ["name", "sku", "selling_price"] as const;

const rowSchema = z.object({
  name: z.string().min(1, "name is required").max(160),
  sku: z.string().min(1, "sku is required").max(60),
  barcode: z.string().max(60).optional().nullable(),
  category: z.string().max(80).optional(),
  purchase_price: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  opening_stock: z.coerce.number().int().min(0).default(0),
});

/** Minimal RFC4180-ish CSV parser: handles quotes, escaped quotes, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export const POST = handler(async (request: Request) => {
  const user = await requireUser("imports.run");
  const form = await request.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") ?? "preview"); // preview | commit

  if (!(file instanceof File)) throw new ApiError(422, "Upload a CSV file in the 'file' field");
  if (file.size > 5_000_000) throw new ApiError(413, "File too large (max 5 MB)");

  const text = await file.text();
  const table = parseCsv(text);
  if (table.length < 2) throw new ApiError(422, "CSV needs a header row and at least one data row");

  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length) throw new ApiError(422, `Missing required columns: ${missing.join(", ")}`);

  const errors: { row: number; message: string }[] = [];
  const valid: z.infer<typeof rowSchema>[] = [];
  const seen = new Set<string>();

  table.slice(1).forEach((cells, i) => {
    const raw: Record<string, string> = {};
    header.forEach((h, idx) => { raw[h] = (cells[idx] ?? "").trim(); });
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 2, message: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
      return;
    }
    if (seen.has(parsed.data.sku)) {
      errors.push({ row: i + 2, message: `duplicate SKU in file: ${parsed.data.sku}` });
      return;
    }
    seen.add(parsed.data.sku);
    valid.push(parsed.data);
  });

  const existing = await db.select({ sku: schema.products.sku }).from(schema.products);
  const existingSkus = new Set(existing.map((e) => e.sku));
  const conflicts = valid.filter((v) => existingSkus.has(v.sku)).map((v) => v.sku);

  if (mode === "preview") {
    return ok({
      mode, totalRows: table.length - 1, validRows: valid.length,
      errorCount: errors.length, errors: errors.slice(0, 50),
      conflicts: conflicts.slice(0, 50), conflictCount: conflicts.length,
      sample: valid.slice(0, 5),
    });
  }

  let inserted = 0;
  const [loc] = await db.select().from(schema.locations).limit(1);

  for (const v of valid) {
    if (existingSkus.has(v.sku)) continue; // skip duplicates instead of overwriting silently
    const [created] = await db.insert(schema.products).values({
      name: v.name,
      sku: v.sku,
      barcode: v.barcode ?? null,
      purchasePrice: Math.round(v.purchase_price * 100),
      sellingPrice: Math.round(v.selling_price * 100),
      taxRate: v.tax_rate,
    }).returning();

    if (v.opening_stock > 0 && loc) {
      await db.insert(schema.stock).values({ productId: created.id, locationId: loc.id, quantity: v.opening_stock });
      await db.insert(schema.stockMovements).values({
        productId: created.id, locationId: loc.id, type: "opening",
        quantity: v.opening_stock, note: "Imported opening stock", userId: user.id,
      });
    }
    inserted++;
  }

  await db.insert(schema.importJobs).values({
    type: "products", filename: file.name, status: errors.length && !inserted ? "failed" : "completed",
    totalRows: table.length - 1, successRows: inserted, errorCount: errors.length,
    errors: JSON.stringify(errors.slice(0, 200)), userId: user.id,
  });
  await logActivity(user.id, "import.products", "product", undefined, { inserted, errors: errors.length });

  return ok({ mode, inserted, skipped: valid.length - inserted, errorCount: errors.length, errors: errors.slice(0, 50) });
});
