import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { processOutbox } from "@/lib/automation"

export const runtime = "nodejs"

/**
 * Scheduled endpoint to process the transactional outbox and run automations.
 *
 * Authorization is a bearer token compared against CRON_SECRET in constant
 * time. The route fails closed with 503 when CRON_SECRET is unset, so a
 * misconfigured deployment does not silently run the worker unauthenticated.
 *
 * Both GET and POST are accepted, and this is deliberate. Vercel Cron invokes
 * its targets with **GET**, sending `Authorization: Bearer $CRON_SECRET`
 * automatically when that variable is set on the project. A POST-only route —
 * which this was — returns 405 to every scheduled invocation, so the outbox
 * never drains and nothing reports an error, because the scheduler treats a
 * 405 as a delivered request. Other schedulers (pg_cron via pg_net, an
 * external worker) generally POST. Support both rather than pick one and
 * break the other.
 *
 * The handler is not idempotent-by-accident: claim_outbox_events locks the
 * rows it hands out, so concurrent invocations do not double-process.
 *
 * See vercel.json for the schedule.
 */
async function handle(req: NextRequest) {
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
    return NextResponse.json(
      { ok: true, ...result, time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Outbox processing failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
