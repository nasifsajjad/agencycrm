import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const startedAt = Date.now()
  try {
    const supabase = await createServerClient()
    if (!supabase) throw new Error("Supabase is not configured")
    const { error } = await supabase.from("workspaces").select("id", { head: true, count: "exact" }).limit(1)
    if (error) throw error
    return NextResponse.json({
      status: "ok",
      time: new Date().toISOString(),
      db: "ok",
      latencyMs: Date.now() - startedAt,
      version: "0.1.0",
    })
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        time: new Date().toISOString(),
        db: "error",
        error: "database unavailable",
        latencyMs: Date.now() - startedAt,
        version: "0.1.0",
      },
      { status: 503 }
    )
  }
}
