import { NextRequest, NextResponse } from "next/server"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { exportToCsv } from "@/lib/csv-service"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const ws = req.nextUrl.searchParams.get("ws")
  if (!ws) return NextResponse.json({ error: "Missing ws" }, { status: 400 })
  const ctx = await resolveWorkspace(ws)
  if (!can(ctx, "finance.export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { csv, count } = await exportToCsv(ctx, "invoices")
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${Date.now()}.csv"`,
      "X-Export-Count": String(count),
    },
  })
}
