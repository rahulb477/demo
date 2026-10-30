import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePage("users.read");
  const users = await client.execute(
    `SELECT u.id, u.name, u.email, u.is_active, u.last_login_at, r.name role
     FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.id`,
  );
  const roles = await client.execute("SELECT name, description, permissions FROM roles ORDER BY id");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <div className="card-head"><h2>Staff accounts</h2></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Name</th><th className="hide-sm">Email</th><th>Role</th><th>Status</th><th className="hide-sm">Last login</th></tr></thead>
            <tbody>
              {users.rows.map((u) => (
                <tr key={String(u.id)}>
                  <td><strong>{String(u.name)}</strong></td>
                  <td className="hide-sm mono">{String(u.email)}</td>
                  <td><span className="badge badge-neutral">{String(u.role)}</span></td>
                  <td><span className={`badge ${u.is_active ? "badge-ok" : "badge-danger"}`}>{u.is_active ? "active" : "disabled"}</span></td>
                  <td className="hide-sm muted">{u.last_login_at ? new Date(Number(u.last_login_at)).toLocaleString() : "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Roles & permissions</h2></div>
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          {roles.rows.map((r) => {
            const perms: string[] = JSON.parse(String(r.permissions));
            return (
              <div key={String(r.name)} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong>{String(r.name)}</strong>
                  <span className="badge badge-neutral">{perms.length} permissions</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{String(r.description ?? "")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {perms.map((p) => <span key={p} className="badge badge-neutral mono" style={{ fontSize: 10.5 }}>{p}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
