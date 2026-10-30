import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/* Money is stored as INTEGER minor units (cents). Never floats.       */
/* ------------------------------------------------------------------ */

const now = () => new Date();

/* ----------------------------- identity ---------------------------- */

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  /** JSON array of permission strings, e.g. ["products.read","pos.sell"] */
  permissions: text("permissions").notNull().default("[]"),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: integer("role_id").notNull().references(() => roles.id),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

/* ------------------------------ catalog ---------------------------- */

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const units = sqliteTable("units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
});

/** Physical stock locations: store floor, godown, shelf, rack. */
export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["store", "godown", "shelf", "rack"] }).notNull().default("store"),
  parentId: integer("parent_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    categoryId: integer("category_id").references(() => categories.id),
    brandId: integer("brand_id").references(() => brands.id),
    unitId: integer("unit_id").references(() => units.id),
    purchasePrice: integer("purchase_price").notNull().default(0),
    sellingPrice: integer("selling_price").notNull().default(0),
    taxRate: real("tax_rate").notNull().default(0),
    discountValue: integer("discount_value").notNull().default(0),
    isWeighted: integer("is_weighted", { mode: "boolean" }).notNull().default(false),
    trackStock: integer("track_stock", { mode: "boolean" }).notNull().default(true),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    imageUrl: text("image_url"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("products_sku_uq").on(t.sku),
    index("products_barcode_idx").on(t.barcode),
    index("products_name_idx").on(t.name),
  ],
);

export const productVariants = sqliteTable("product_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku"),
  barcode: text("barcode"),
  price: integer("price").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const batches = sqliteTable("batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  batchNo: text("batch_no").notNull(),
  expiryDate: integer("expiry_date", { mode: "timestamp_ms" }),
  quantity: integer("quantity").notNull().default(0),
  cost: integer("cost").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

/* ------------------------------ stock ------------------------------ */

/** Current on-hand quantity. Unique per product/variant/location. */
export const stock = sqliteTable(
  "stock",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    locationId: integer("location_id").notNull().references(() => locations.id),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => [uniqueIndex("stock_uq").on(t.productId, t.variantId, t.locationId)],
);

/** Append-only ledger of every quantity change. */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => productVariants.id),
    locationId: integer("location_id").notNull().references(() => locations.id),
    type: text("type", {
      enum: ["purchase", "sale", "adjustment", "transfer", "return", "opening", "count"],
    }).notNull(),
    /** signed: negative reduces stock */
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost").notNull().default(0),
    refType: text("ref_type"),
    refId: integer("ref_id"),
    note: text("note"),
    userId: integer("user_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (t) => [index("sm_product_idx").on(t.productId), index("sm_created_idx").on(t.createdAt)],
);

export const stockTransfers = sqliteTable("stock_transfers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromLocationId: integer("from_location_id").notNull().references(() => locations.id),
  toLocationId: integer("to_location_id").notNull().references(() => locations.id),
  status: text("status", { enum: ["pending", "completed", "cancelled"] }).notNull().default("completed"),
  note: text("note"),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const stockTransferItems = sqliteTable("stock_transfer_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transferId: integer("transfer_id").notNull().references(() => stockTransfers.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  variantId: integer("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
});

/* --------------------------- parties ------------------------------- */

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  balance: integer("balance").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  balance: integer("balance").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

/* --------------------------- purchasing ---------------------------- */

export const purchases = sqliteTable("purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNo: text("invoice_no").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  date: integer("date", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  subtotal: integer("subtotal").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull().default(0),
  paid: integer("paid").notNull().default(0),
  status: text("status", { enum: ["received", "partial", "paid", "returned"] }).notNull().default("received"),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const purchaseItems = sqliteTable("purchase_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  variantId: integer("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull(),
  unitCost: integer("unit_cost").notNull(),
  taxRate: real("tax_rate").notNull().default(0),
  lineTotal: integer("line_total").notNull(),
});

export const purchasePayments = sqliteTable("purchase_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  method: text("method", { enum: ["cash", "card", "bank", "qr", "credit"] }).notNull().default("cash"),
  date: integer("date", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  userId: integer("user_id").references(() => users.id),
});

export const purchaseReturns = sqliteTable("purchase_returns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").notNull().references(() => purchases.id),
  total: integer("total").notNull(),
  reason: text("reason"),
  date: integer("date", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  userId: integer("user_id").references(() => users.id),
});

export const purchaseReturnItems = sqliteTable("purchase_return_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  returnId: integer("return_id").notNull().references(() => purchaseReturns.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitCost: integer("unit_cost").notNull(),
});

/* ----------------------------- sales ------------------------------- */

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceNo: text("invoice_no").notNull(),
    /** offline idempotency key — unique so retries can never double-charge */
    clientUuid: text("client_uuid").notNull(),
    customerId: integer("customer_id").references(() => customers.id),
    sessionId: integer("session_id"),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull().default(0),
    paid: integer("paid").notNull().default(0),
    changeDue: integer("change_due").notNull().default(0),
    status: text("status", { enum: ["completed", "held", "refunded", "partially_returned", "void"] })
      .notNull()
      .default("completed"),
    note: text("note"),
    userId: integer("user_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("sales_invoice_uq").on(t.invoiceNo),
    uniqueIndex("sales_client_uuid_uq").on(t.clientUuid),
    index("sales_created_idx").on(t.createdAt),
  ],
);

export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  variantId: integer("variant_id").references(() => productVariants.id),
  batchId: integer("batch_id").references(() => batches.id),
  nameSnapshot: text("name_snapshot").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  discount: integer("discount").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  lineTotal: integer("line_total").notNull(),
});

export const salePayments = sqliteTable("sale_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  method: text("method", { enum: ["cash", "card", "qr", "bank", "credit", "loyalty"] }).notNull(),
  amount: integer("amount").notNull(),
  reference: text("reference"),
});

export const saleReturns = sqliteTable("sale_returns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => sales.id),
  total: integer("total").notNull(),
  reason: text("reason"),
  restock: integer("restock", { mode: "boolean" }).notNull().default(true),
  date: integer("date", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  userId: integer("user_id").references(() => users.id),
});

export const saleReturnItems = sqliteTable("sale_return_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  returnId: integer("return_id").notNull().references(() => saleReturns.id, { onDelete: "cascade" }),
  saleItemId: integer("sale_item_id").notNull().references(() => saleItems.id),
  quantity: integer("quantity").notNull(),
  amount: integer("amount").notNull(),
});

/* --------------------------- quotations ---------------------------- */

export const quotations = sqliteTable("quotations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quoteNo: text("quote_no").notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  date: integer("date", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  validUntil: integer("valid_until", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["draft", "sent", "accepted", "converted", "expired"] }).notNull().default("draft"),
  subtotal: integer("subtotal").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull().default(0),
  convertedSaleId: integer("converted_sale_id"),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const quotationItems = sqliteTable("quotation_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quotationId: integer("quotation_id").notNull().references(() => quotations.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id),
  nameSnapshot: text("name_snapshot").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  taxRate: real("tax_rate").notNull().default(0),
  lineTotal: integer("line_total").notNull(),
});

/* ------------------------ cash & accounting ------------------------ */

export const cashRegisters = sqliteTable("cash_registers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const registerSessions = sqliteTable("register_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  registerId: integer("register_id").notNull().references(() => cashRegisters.id),
  userId: integer("user_id").notNull().references(() => users.id),
  openedAt: integer("opened_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  openingFloat: integer("opening_float").notNull().default(0),
  closingCash: integer("closing_cash"),
  expectedCash: integer("expected_cash"),
  difference: integer("difference"),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
});

export const cashTransactions = sqliteTable("cash_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => registerSessions.id),
  type: text("type", { enum: ["opening", "sale", "in", "out", "expense", "refund", "closing"] }).notNull(),
  amount: integer("amount").notNull(),
  note: text("note"),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  note: text("note"),
  date: integer("date", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  userId: integer("user_id").references(() => users.id),
});

export const incomes = sqliteTable("incomes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  amount: integer("amount").notNull(),
  note: text("note"),
  date: integer("date", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  userId: integer("user_id").references(() => users.id),
});

export const loyaltyTransactions = sqliteTable("loyalty_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  type: text("type", { enum: ["earn", "redeem", "adjust"] }).notNull(),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

/* ------------------------ system / audit --------------------------- */

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: integer("entity_id"),
    detail: text("detail"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);

export const importJobs = sqliteTable("import_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  filename: text("filename"),
  status: text("status", { enum: ["preview", "completed", "failed"] }).notNull().default("preview"),
  totalRows: integer("total_rows").notNull().default(0),
  successRows: integer("success_rows").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errors: text("errors"),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const backups = sqliteTable("backups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  size: integer("size").notNull().default(0),
  checksum: text("checksum"),
  userId: integer("user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const seq = sqliteTable("seq", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
