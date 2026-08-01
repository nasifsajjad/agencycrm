import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { processOutbox } from "@/lib/automation"

export const runtime = "nodejs"

/**
 * Scheduled endpoint to process the transactional outbox and run automations.
 * Gate with CRON_SECRET header. In production, schedule with pg_cron or Vercel Cron.
 *
 * Example Vercel Cron entry in vercel.json:
 *   { "path": "/api/cron/process-outbox", "schedule": "* * * * *" }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  }
  const presented = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""
  const expected = Buffer.from(cronSecret)
  const actual = Buffer.from(presented)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await processOutbox(50)
    return NextResponse.json({ ok: true, ...result, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Outbox processing failed" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
