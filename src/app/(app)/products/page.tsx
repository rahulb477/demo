import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import { getStore } from "@/lib/store";
import { formatMoney } from "@/lib/money";
import ProductForm from "./ProductForm";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePage("products.read");
  const { q } = await searchParams;
  const store = await getStore();

  const like = `%${(q ?? "").trim()}%`;
  const rows = await client.execute({
    sql: `SELECT p.id, p.name, p.sku, p.barcode, p.selling_price, p.tax_rate, p.low_stock_threshold,
                 COALESCE(c.name,'—') category, COALESCE(b.name,'—') brand,
                 COALESCE(s.q,0) qty
          FROM products p
          LEFT JOIN categories c ON c.id=p.category_id
          LEFT JOIN brands b ON b.id=p.brand_id
          LEFT JOIN (SELECT product_id, SUM(quantity) q FROM stock GROUP BY product_id) s ON s.product_id=p.id
          WHERE p.is_active=1 AND (? = '%%' OR p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)
          ORDER BY p.name LIMIT 200`,
    args: [like, like, like, like],
  });

  const categories = await client.execute("SELECT id, name FROM categories ORDER BY name");
  const canWrite = user.permissions.includes("products.write");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <form className="toolbar" style={{ flex: 1 }} action="/products">
            <input className="input" style={{ maxWidth: 320 }} name="q" defaultValue={q ?? ""} placeholder="Search name, SKU or barcode…" />
            <button className="btn btn-sm" type="submit">Search</button>
            {q && <a className="btn btn-sm btn-ghost" href="/products">Clear</a>}
          </form>
          <div className="toolbar">
            <a className="btn btn-sm" href="/api/export/products?format=csv">CSV</a>
            <a className="btn btn-sm" href="/api/export/products?format=xlsx">XLSX</a>
            {canWrite && <ProductForm categories={categories.rows.map((c) => ({ id: Number(c.id), name: String(c.name) }))} />}
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.rows.length === 0 ? (
            <div className="empty"><div className="empty-title">No products found</div>Try a different search, or add your first product.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th><th className="hide-sm">Category</th><th className="hide-sm">Brand</th>
                    <th className="num">Price</th><th className="num">Tax</th><th className="num">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.rows.map((r) => {
                    const qty = Number(r.qty);
                    const low = qty <= Number(r.low_stock_threshold);
                    return (
                      <tr key={String(r.id)}>
                        <td>
                          <strong>{String(r.name)}</strong>
                          <div className="muted mono">{String(r.sku)}{r.barcode ? ` · ${String(r.barcode)}` : ""}</div>
                        </td>
                        <td className="hide-sm">{String(r.category)}</td>
                        <td className="hide-sm">{String(r.brand)}</td>
                        <td className="num">{formatMoney(Number(r.selling_price), store.currency, store.locale)}</td>
                        <td className="num muted">{Number(r.tax_rate)}%</td>
                        <td className="num">
                          <span className={`badge ${qty <= 0 ? "badge-danger" : low ? "badge-warn" : "badge-ok"}`}>{qty}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
