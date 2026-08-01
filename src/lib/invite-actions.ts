"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { createSession, hashPassword, normalizeEmail, setSessionCookie } from "@/lib/auth"
import { audit } from "@/lib/audit"
import type { WorkspaceContext } from "@/lib/auth"

export async function acceptInviteAction(input: {
  invitationId: string
  workspaceSlug: string
  email: string
  password: string
  displayName?: string
}) {
  if (!input.password || input.password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  const invitation = await db.invitation.findUnique({
    where: { id: input.invitationId },
    include: { workspace: true, roles: { include: { role: true } } },
  })
  if (
    !invitation ||
    invitation.acceptedAt ||
    invitation.revokedAt ||
    invitation.expiresAt < new Date()
  ) {
    return { error: "Invitation is no longer valid." }
  }
  if (normalizeEmail(invitation.emailNormalized) !== normalizeEmail(input.email)) {
    return { error: "This invitation was sent to a different email address." }
  }

  // Find or create user
  let user = await db.user.findUnique({ where: { emailNormalized: invitation.emailNormalized } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: invitation.emailNormalized,
        emailNormalized: invitation.emailNormalized,
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName || invitation.emailNormalized.split("@")[0],
      },
    })
  } else if (!user.passwordHash) {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password) },
    })
  }

  // Create membership + roles atomically
  const existingMembership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
  })
  if (existingMembership) {
    return { error: "You are already a member of this workspace." }
  }

  const membership = await db.workspaceMembership.create({
    data: {
      workspaceId: invitation.workspaceId,
      userId: user.id,
      status: "active",
      title: "Member",
    },
  })

  for (const r of invitation.roles) {
    await db.membershipRole.create({
      data: { membershipId: membership.id, roleId: r.roleId },
    })
  }

  await db.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  })

  // Audit
  const ctx: WorkspaceContext = {
    workspaceId: invitation.workspaceId,
    workspaceSlug: invitation.workspace.slug,
    workspaceName: invitation.workspace.name,
    userId: user.id,
    membershipId: membership.id,
    roles: invitation.roles.map((r) => r.role.name),
    permissions: new Set(),
    isOwner: false,
  }
  await audit({
    ctx,
    action: "invitation.accepted",
    entityType: "invitation",
    entityId: invitation.id,
    after: { email: invitation.emailNormalized },
  })

  const { token, expiresAt } = await createSession(user.id)
  await setSessionCookie(token, expiresAt)
  redirect(`/w/${invitation.workspace.slug}`)
}
