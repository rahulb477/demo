import { requirePage } from "@/lib/page-guard";
import { client } from "@/db";
import PosClient from "./PosClient";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  await requirePage("sales.write");

  const products = await client.execute({
    sql: `SELECT p.id, p.name, p.sku, p.barcode, p.selling_price, p.tax_rate, p.is_weighted,
                 COALESCE(s.q,0) qty, COALESCE(c.name,'Uncategorised') category
          FROM products p
          LEFT JOIN (SELECT product_id, SUM(quantity) q FROM stock GROUP BY product_id) s ON s.product_id=p.id
          LEFT JOIN categories c ON c.id=p.category_id
          WHERE p.is_active=1 ORDER BY p.name`,
  });

  const customers = await client.execute("SELECT id, name, phone, loyalty_points FROM customers ORDER BY name");
  const categories = await client.execute("SELECT DISTINCT COALESCE(c.name,'Uncategorised') name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 ORDER BY name");

  return (
    <PosClient
      products={products.rows.map((r) => ({
        id: Number(r.id), name: String(r.name), sku: String(r.sku),
        barcode: r.barcode ? String(r.barcode) : null,
        price: Number(r.selling_price), taxRate: Number(r.tax_rate),
        isWeighted: Boolean(r.is_weighted), qty: Number(r.qty), category: String(r.category),
      }))}
      customers={customers.rows.map((r) => ({
        id: Number(r.id), name: String(r.name), phone: r.phone ? String(r.phone) : null,
        points: Number(r.loyalty_points),
      }))}
      categories={categories.rows.map((r) => String(r.name))}
    />
  );
}
