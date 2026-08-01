"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function createClientRequestAction(portalSlug: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const priority = String(formData.get("priority") ?? "normal")
  if (!title) return { error: "Title is required." }

  // Portal slugs are presentation identifiers, not credentials. The
  // request-scoped Supabase client and this lookup both require the signed-in
  // identity to have explicit portal access to the client.
  const user = await getCurrentUser()
  if (!user) return { error: "Sign in is required." }

  const portal = await db.clientPortal.findUnique({ where: { slug: portalSlug } })
  if (!portal) return { error: "Portal not found." }

  await db.clientRequest.create({
    data: {
      workspaceId: portal.workspaceId,
      clientId: portal.clientId,
      title,
      description: description || null,
      priority,
      status: "new",
    },
  })

  revalidatePath(`/portal/${portalSlug}/requests`)
  return { ok: true }
}
