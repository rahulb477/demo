import { client } from "@/db";
import { requirePage } from "@/lib/page-guard";
import ImportPanel from "./ImportPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePage("settings.read");
  const settings = await client.execute("SELECT key, value FROM settings ORDER BY key");
  const backups = await client.execute("SELECT filename, size, created_at FROM backups ORDER BY id DESC LIMIT 5");
  const canBackup = user.permissions.includes("backup.run");
  const canImport = user.permissions.includes("imports.run");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <div className="card-head"><h2>Store configuration</h2></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody>
              {settings.rows.map((s) => (
                <tr key={String(s.key)}><td className="mono">{String(s.key)}</td><td>{String(s.value)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Backup</h2></div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              A backup is a JSON snapshot of every table with a SHA-256 checksum recorded alongside it.
            </p>
            {canBackup ? (
              <a className="btn btn-primary" href="/api/backup">Download full backup</a>
            ) : (
              <div className="badge badge-warn">Requires backup.run permission</div>
            )}
            <div>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Recent backups</div>
              {backups.rows.length === 0 ? <div className="muted" style={{ fontSize: 12 }}>None yet.</div> : (
                <table className="table">
                  <tbody>
                    {backups.rows.map((b) => (
                      <tr key={String(b.filename)}>
                        <td className="mono" style={{ fontSize: 11 }}>{String(b.filename)}</td>
                        <td className="num muted">{(Number(b.size) / 1024).toFixed(1)} KB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Import products</h2></div>
          <div className="card-body">
            {canImport ? <ImportPanel /> : <div className="badge badge-warn">Requires imports.run permission</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
