import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ count: 0 })
  const count = await db.notification.count({
    where: { userId: user.id, readAt: null },
  })
  return NextResponse.json({ count })
}
