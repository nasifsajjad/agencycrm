import { NextRequest, NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { readFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const exp = Number(req.nextUrl.searchParams.get("exp") ?? 0);
  if (exp && exp < Date.now()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }
  const workspaceSlug = req.nextUrl.searchParams.get("ws") ?? "";
  if (!workspaceSlug) return NextResponse.json({ error: "Missing workspace" }, { status: 400 });
  const wctx = await resolveWorkspace(workspaceSlug);
  if (!can(wctx, "files.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const result = await readFile(wctx, fileId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(result.body), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Length": String(result.size),
      "Content-Disposition": `inline; filename="${result.originalName.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
