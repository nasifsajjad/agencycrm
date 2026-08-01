import { NextRequest, NextResponse } from "next/server"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { previewImport, type ImportTarget } from "@/lib/csv-service"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const ws = String(formData.get("workspaceSlug") ?? "")
  const target = String(formData.get("target") ?? "") as ImportTarget
  const file = formData.get("file") as File | null
  if (!file || !ws)
    return NextResponse.json({ error: "Missing file or workspace" }, { status: 400 })
  const ctx = await resolveWorkspace(ws)
  if (!can(ctx, "crm.create") && !can(ctx, "clients.create") && !can(ctx, "time.manage_own")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const buf = Buffer.from(await file.arrayBuffer())
  const preview = previewImport(target, buf)
  return NextResponse.json(preview)
}
