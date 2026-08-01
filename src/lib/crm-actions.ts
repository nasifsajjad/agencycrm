"use server"

import { revalidatePath } from "next/cache"
import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { can, AuthorizationError } from "@/lib/auth"
import type { Permission } from "@/lib/permissions"
import { resolveWorkspace } from "@/lib/server"
import { audit } from "@/lib/audit"
import { normalizeEmail } from "@/lib/auth"

async function withPermission<T>(
  slug: string,
  perm: Permission,
  fn: () => Promise<T>
): Promise<{ ok?: true; data?: T; error?: string }> {
  const ctx = await resolveWorkspace(slug)
  if (!can(ctx, perm)) throw new AuthorizationError(`Missing permission: ${perm}`)
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (e: any) {
    return { error: e?.message ?? "Operation failed" }
  }
}

// ---- Contacts ----

export async function createContactAction(slug: string, formData: FormData) {
  return withPermission(slug, "crm.create", async () => {
    const firstName = String(formData.get("firstName") ?? "").trim()
    const lastName = String(formData.get("lastName") ?? "").trim()
    const email = String(formData.get("email") ?? "").trim()
    const phone = String(formData.get("phone") ?? "").trim()
    const jobTitle = String(formData.get("jobTitle") ?? "").trim()
    const companyId = String(formData.get("companyId") ?? "").trim() || null
    const ownerId = String(formData.get("ownerId") ?? "").trim() || null
    const lifecycleStage = String(formData.get("lifecycleStage") ?? "lead")
    if (!firstName && !lastName) throw new Error("First or last name is required.")
    const ctx = await resolveWorkspace(slug)
    const contact = await db.contact.create({
      data: {
        workspaceId: ctx.workspaceId,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        jobTitle: jobTitle || null,
        companyId,
        ownerId,
        lifecycleStage,
      },
    })
    await audit({
      ctx,
      action: "contact.created",
      entityType: "contact",
      entityId: contact.id,
      after: { name: `${firstName} ${lastName}`, email },
    })
    revalidatePath(`/w/${slug}/crm/contacts`)
    return contact
  })
}

export async function deleteContactAction(slug: string, id: string) {
  return withPermission(slug, "crm.delete", async () => {
    const ctx = await resolveWorkspace(slug)
    const contact = await db.contact.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
    if (!contact) throw new Error("Contact not found.")
    await db.contact.delete({ where: { id } })
    await audit({
      ctx,
      action: "contact.deleted",
      entityType: "contact",
      entityId: id,
      before: { name: `${contact.firstName} ${contact.lastName}` },
    })
    revalidatePath(`/w/${slug}/crm/contacts`)
    return true
  })
}

// ---- Companies ----

export async function createCompanyAction(slug: string, formData: FormData) {
  return withPermission(slug, "crm.create", async () => {
    const name = String(formData.get("name") ?? "").trim()
    const domain = String(formData.get("domain") ?? "").trim()
    const industry = String(formData.get("industry") ?? "").trim()
    const website = String(formData.get("website") ?? "").trim()
    const sizeBand = String(formData.get("sizeBand") ?? "").trim()
    if (!name) throw new Error("Company name is required.")
    const ctx = await resolveWorkspace(slug)
    const company = await db.company.create({
      data: {
        workspaceId: ctx.workspaceId,
        name,
        domain: domain || null,
        industry: industry || null,
        website: website || null,
        sizeBand: sizeBand || null,
        ownerId: ctx.userId,
        lifecycleStage: "lead",
      },
    })
    await audit({
      ctx,
      action: "company.created",
      entityType: "company",
      entityId: company.id,
      after: { name, domain },
    })
    revalidatePath(`/w/${slug}/crm/companies`)
    return company
  })
}

// ---- Leads ----

export async function createLeadAction(slug: string, formData: FormData) {
  return withPermission(slug, "crm.create", async () => {
    const firstName = String(formData.get("firstName") ?? "").trim()
    const lastName = String(formData.get("lastName") ?? "").trim()
    const email = String(formData.get("email") ?? "").trim()
    const company = String(formData.get("company") ?? "").trim()
    const source = String(formData.get("source") ?? "Inbound").trim()
    const scoreRaw = Number(formData.get("score") ?? 0)
    const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, scoreRaw)) : 0
    if (!firstName && !lastName && !email) throw new Error("At least a name or email is required.")
    const ctx = await resolveWorkspace(slug)

    let companyId: string | null = null
    if (company) {
      const existing = await db.company.findFirst({
        where: { workspaceId: ctx.workspaceId, name: company },
      })
      if (existing) companyId = existing.id
      else {
        const c = await db.company.create({
          data: {
            workspaceId: ctx.workspaceId,
            name: company,
            ownerId: ctx.userId,
            lifecycleStage: "lead",
          },
        })
        companyId = c.id
      }
    }
    let contactId: string | null = null
    if (firstName || lastName || email) {
      const c = await db.contact.create({
        data: {
          workspaceId: ctx.workspaceId,
          firstName: firstName || null,
          lastName: lastName || null,
          email: email || null,
          companyId,
          ownerId: ctx.userId,
          lifecycleStage: "lead",
        },
      })
      contactId = c.id
    }
    const lead = await db.lead.create({
      data: {
        workspaceId: ctx.workspaceId,
        contactId,
        companyId,
        source: source || null,
        score,
        status: "new",
        ownerId: ctx.userId,
      },
    })
    await audit({
      ctx,
      action: "lead.created",
      entityType: "lead",
      entityId: lead.id,
      after: { name: `${firstName} ${lastName}`, email, source, score },
    })
    revalidatePath(`/w/${slug}/crm/leads`)
    return lead
  })
}

export async function updateLeadStatusAction(slug: string, id: string, status: string) {
  return withPermission(slug, "crm.update", async () => {
    const ctx = await resolveWorkspace(slug)
    const lead = await db.lead.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
    if (!lead) throw new Error("Lead not found.")
    const updated = await db.lead.update({
      where: { id },
      data: { status, qualifiedAt: status === "qualified" ? new Date() : lead.qualifiedAt },
    })
    await audit({
      ctx,
      action: "lead.status_changed",
      entityType: "lead",
      entityId: id,
      before: { status: lead.status },
      after: { status },
    })
    revalidatePath(`/w/${slug}/crm/leads`)
    return updated
  })
}

// ---- Deals ----

export async function createDealAction(slug: string, formData: FormData) {
  return withPermission(slug, "crm.create", async () => {
    const name = String(formData.get("name") ?? "").trim()
    const amount = Number(formData.get("amount") ?? 0)
    const stageId = String(formData.get("stageId") ?? "").trim() || null
    const companyId = String(formData.get("companyId") ?? "").trim() || null
    const primaryContactId = String(formData.get("primaryContactId") ?? "").trim() || null
    const expectedCloseDateStr = String(formData.get("expectedCloseDate") ?? "").trim()
    if (!name) throw new Error("Deal name is required.")
    const ctx = await resolveWorkspace(slug)
    const pipeline = await db.pipeline.findFirstOrThrow({
      where: { workspaceId: ctx.workspaceId, isDefault: true },
    })
    const stage = stageId
      ? await db.pipelineStage.findFirst({ where: { id: stageId, pipelineId: pipeline.id } })
      : await db.pipelineStage.findFirst({ where: { pipelineId: pipeline.id, position: 0 } })
    const deal = await db.deal.create({
      data: {
        workspaceId: ctx.workspaceId,
        name,
        amountMinor: BigInt(Math.round(amount * 100)),
        currency: "USD",
        probability: stage?.probability ?? 0,
        pipelineId: pipeline.id,
        stageId: stage?.id ?? null,
        companyId,
        primaryContactId,
        ownerId: ctx.userId,
        expectedCloseDate: expectedCloseDateStr ? new Date(expectedCloseDateStr) : null,
      },
    })
    await audit({
      ctx,
      action: "deal.created",
      entityType: "deal",
      entityId: deal.id,
      after: { name, amount },
    })
    revalidatePath(`/w/${slug}/crm/deals`)
    return deal
  })
}

export async function moveDealAction(slug: string, dealId: string, stageId: string) {
  return withPermission(slug, "crm.update", async () => {
    const ctx = await resolveWorkspace(slug)
    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId: ctx.workspaceId },
      include: { stage: true },
    })
    if (!deal) throw new Error("Deal not found.")
    const stage = await db.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { workspaceId: ctx.workspaceId } },
    })
    if (!stage) throw new Error("Invalid stage.")
    const updated = await db.deal.update({
      where: { id: dealId },
      data: {
        stageId: stage.id,
        probability: stage.probability,
        wonAt: stage.isWon ? new Date() : null,
        lostAt: stage.isClosed && !stage.isWon ? new Date() : null,
      },
    })
    await audit({
      ctx,
      action: "deal.stage_changed",
      entityType: "deal",
      entityId: dealId,
      before: { stage: deal.stage?.name },
      after: { stage: stage.name },
    })
    revalidatePath(`/w/${slug}/crm/deals`)
    return updated
  })
}

// ---- Activities ----

export async function createActivityAction(slug: string, formData: FormData) {
  return withPermission(slug, "crm.create", async () => {
    const activityType = String(formData.get("activityType") ?? "note")
    const subject = String(formData.get("subject") ?? "").trim()
    const body = String(formData.get("body") ?? "").trim()
    const entityType = String(formData.get("entityType") ?? "contact")
    const entityId = String(formData.get("entityId") ?? "").trim()
    const dueAtStr = String(formData.get("dueAt") ?? "").trim()
    if (!entityId) throw new Error("Entity is required.")
    const ctx = await resolveWorkspace(slug)
    const activity = await db.activity.create({
      data: {
        workspaceId: ctx.workspaceId,
        activityType,
        subject: subject || null,
        body: body || null,
        entityType,
        entityId,
        ownerId: ctx.userId,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
      },
    })
    await audit({
      ctx,
      action: "activity.created",
      entityType: "activity",
      entityId: activity.id,
      after: { activityType, subject, entityType, entityId },
    })
    revalidatePath(`/w/${slug}/crm/activities`)
    return activity
  })
}

export async function completeActivityAction(slug: string, id: string) {
  return withPermission(slug, "crm.update", async () => {
    const ctx = await resolveWorkspace(slug)
    const activity = await db.activity.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
    if (!activity) throw new Error("Activity not found.")
    const updated = await db.activity.update({ where: { id }, data: { completedAt: new Date() } })
    await audit({ ctx, action: "activity.completed", entityType: "activity", entityId: id })
    revalidatePath(`/w/${slug}/crm/activities`)
    return updated
  })
}

// ---- Notes ----

export async function createNoteAction(slug: string, formData: FormData) {
  return withPermission(slug, "comments.create", async () => {
    const bodyRich = String(formData.get("bodyRich") ?? "").trim()
    const entityType = String(formData.get("entityType") ?? "contact")
    const entityId = String(formData.get("entityId") ?? "").trim()
    const visibility = String(formData.get("visibility") ?? "internal")
    if (!bodyRich || !entityId) throw new Error("Note body and entity are required.")
    const ctx = await resolveWorkspace(slug)
    const note = await db.note.create({
      data: {
        workspaceId: ctx.workspaceId,
        bodyRich,
        entityType,
        entityId,
        visibility,
        authorId: ctx.userId,
      },
    })
    await audit({
      ctx,
      action: "note.created",
      entityType: "note",
      entityId: note.id,
      after: { entityType, entityId, visibility },
    })
    revalidatePath(`/w/${slug}/crm/contacts`)
    revalidatePath(`/w/${slug}/clients`)
    revalidatePath(`/w/${slug}/projects`)
    return note
  })
}

// ---- Clients ----

export async function createClientAction(slug: string, formData: FormData) {
  return withPermission(slug, "clients.create", async () => {
    const name = String(formData.get("name") ?? "").trim()
    const code = String(formData.get("code") ?? "").trim()
    const status = String(formData.get("status") ?? "prospect")
    const companyId = String(formData.get("companyId") ?? "").trim() || null
    if (!name) throw new Error("Client name is required.")
    const ctx = await resolveWorkspace(slug)
    const client = await db.client.create({
      data: {
        workspaceId: ctx.workspaceId,
        name,
        code: code || null,
        status,
        companyId,
        ownerId: ctx.userId,
        onboardingStatus: status === "active" ? "in_progress" : "pending",
      },
    })
    await audit({
      ctx,
      action: "client.created",
      entityType: "client",
      entityId: client.id,
      after: { name, code, status },
    })
    revalidatePath(`/w/${slug}/clients`)
    return client
  })
}

// ---- Projects ----

export async function createProjectAction(slug: string, formData: FormData) {
  return withPermission(slug, "projects.create", async () => {
    const name = String(formData.get("name") ?? "").trim()
    const code = String(formData.get("code") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()
    const clientId = String(formData.get("clientId") ?? "").trim() || null
    const budget = Number(formData.get("budget") ?? 0)
    const dueDateStr = String(formData.get("dueDate") ?? "").trim()
    if (!name) throw new Error("Project name is required.")
    const ctx = await resolveWorkspace(slug)
    const status = await db.projectStatus.findFirst({
      where: { workspaceId: ctx.workspaceId, category: "planning" },
    })
    const project = await db.project.create({
      data: {
        workspaceId: ctx.workspaceId,
        name,
        code: code || null,
        description: description || null,
        clientId,
        ownerId: ctx.userId,
        statusId: status?.id ?? null,
        budgetMinor: BigInt(Math.round(budget * 100)),
        currency: "USD",
        dueDate: dueDateStr ? new Date(dueDateStr) : null,
        visibility: "internal",
      },
    })
    await audit({
      ctx,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      after: { name, code, clientId },
    })
    revalidatePath(`/w/${slug}/projects`)
    return project
  })
}

// ---- Tasks ----

export async function createTaskAction(slug: string, formData: FormData) {
  return withPermission(slug, "tasks.create", async () => {
    const name = String(formData.get("name") ?? "").trim()
    const projectId = String(formData.get("projectId") ?? "").trim() || null
    const assigneeId = String(formData.get("assigneeId") ?? "").trim() || null
    const statusId = String(formData.get("statusId") ?? "").trim() || null
    const priority = String(formData.get("priority") ?? "normal")
    const estimateMinutes = Number(formData.get("estimateMinutes") ?? 0)
    const dueAtStr = String(formData.get("dueAt") ?? "").trim()
    if (!name) throw new Error("Task name is required.")
    const ctx = await resolveWorkspace(slug)
    const taskStatus = statusId
      ? await db.taskStatus.findFirst({ where: { id: statusId, workspaceId: ctx.workspaceId } })
      : await db.taskStatus.findFirst({ where: { workspaceId: ctx.workspaceId, category: "todo" } })
    const task = await db.task.create({
      data: {
        workspaceId: ctx.workspaceId,
        name,
        projectId,
        assigneeId,
        ownerId: ctx.userId,
        statusId: taskStatus?.id ?? null,
        priority,
        estimateMinutes: Number.isFinite(estimateMinutes) ? Math.max(0, estimateMinutes) : 0,
        dueAt: dueAtStr ? new Date(dueAtStr) : null,
        visibility: "internal",
      },
    })
    await audit({
      ctx,
      action: "task.created",
      entityType: "task",
      entityId: task.id,
      after: { name, projectId, assigneeId },
    })
    revalidatePath(`/w/${slug}/tasks`)
    revalidatePath(`/w/${slug}/projects`)
    return task
  })
}

export async function updateTaskStatusAction(slug: string, taskId: string, statusId: string) {
  return withPermission(slug, "tasks.update", async () => {
    const ctx = await resolveWorkspace(slug)
    const task = await db.task.findFirst({
      where: { id: taskId, workspaceId: ctx.workspaceId },
      include: { status: true },
    })
    if (!task) throw new Error("Task not found.")
    const status = await db.taskStatus.findFirst({
      where: { id: statusId, workspaceId: ctx.workspaceId },
    })
    if (!status) throw new Error("Invalid status.")
    const updated = await db.task.update({ where: { id: taskId }, data: { statusId: status.id } })
    await audit({
      ctx,
      action: "task.status_changed",
      entityType: "task",
      entityId: taskId,
      before: { status: task.status?.name },
      after: { status: status.name },
    })
    revalidatePath(`/w/${slug}/tasks`)
    revalidatePath(`/w/${slug}/projects/${task.projectId}`)
    revalidatePath(`/w/${slug}/my-work`)
    return updated
  })
}

export async function assignTaskAction(slug: string, taskId: string, assigneeId: string | null) {
  return withPermission(slug, "tasks.assign", async () => {
    const ctx = await resolveWorkspace(slug)
    const task = await db.task.findFirst({ where: { id: taskId, workspaceId: ctx.workspaceId } })
    if (!task) throw new Error("Task not found.")
    const updated = await db.task.update({ where: { id: taskId }, data: { assigneeId } })
    await audit({
      ctx,
      action: "task.assigned",
      entityType: "task",
      entityId: taskId,
      after: { assigneeId },
    })
    revalidatePath(`/w/${slug}/tasks`)
    revalidatePath(`/w/${slug}/my-work`)
    return updated
  })
}

// ---- Approvals ----

export async function decideApprovalAction(
  slug: string,
  approvalId: string,
  decision: "approved" | "changes_requested",
  note: string
) {
  return withPermission(slug, "approvals.decide", async () => {
    const ctx = await resolveWorkspace(slug)
    const approval = await db.approvalRequest.findFirst({
      where: { id: approvalId, workspaceId: ctx.workspaceId },
      include: { steps: true },
    })
    if (!approval) throw new Error("Approval not found.")
    if (approval.status !== "pending") throw new Error("Approval is no longer pending.")

    // Update first pending step
    const step = approval.steps.find((s) => s.status === "pending")
    if (!step) throw new Error("No pending step found.")

    await db.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          status: decision,
          decidedAt: new Date(),
          decisionNote: note || null,
          decidedByUserId: ctx.userId,
        },
      })
      await tx.approvalEvent.create({
        data: {
          approvalRequestId: approval.id,
          actorUserId: ctx.userId,
          action: decision,
          note: note || null,
        },
      })
      // If there's another pending step after this one, leave the overall status pending.
      const remainingSteps = approval.steps.filter(
        (s) => s.id !== step.id && s.status === "pending"
      )
      if (remainingSteps.length === 0) {
        await tx.approvalRequest.update({
          where: { id: approval.id },
          data: { status: decision, decidedAt: new Date() },
        })
      }
    })

    await audit({
      ctx,
      action: `approval.${decision}`,
      entityType: "approval",
      entityId: approvalId,
      after: { note },
    })
    revalidatePath(`/w/${slug}/approvals`)
    revalidatePath(`/w/${slug}/approvals/${approvalId}`)
    return true
  })
}

// ---- Time ----

export async function createTimeEntryAction(slug: string, formData: FormData) {
  return withPermission(slug, "time.manage_own", async () => {
    const minutes = Number(formData.get("minutes") ?? 0)
    const description = String(formData.get("description") ?? "").trim()
    const projectId = String(formData.get("projectId") ?? "").trim() || null
    const taskId = String(formData.get("taskId") ?? "").trim() || null
    const billable = formData.get("billable") === "on"
    const rateMinorStr = String(formData.get("rateMinor") ?? "0")
    const startedAtStr = String(formData.get("startedAt") ?? "").trim()
    if (minutes <= 0) throw new Error("Minutes must be greater than zero.")
    const ctx = await resolveWorkspace(slug)
    const project = projectId
      ? await db.project.findFirst({
          where: { id: projectId, workspaceId: ctx.workspaceId },
          include: { client: true },
        })
      : null
    const rateMinor = BigInt(rateMinorStr || "0")
    const startedAt = startedAtStr ? new Date(startedAtStr) : new Date()
    const entry = await db.timeEntry.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        projectId,
        taskId,
        clientId: project?.clientId ?? null,
        startedAt,
        endedAt: new Date(startedAt.getTime() + minutes * 60 * 1000),
        minutes,
        description: description || null,
        billable,
        rateMinor,
        currency: "USD",
        status: "open",
      },
    })
    await audit({
      ctx,
      action: "time_entry.created",
      entityType: "time_entry",
      entityId: entry.id,
      after: { minutes, projectId, billable },
    })
    revalidatePath(`/w/${slug}/time`)
    return entry
  })
}

export async function submitTimeEntriesAction(slug: string, ids: string[]) {
  return withPermission(slug, "time.manage_own", async () => {
    const ctx = await resolveWorkspace(slug)
    await db.timeEntry.updateMany({
      where: { id: { in: ids }, workspaceId: ctx.workspaceId, userId: ctx.userId, status: "open" },
      data: { status: "submitted" },
    })
    revalidatePath(`/w/${slug}/time`)
    return true
  })
}

// ---- Notifications ----

export async function markNotificationReadAction(slug: string, id: string) {
  const ctx = await resolveWorkspace(slug)
  await db.notification.updateMany({
    where: { id, workspaceId: ctx.workspaceId, userId: ctx.userId },
    data: { readAt: new Date() },
  })
  revalidatePath(`/w/${slug}/notifications`)
  return true
}

export async function markAllNotificationsReadAction(slug: string) {
  const ctx = await resolveWorkspace(slug)
  await db.notification.updateMany({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  })
  revalidatePath(`/w/${slug}/notifications`)
  return true
}

// ---- Invitations ----

export async function inviteMemberAction(slug: string, formData: FormData) {
  return withPermission(slug, "members.invite", async () => {
    const email = normalizeEmail(String(formData.get("email") ?? ""))
    const roleName = String(formData.get("role") ?? "Team Member")
    if (!email) throw new Error("Email is required.")
    const ctx = await resolveWorkspace(slug)
    const role = await db.role.findUnique({
      where: { workspaceId_name: { workspaceId: ctx.workspaceId, name: roleName } },
    })
    if (!role) throw new Error("Invalid role.")

    const token = crypto.randomUUID()
    const tokenHash = createHash("sha256").update(token).digest("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const invitation = await db.invitation.create({
      data: {
        workspaceId: ctx.workspaceId,
        emailNormalized: email,
        tokenHash,
        expiresAt,
        invitedById: ctx.userId,
      },
    })
    await db.invitationRole.create({ data: { invitationId: invitation.id, roleId: role.id } })
    await audit({
      ctx,
      action: "invitation.created",
      entityType: "invitation",
      entityId: invitation.id,
      after: { email, role: roleName },
    })
    revalidatePath(`/w/${slug}/settings/members`)
    // Local mode: capture token for display. In production this would be emailed.
    return { ok: true as const, data: { invitation, token, email } }
  })
}

export async function revokeInvitationAction(slug: string, id: string) {
  return withPermission(slug, "members.invite", async () => {
    const ctx = await resolveWorkspace(slug)
    await db.invitation.updateMany({
      where: { id, workspaceId: ctx.workspaceId, acceptedAt: null },
      data: { revokedAt: new Date() },
    })
    await audit({ ctx, action: "invitation.revoked", entityType: "invitation", entityId: id })
    revalidatePath(`/w/${slug}/settings/members`)
    return true
  })
}

export async function removeMemberAction(slug: string, membershipId: string) {
  return withPermission(slug, "members.remove", async () => {
    const ctx = await resolveWorkspace(slug)
    const m = await db.workspaceMembership.findFirst({
      where: { id: membershipId, workspaceId: ctx.workspaceId },
      include: { roles: { include: { role: true } } },
    })
    if (!m) throw new Error("Member not found.")
    const isOwner = m.roles.some((r) => r.role.name === "Owner")
    if (isOwner) throw new Error("Owner cannot be removed. Transfer ownership first.")
    await db.workspaceMembership.update({
      where: { id: membershipId },
      data: { status: "removed" },
    })
    await audit({ ctx, action: "member.removed", entityType: "membership", entityId: membershipId })
    revalidatePath(`/w/${slug}/settings/members`)
    return true
  })
}
