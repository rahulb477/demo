"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: string;
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "▦", permission: "dashboard.view" },
      { href: "/reports", label: "Reports", icon: "◔", permission: "reports.view" },
    ],
  },
  {
    group: "Selling",
    items: [
      { href: "/pos", label: "Point of Sale", icon: "▣", permission: "sales.write" },
      { href: "/sales", label: "Sales", icon: "⌾", permission: "sales.read" },
      { href: "/quotations", label: "Quotations", icon: "⎘", permission: "quotations.read" },
      { href: "/customers", label: "Customers", icon: "☺", permission: "customers.read" },
    ],
  },
  {
    group: "Stock",
    items: [
      { href: "/products", label: "Products", icon: "▤", permission: "products.read" },
      { href: "/inventory", label: "Inventory", icon: "▥", permission: "inventory.read" },
      { href: "/purchases", label: "Purchases", icon: "⇩", permission: "purchases.read" },
    ],
  },
  {
    group: "Admin",
    items: [
      { href: "/users", label: "Staff & Roles", icon: "◎", permission: "users.read" },
      { href: "/settings", label: "Settings", icon: "⚙", permission: "settings.read" },
    ],
  },
];

export default function Shell({
  user,
  children,
}: {
  user: { name: string; role: string; permissions: string[] };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (localStorage.getItem("orbit-theme") as "light" | "dark") ?? "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("orbit-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const title =
    NAV.flatMap((g) => g.items).find((i) => pathname.startsWith(i.href))?.label ?? "Orbit POS";

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">O</div>
          <div>
            <div className="brand-name">Orbit POS</div>
            <span className="brand-sub">Main Store</span>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((group) => {
            const items = group.items.filter(
              (i) => !i.permission || user.permissions.includes(i.permission),
            );
            if (!items.length) return null;
            return (
              <div key={group.group}>
                <div className="nav-group">{group.group}</div>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={pathname.startsWith(item.href) ? "active" : ""}
                  >
                    <span className="ico">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <div className="avatar">{user.name.slice(0, 1)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="who-name">{user.name}</div>
              <div className="who-role">{user.role}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out" style={{ color: "#9aa3bd" }}>
              ⏻
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            ☰
          </button>
          <h1>{title}</h1>
          <button className="btn btn-sm" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "light" ? "☾ Dark" : "☀ Light"}
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
