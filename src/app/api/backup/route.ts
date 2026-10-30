import { client } from "@/db";
import { db, schema } from "@/db";
import { handler, logActivity, ok, requireUser } from "@/lib/api";

export const runtime = "nodejs";

const TABLES = [
  "roles", "users", "categories", "brands", "units", "locations", "products", "product_variants",
  "batches", "stock", "stock_movements", "stock_transfers", "stock_transfer_items",
  "customers", "suppliers", "purchases", "purchase_items", "purchase_payments",
  "purchase_returns", "purchase_return_items", "sales", "sale_items", "sale_payments",
  "sale_returns", "sale_return_items", "quotations", "quotation_items",
  "cash_registers", "register_sessions", "cash_transactions", "expenses", "incomes",
  "loyalty_transactions", "settings", "activity_logs", "seq",
];

export const GET = handler(async () => {
  const user = await requireUser("backup.run");
  const dump: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const res = await client.execute(`SELECT * FROM ${t}`);
    dump[t] = res.rows as unknown[];
  }

  const payload = JSON.stringify({
    format: "orbit-pos-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    tables: Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length])),
    data: dump,
  });
  const bytes = Buffer.byteLength(payload);
  const checksum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(checksum)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const filename = `orbit-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  await db.insert(schema.backups).values({ filename, size: bytes, checksum: hex, userId: user.id });
  await logActivity(user.id, "backup.create", "system", undefined, { filename, bytes });

  return new Response(payload, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Backup-Checksum": hex,
    },
  });
});
