import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import type { Permission } from "@/lib/rbac";

/** Page-level guard. Server components render nothing unauthorised. */
export async function requirePage(permission?: Permission) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (permission && !user.permissions.includes(permission)) redirect("/dashboard");
  return user;
}
