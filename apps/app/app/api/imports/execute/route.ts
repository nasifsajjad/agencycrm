import { NextRequest, NextResponse } from "next/server"
import { resolveWorkspace } from "@/lib/server"
import { can, getCurrentUser } from "@/lib/auth"
import { executeImport, type ImportTarget } from "@/lib/csv-service"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  // Establish a session before reading the body. `req.formData()` buffers the
  // entire multipart payload, so parsing first let an unauthenticated caller
  // make the server absorb an arbitrarily large upload before any check ran.
  // The workspace and permission checks still follow, since the slug only
  // becomes known after parsing.
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const ws = String(formData.get("workspaceSlug") ?? "")
  const target = String(formData.get("target") ?? "") as ImportTarget
  const mappingJson = String(formData.get("mapping") ?? "{}")
  const file = formData.get("file") as File | null
  if (!file || !ws)
    return NextResponse.json({ error: "Missing file or workspace" }, { status: 400 })
  const ctx = await resolveWorkspace(ws)
  if (!can(ctx, "crm.create") && !can(ctx, "clients.create") && !can(ctx, "time.manage_own")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const mapping = JSON.parse(mappingJson) as Record<string, string>
  const buf = Buffer.from(await file.arrayBuffer())
  const result = await executeImport(ctx, target, mapping, buf)
  return NextResponse.json(result)
}
