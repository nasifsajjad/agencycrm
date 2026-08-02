import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET() {
  const user = await getCurrentUser()
  // This answered 200 {count:0} to anonymous callers, so an unauthenticated
  // request could not tell it apart from a signed-in one with nothing unread.
  // Nothing leaked, but an endpoint that reports success without a session
  // hides misconfiguration and invites a client to poll it forever.
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const count = await db.notification.count({
    where: { userId: user.id, readAt: null },
  })
  return NextResponse.json({ count })
}
