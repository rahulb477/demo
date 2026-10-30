import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, logActivity, ok, requireUser } from "@/lib/api";

const input = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(40).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  address: z.string().max(240).nullable().optional(),
});

export const GET = handler(async () => {
  await requireUser("customers.read");
  const rows = await db.select().from(schema.customers).orderBy(desc(schema.customers.id)).limit(200);
  return ok({ data: rows });
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser("customers.write");
  const body = input.parse(await request.json());
  const [created] = await db.insert(schema.customers).values(body).returning();
  await logActivity(user.id, "customer.create", "customer", created.id);
  return ok(created, { status: 201 });
});

export const PATCH = handler(async (request: Request) => {
  const user = await requireUser("customers.write");
  const body = input.partial().extend({ id: z.number().int().positive() }).parse(await request.json());
  const { id, ...rest } = body;
  const [updated] = await db.update(schema.customers).set(rest).where(eq(schema.customers.id, id)).returning();
  await logActivity(user.id, "customer.update", "customer", id);
  return ok(updated);
});
