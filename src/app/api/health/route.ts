import { NextResponse } from "next/server";
import { client } from "@/db";

export async function GET() {
  try {
    await client.execute("SELECT 1");
    return NextResponse.json({ status: "ok", db: "up" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
