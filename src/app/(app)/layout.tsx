import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <Shell user={{ name: user.name, role: user.role, permissions: user.permissions }}>
      {children}
    </Shell>
  );
}
