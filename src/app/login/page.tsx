"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed");
        return;
      }
      router.replace(params.get("next") ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Network error — please retry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-art">
        <div>
          <div className="brand" style={{ padding: 0 }}>
            <div className="brand-mark">O</div>
            <div>
              <div className="brand-name">Orbit POS</div>
              <span className="brand-sub">Retail operating system</span>
            </div>
          </div>
          <h2 style={{ marginTop: 38 }}>Sell, count and reconcile — in one place.</h2>
          <p>A point of sale built for counters that cannot go down: offline-tolerant checkout, atomic stock, and audit-grade records.</p>
          <div className="auth-points">
            {[
              "Sub-second checkout with barcode-first search",
              "Stock, purchases and cash reconciled automatically",
              "Every action attributable to a named operator",
            ].map((t) => (
              <div className="auth-point" key={t}>
                <span className="dot" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#6f7899" }}>
          © {new Date().getFullYear()} Orbit POS — original implementation
        </div>
      </div>

      <div className="auth-form">
        <div className="auth-card">
          <h1 style={{ fontSize: 24 }}>Sign in</h1>
          <p className="muted" style={{ marginTop: 6, marginBottom: 22 }}>
            Use your staff account to continue.
          </p>
          <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@store.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="error-text" role="alert">
                {error}
              </div>
            )}
            <button className="btn btn-primary" style={{ height: 40 }} disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="auth-demo">
            <strong>Demo accounts</strong> (seeded locally)
            <br />
            Admin: <code>admin@orbitpos.local</code> / <code>Admin#12345</code>
            <br />
            Cashier: <code>cashier@orbitpos.local</code> / <code>Cashier#12345</code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-form">
          <div className="skeleton" style={{ width: 320, height: 220 }} />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
