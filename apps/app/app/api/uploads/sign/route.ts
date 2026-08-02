import { NextRequest, NextResponse } from "next/server"
import { resolveWorkspace } from "@/lib/server"
import { can, getCurrentUser } from "@/lib/auth"
import { uploadFile } from "@/lib/storage"

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
  const workspaceSlug = String(formData.get("workspaceSlug") ?? "")
  const entityType = String(formData.get("entityType") ?? "") || undefined
  const entityId = String(formData.get("entityId") ?? "") || undefined
  const visibility =
    (String(formData.get("visibility") ?? "internal") as "internal" | "client" | "restricted") ||
    "internal"
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "files.upload")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = Buffer.from(await file.arrayBuffer())
    const result = await uploadFile({
      ctx,
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      body,
      entityType,
      entityId,
      visibility,
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 400 })
  }
}
