import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(_request: NextRequest) {
  return NextResponse.json(
    { error: "Integration OAuth adapters are not configured for this deployment." },
    { status: 501 }
  )
}
