import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { fail, handler, logActivity, ok } from "@/lib/api";

const input = z.object({ email: z.string().email(), password: z.string().min(1) });

export const POST = handler(async (request: Request) => {
  const body = input.parse(await request.json());

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.isActive || !(await verifyPassword(body.password, user.passwordHash))) {
    return fail(401, "Invalid email or password");
  }

  const [role] = await db.select().from(schema.roles).where(eq(schema.roles.id, user.roleId)).limit(1);
  const permissions: string[] = role ? JSON.parse(role.permissions) : [];

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: role?.name ?? "Cashier",
    permissions,
  });
  await setSessionCookie(token);
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await logActivity(user.id, "auth.login", "user", user.id);

  return ok({ user: { id: user.id, name: user.name, role: role?.name, permissions } });
});
