import { NextRequest, NextResponse } from "next/server"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { db } from "@/lib/db"

export const runtime = "nodejs"

/**
 * Begin an OAuth flow for an integration provider.
 * In local mode (no provider credentials configured), returns a 501 with a
 * helpful message. In production, this would redirect to the provider's
 * authorize URL with state/PKCE.
 */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider")
  const ws = req.nextUrl.searchParams.get("ws")
  if (!provider || !ws) {
    return NextResponse.json({ error: "Missing provider or workspace" }, { status: 400 })
  }
  const ctx = await resolveWorkspace(ws)
  if (!can(ctx, "integrations.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Record the connection attempt
  await db.integrationConnection.create({
    data: {
      workspaceId: ctx.workspaceId,
      provider,
      status: "disconnected",
      connectedById: ctx.userId,
    },
  })

  return NextResponse.json({
    provider,
    status: "pending",
    message:
      "OAuth flow initiated. In local mode, the connection is recorded but not completed. " +
      "In production, this would redirect to the provider's authorize URL.",
    authorizeUrl: null,
  })
}
