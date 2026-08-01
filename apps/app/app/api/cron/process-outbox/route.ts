import { NextRequest, NextResponse } from "next/server"
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
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await processOutbox(50)
  return NextResponse.json({ ok: true, ...result, time: new Date().toISOString() })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
