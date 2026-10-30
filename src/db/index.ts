import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/orbit.db";

/**
 * Reuse one connection across hot reloads / lambda invocations.
 * A fresh client per request exhausts file handles under load.
 */
const globalForDb = globalThis as unknown as {
  __orbitClient?: ReturnType<typeof createClient>;
};

const client =
  globalForDb.__orbitClient ??
  createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

if (process.env.NODE_ENV !== "production") globalForDb.__orbitClient = client;

export const db = drizzle(client, { schema });
export { client, schema };
