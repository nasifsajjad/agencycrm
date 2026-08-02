import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Liveness probe.
 *
 * This previously selected from public.workspaces. `anon` has no SELECT grant
 * on that table — table privileges go to `authenticated` only (0007:91) — so
 * an unauthenticated probe always raised "permission denied" and this endpoint
 * always answered 503 "degraded" while the app was serving fine. Anything
 * watching it (a load balancer, an uptime monitor, a platform health check)
 * would have treated the service as permanently down.
 *
 * It now calls public.health_check() (migration 0028), which is granted to
 * anon, returns no tenant data, and confirms both connectivity and that
 * migrations have run.
 */
export async function GET() {
  const startedAt = Date.now()
  try {
    const supabase = await createServerClient()
    if (!supabase) throw new Error("Supabase is not configured")

    const { data, error } = await supabase.rpc("health_check")
    if (error) throw error

    const healthy = Boolean((data as { ok?: boolean } | null)?.ok)
    if (!healthy) throw new Error("database reachable but not migrated")

    return NextResponse.json(
      {
        status: "ok",
        time: new Date().toISOString(),
        db: "ok",
        latencyMs: Date.now() - startedAt,
        version: "0.1.0",
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    // The reason is deliberately not echoed to the caller: this endpoint is
    // public and database errors leak schema detail.
    return NextResponse.json(
      {
        status: "degraded",
        time: new Date().toISOString(),
        db: "error",
        error: "database unavailable",
        latencyMs: Date.now() - startedAt,
        version: "0.1.0",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
