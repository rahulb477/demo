/**
 * Deterministic dev seed. Refuses to run against a non-empty database
 * unless FORCE=1, so it can never silently wipe real data.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import bcrypt from "bcryptjs";
import * as s from "./schema";
import { ROLE_PRESETS } from "../lib/rbac";
import { computeLine } from "../lib/money";

const url = process.env.DATABASE_URL ?? "file:./data/orbit.db";
const client = createClient({ url });
const db = drizzle(client, { schema: s });

const TABLES = [
  "sale_return_items","sale_returns","sale_payments","sale_items","sales",
  "purchase_return_items","purchase_returns","purchase_payments","purchase_items","purchases",
  "quotation_items","quotations","stock_transfer_items","stock_transfers","stock_movements","stock",
  "batches","loyalty_transactions","cash_transactions","register_sessions","cash_registers",
  "expenses","incomes","import_jobs","backups","activity_logs","settings","seq",
  "product_variants","products","categories","brands","units","locations",
  "customers","suppliers","users","roles",
];

async function main() {
  const existing = await db.select().from(s.users);
  if (existing.length > 0 && process.env.FORCE !== "1") {
    console.log(`Refusing to seed: ${existing.length} users already exist. Use FORCE=1 to reset.`);
    return;
  }

  for (const t of TABLES) await client.execute(`DELETE FROM ${t}`);

  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "Admin#12345";
  const cashierPass = process.env.SEED_CASHIER_PASSWORD ?? "Cashier#12345";

  const roleRows = await db
    .insert(s.roles)
    .values([
      { name: "Admin", description: "Full access", permissions: JSON.stringify(ROLE_PRESETS.Admin), isSystem: true },
      { name: "Manager", description: "Operations, no system settings", permissions: JSON.stringify(ROLE_PRESETS.Manager), isSystem: true },
      { name: "Cashier", description: "POS and own sales", permissions: JSON.stringify(ROLE_PRESETS.Cashier), isSystem: true },
    ])
    .returning();

  const roleId = (n: string) => roleRows.find((r) => r.name === n)!.id;

  const [admin, cashier] = await db
    .insert(s.users)
    .values([
      {
        email: process.env.SEED_ADMIN_EMAIL ?? "admin@orbitpos.local",
        name: "Ava Mehta",
        passwordHash: await bcrypt.hash(adminPass, 12),
        roleId: roleId("Admin"),
      },
      {
        email: process.env.SEED_CASHIER_EMAIL ?? "cashier@orbitpos.local",
        name: "Leo Park",
        passwordHash: await bcrypt.hash(cashierPass, 12),
        roleId: roleId("Cashier"),
      },
    ])
    .returning();

  const units = await db
    .insert(s.units)
    .values([
      { name: "Pieces", shortName: "pcs" },
      { name: "Kilogram", shortName: "kg" },
      { name: "Litre", shortName: "L" },
      { name: "Pack", shortName: "pack" },
    ])
    .returning();

  const locs = await db
    .insert(s.locations)
    .values([
      { name: "Main Store", type: "store" },
      { name: "Godown A", type: "godown" },
      { name: "Shelf 1", type: "shelf", parentId: 1 },
    ])
    .returning();

  const cats = await db
    .insert(s.categories)
    .values([
      { name: "Beverages", description: "Cold drinks, juices, water" },
      { name: "Snacks", description: "Chips, biscuits, namkeen" },
      { name: "Dairy", description: "Milk, butter, cheese" },
      { name: "Bakery", description: "Bread, buns, cakes" },
      { name: "Household", description: "Cleaning and kitchen" },
      { name: "Personal Care", description: "Soap, shampoo, oral care" },
    ])
    .returning();

  const brands = await db
    .insert(s.brands)
    .values([{ name: "Orbit" }, { name: "Fresco" }, { name: "DailyBest" }, { name: "PureHome" }])
    .returning();

  const unit = (n: string) => units.find((u) => u.shortName === n)!.id;
  const cat = (n: string) => cats.find((c) => c.name === n)!.id;
  const brand = (n: string) => brands.find((b) => b.name === n)!.id;

  const productSeed = [
    ["Cola 500ml", "BEV-001", "8901001", "Beverages", "Fresco", "pcs", 70, 120, 5],
    ["Orange Juice 1L", "BEV-002", "8901002", "Beverages", "Fresco", "pcs", 180, 260, 5],
    ["Mineral Water 1L", "BEV-003", "8901003", "Beverages", "Orbit", "pcs", 25, 40, 0],
    ["Energy Drink 250ml", "BEV-004", "8901004", "Beverages", "Fresco", "pcs", 90, 150, 18],
    ["Potato Chips 52g", "SNK-001", "8902001", "Snacks", "Orbit", "pcs", 40, 70, 12],
    ["Choco Biscuit 100g", "SNK-002", "8902002", "Snacks", "DailyBest", "pcs", 45, 80, 18],
    ["Salted Peanuts 200g", "SNK-003", "8902003", "Snacks", "Orbit", "pcs", 60, 100, 12],
    ["Whole Milk 1L", "DRY-001", "8903001", "Dairy", "DailyBest", "L", 110, 160, 0],
    ["Salted Butter 100g", "DRY-002", "8903002", "Dairy", "DailyBest", "pcs", 130, 190, 12],
    ["Cheddar Cheese 200g", "DRY-003", "8903003", "Dairy", "Fresco", "pcs", 320, 450, 12],
    ["Sourdough Loaf", "BAK-001", "8904001", "Bakery", "Orbit", "pack", 80, 140, 0],
    ["Croissant", "BAK-002", "8904002", "Bakery", "Orbit", "pcs", 55, 95, 5],
    ["Dish Soap 500ml", "HHD-001", "8905001", "Household", "PureHome", "pcs", 140, 210, 18],
    ["Floor Cleaner 1L", "HHD-002", "8905002", "Household", "PureHome", "pcs", 210, 320, 18],
    ["Paper Towels 2pk", "HHD-003", "8905003", "Household", "PureHome", "pack", 120, 190, 12],
    ["Toothpaste 150g", "PCL-001", "8906001", "Personal Care", "Orbit", "pcs", 95, 150, 18],
    ["Shampoo 340ml", "PCL-002", "8906002", "Personal Care", "Fresco", "pcs", 260, 380, 18],
    ["Hand Soap 250ml", "PCL-003", "8906003", "Personal Care", "PureHome", "pcs", 110, 175, 12],
    ["Basmati Rice 5kg", "GRC-001", "8907001", "Household", "DailyBest", "pack", 900, 1250, 5],
    ["Cooking Oil 1L", "GRC-002", "8907002", "Household", "DailyBest", "L", 380, 520, 5],
  ] as const;

  const products = await db
    .insert(s.products)
    .values(
      productSeed.map(([name, sku, barcode, c, b, u, buy, sell, tax]) => ({
        name,
        sku,
        barcode,
        categoryId: cat(c),
        brandId: brand(b),
        unitId: unit(u),
        purchasePrice: buy,
        sellingPrice: sell,
        taxRate: tax,
        lowStockThreshold: 10,
      })),
    )
    .returning();

  // Opening stock in the main store
  const storeLoc = locs[0];
  await db.insert(s.stock).values(
    products.map((p) => ({
      productId: p.id,
      locationId: storeLoc.id,
      quantity: 60 + (p.id * 7) % 60,
    })),
  );
  await db.insert(s.stockMovements).values(
    products.map((p) => ({
      productId: p.id,
      locationId: storeLoc.id,
      type: "opening" as const,
      quantity: 60 + (p.id * 7) % 60,
      unitCost: p.purchasePrice,
      note: "Opening stock",
      userId: admin.id,
    })),
  );

  const customers = await db
    .insert(s.customers)
    .values([
      { name: "Riya Sharma", phone: "+91 98200 11223", email: "riya@example.com", loyaltyPoints: 120 },
      { name: "Kabir Anand", phone: "+91 99300 44556", loyaltyPoints: 45 },
      { name: "Meera Iyer", phone: "+91 90040 77889", email: "meera@example.com", balance: 2500 },
      { name: "Walk-in Customer", phone: null },
    ])
    .returning();

  const suppliers = await db
    .insert(s.suppliers)
    .values([
      { name: "Fresco Distributors", phone: "+91 22 4000 1234", email: "sales@fresco.example" },
      { name: "DailyBest Wholesale", phone: "+91 22 4000 5678" },
      { name: "PureHome Supply Co", phone: "+91 22 4000 9012" },
    ])
    .returning();

  await db.insert(s.settings).values([
    { key: "store.name", value: "Orbit POS — Main Store" },
    { key: "store.address", value: "12 Market Road, Jaipur" },
    { key: "store.phone", value: "+91 141 400 0000" },
    { key: "store.currency", value: "INR" },
    { key: "store.locale", value: "en-IN" },
    { key: "store.tax_inclusive", value: "false" },
    { key: "receipt.footer", value: "Thank you for shopping with Orbit POS" },
    { key: "receipt.show_logo", value: "true" },
    { key: "pos.low_stock_alert", value: "true" },
    { key: "pos.allow_negative_stock", value: "false" },
  ]);

  const [register] = await db.insert(s.cashRegisters).values([{ name: "Counter 1" }]).returning();
  await db.insert(s.registerSessions).values({
    registerId: register.id,
    userId: cashier.id,
    openingFloat: 500000,
  });

  // 14 days of sales history so the dashboard has real data
  let seq = 0;
  for (let day = 13; day >= 0; day--) {
    const count = 2 + ((day * 3) % 3);
    for (let k = 0; k < count; k++) {
      const created = new Date();
      created.setDate(created.getDate() - day);
      created.setHours(10 + ((k * 3) % 10), (k * 17) % 60, 0, 0);

      const picks = [products[(day + k) % products.length], products[(day * 2 + k) % products.length]];
      const lines = picks.map((p) => {
        const quantity = 1 + ((k + p.id) % 3);
        const t = computeLine({ quantity, unitPrice: p.sellingPrice, taxRate: p.taxRate });
        return { product: p, quantity, ...t };
      });
      const subtotal = lines.reduce((a, l) => a + l.net, 0);
      const tax = lines.reduce((a, l) => a + l.tax, 0);
      const total = subtotal + tax;

      seq += 1;
      const [sale] = await db
        .insert(s.sales)
        .values({
          invoiceNo: `INV-${created.getFullYear()}-${String(seq).padStart(4, "0")}`,
          clientUuid: `seed-${seq}`,
          customerId: customers[k % 3].id,
          sessionId: 1,
          subtotal,
          tax,
          total,
          paid: total,
          status: "completed",
          userId: k % 2 === 0 ? cashier.id : admin.id,
          createdAt: created,
          syncedAt: created,
        })
        .returning();

      await db.insert(s.saleItems).values(
        lines.map((l) => ({
          saleId: sale.id,
          productId: l.product.id,
          nameSnapshot: l.product.name,
          quantity: l.quantity,
          unitPrice: l.product.sellingPrice,
          taxRate: l.product.taxRate,
          lineTotal: l.total,
        })),
      );
      await db.insert(s.salePayments).values({
        saleId: sale.id,
        method: (["cash", "card", "qr"] as const)[k % 3],
        amount: total,
      });
    }
  }

  // Keep the invoice counter in step with the sales we just inserted,
  // otherwise the first API-generated invoice collides with a seeded one.
  await client.execute({
    sql: "INSERT INTO seq (name, value) VALUES ('INV', ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value",
    args: [seq],
  });

  await db.insert(s.expenses).values([
    { category: "Utilities", amount: 180000, note: "Electricity" },
    { category: "Rent", amount: 4500000, note: "Monthly rent" },
    { category: "Salary", amount: 3200000, note: "Staff payroll" },
  ]);

  await db.insert(s.activityLogs).values({
    userId: admin.id,
    action: "seed.completed",
    entity: "system",
    detail: JSON.stringify({ products: products.length, sales: seq }),
  });

  console.log(
    `Seeded: ${products.length} products, ${seq} sales, ${customers.length} customers, ${suppliers.length} suppliers`,
  );
  console.log(`Admin:   ${admin.email} / ${adminPass}`);
  console.log(`Cashier: ${cashier.email} / ${cashierPass}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
