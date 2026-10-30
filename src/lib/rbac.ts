export const PERMISSIONS = [
  "dashboard.view",
  "products.read", "products.write", "products.delete",
  "inventory.read", "inventory.write",
  "purchases.read", "purchases.write",
  "sales.read", "sales.write", "sales.refund",
  "customers.read", "customers.write",
  "suppliers.read", "suppliers.write",
  "quotations.read", "quotations.write",
  "cash.read", "cash.write",
  "expenses.read", "expenses.write",
  "reports.view",
  "users.read", "users.write",
  "settings.read", "settings.write",
  "exports.run", "imports.run", "backup.run", "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PRESETS: Record<string, Permission[]> = {
  Admin: [...PERMISSIONS],
  Manager: PERMISSIONS.filter(
    (p) => !["users.write", "settings.write", "backup.run"].includes(p),
  ),
  Cashier: [
    "dashboard.view",
    "products.read",
    "sales.read", "sales.write",
    "customers.read", "customers.write",
    "quotations.read",
    "cash.read", "cash.write",
  ],
};

export function hasPermission(permissions: string[], required: Permission): boolean {
  return permissions.includes(required);
}

export function canAny(permissions: string[], required: Permission[]): boolean {
  return required.some((p) => permissions.includes(p));
}
