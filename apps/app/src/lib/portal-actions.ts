"use server"

import { revalidatePath } from "next/cache"
import { db, rpc } from "@/lib/db"
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

  await rpc("create_client_request", {
    p_portal_slug: portalSlug,
    p_title: title,
    p_description: description || null,
    p_priority: priority,
  })

  revalidatePath(`/portal/${portalSlug}/requests`)
  return { ok: true }
}

export async function decidePortalApprovalAction(
  portalSlug: string,
  approvalId: string,
  decision: "approved" | "changes_requested",
  note: string
) {
  const user = await getCurrentUser()
  if (!user) return { error: "Sign in is required." }
  const portal = await db.clientPortal.findUnique({ where: { slug: portalSlug } })
  if (!portal) return { error: "Portal not found." }
  const approval = await db.approvalRequest.findFirst({
    where: {
      id: approvalId,
      workspaceId: portal.workspaceId,
      status: "pending",
      entityType: "deliverable",
    },
    include: { steps: true },
  })
  if (!approval) return { error: "Approval not found or no longer pending." }
  const deliverable = await db.deliverable.findFirst({
    where: {
      id: approval.entityId,
      workspaceId: portal.workspaceId,
      clientId: portal.clientId,
      visibility: "client",
    },
  })
  if (!deliverable) return { error: "Approval is not shared with this client." }
  const step = approval.steps.find((candidate) => candidate.status === "pending")
  if (!step) return { error: "Approval is no longer pending." }
  try {
    await rpc("decide_approval", {
      p_workspace_id: portal.workspaceId,
      p_approval_id: approval.id,
      p_step_id: step.id,
      p_decision: decision,
      p_note: note || null,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to record approval decision." }
  }
  revalidatePath(`/portal/${portalSlug}/approvals`)
  revalidatePath(`/portal/${portalSlug}`)
  return { ok: true }
}
