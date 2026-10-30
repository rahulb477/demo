import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession, type SessionUser } from "@/lib/auth";
import type { Permission } from "@/lib/rbac";
import { db, schema } from "@/db";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Uniform error envelope: never leak stack traces to clients. */
export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function requireUser(permission?: Permission): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Unauthorized");
  if (permission && !user.permissions.includes(permission)) {
    throw new ApiError(403, `Forbidden: requires ${permission}`);
  }
  return user;
}

export async function logActivity(
  userId: number | null,
  action: string,
  entity?: string,
  entityId?: number,
  detail?: unknown,
) {
  await db.insert(schema.activityLogs).values({
    userId: userId ?? null,
    action,
    entity: entity ?? null,
    entityId: entityId ?? null,
    detail: detail === undefined ? null : JSON.stringify(detail),
  });
}

/** Wraps a route handler with auth, validation and safe error mapping. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) return fail(error.status, error.message, error.details);
      if (error instanceof ZodError) {
        return fail(422, "Validation failed", error.flatten());
      }
      console.error("[api]", error);
      return fail(500, "Internal server error");
    }
  };
}

/** Human-readable sequence numbers (INV-2026-0001). */
export async function nextSequence(name: string): Promise<number> {
  const { client } = await import("@/db");
  await client.execute({
    sql: "INSERT INTO seq (name, value) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value = value + 1",
    args: [name],
  });
  const row = await client.execute({ sql: "SELECT value FROM seq WHERE name = ?", args: [name] });
  return Number(row.rows[0]?.value ?? 1);
}

export async function nextDocumentNumber(prefix: string): Promise<string> {
  const n = await nextSequence(prefix);
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}
