import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();
  try {
    // Probe the database with a trivial query
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      time: new Date().toISOString(),
      db: "ok",
      latencyMs: Date.now() - startedAt,
      version: "0.1.0",
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        status: "degraded",
        time: new Date().toISOString(),
        db: "error",
        error: e?.message ?? "unknown",
        latencyMs: Date.now() - startedAt,
        version: "0.1.0",
      },
      { status: 503 }
    );
  }
}
