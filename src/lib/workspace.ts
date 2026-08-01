import { db } from "@/lib/db"
import { ROLE_PERMISSIONS, isSystemRole } from "@/lib/permissions"

const ALL_PERMISSIONS = ROLE_PERMISSIONS.Owner

async function ensurePermissions() {
  const existing = await db.permission.findMany()
  const existingKeys = new Set(existing.map((p) => p.key))
  const missing = ALL_PERMISSIONS.filter((p) => !existingKeys.has(p))
  if (missing.length > 0) {
    await db.permission.createMany({
      data: missing.map((key) => ({
        key,
        description: key,
      })),
    })
  }
}

async function ensureSystemRoles(workspaceId: string) {
  const permissionRecords = await db.permission.findMany()
  const permMap = new Map(permissionRecords.map((p) => [p.key, p.id]))

  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    let role = await db.role.findUnique({
      where: { workspaceId_name: { workspaceId, name: roleName } },
    })
    if (!role) {
      role = await db.role.create({
        data: {
          workspaceId,
          name: roleName,
          description: `System role: ${roleName}`,
          isSystem: true,
        },
      })
    }
    // Ensure all permission links exist
    for (const permKey of perms) {
      const permId = permMap.get(permKey)
      if (!permId) continue
      const exists = await db.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
      })
      if (!exists) {
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: permId },
        })
      }
    }
  }
}

async function ensureDefaultPipeline(workspaceId: string) {
  let pipeline = await db.pipeline.findFirst({ where: { workspaceId, isDefault: true } })
  if (!pipeline) {
    pipeline = await db.pipeline.create({
      data: {
        workspaceId,
        name: "Sales Pipeline",
        entityType: "deal",
        isDefault: true,
      },
    })
    const stages = [
      { name: "Lead", position: 0, probability: 10, color: "#94a3b8" },
      { name: "Qualified", position: 1, probability: 25, color: "#3b82f6" },
      { name: "Proposal", position: 2, probability: 50, color: "#8b5cf6" },
      { name: "Negotiation", position: 3, probability: 75, color: "#f59e0b" },
      { name: "Won", position: 4, probability: 100, color: "#10b981", isClosed: true, isWon: true },
      { name: "Lost", position: 5, probability: 0, color: "#ef4444", isClosed: true },
    ]
    for (const s of stages) {
      await db.pipelineStage.create({
        data: { pipelineId: pipeline.id, ...s },
      })
    }
  }
  return pipeline
}

async function ensureDefaultStatuses(workspaceId: string) {
  const projectStatuses = [
    { name: "Planning", position: 0, color: "#64748b", category: "planning" },
    { name: "In Progress", position: 1, color: "#3b82f6", category: "active" },
    { name: "On Hold", position: 2, color: "#f59e0b", category: "on_hold" },
    { name: "Completed", position: 3, color: "#10b981", category: "done" },
    { name: "Cancelled", position: 4, color: "#ef4444", category: "cancelled" },
  ]
  for (const ps of projectStatuses) {
    const exists = await db.projectStatus.findUnique({
      where: { workspaceId_name: { workspaceId, name: ps.name } },
    })
    if (!exists) {
      await db.projectStatus.create({ data: { workspaceId, ...ps } })
    }
  }

  const taskStatuses = [
    { name: "Backlog", position: 0, color: "#64748b", category: "todo" },
    { name: "To Do", position: 1, color: "#94a3b8", category: "todo" },
    { name: "In Progress", position: 2, color: "#3b82f6", category: "in_progress" },
    { name: "In Review", position: 3, color: "#8b5cf6", category: "in_progress" },
    { name: "Done", position: 4, color: "#10b981", category: "done" },
    { name: "Blocked", position: 5, color: "#ef4444", category: "blocked" },
  ]
  for (const ts of taskStatuses) {
    const exists = await db.taskStatus.findUnique({
      where: { workspaceId_name: { workspaceId, name: ts.name } },
    })
    if (!exists) {
      await db.taskStatus.create({ data: { workspaceId, ...ts } })
    }
  }
}

export interface WorkspaceBootstrapResult {
  workspaceId: string
  membershipId: string
}

export async function bootstrapWorkspace(opts: {
  name: string
  slug: string
  ownerId: string
  currency?: string
  timezone?: string
}): Promise<WorkspaceBootstrapResult> {
  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: opts.name,
        slug: opts.slug,
        ownerId: opts.ownerId,
        currency: opts.currency ?? "USD",
        timezone: opts.timezone ?? "UTC",
        settingsJson: { density: "comfortable", theme: "system" },
      },
    })

    const membership = await tx.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: opts.ownerId,
        status: "active",
        title: "Owner",
      },
    })

    // Create system roles for this workspace (within the same tx)
    const permissionRecords = await tx.permission.findMany()
    const permMap = new Map(permissionRecords.map((p) => [p.key, p.id]))

    for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await tx.role.create({
        data: {
          workspaceId: workspace.id,
          name: roleName,
          description: `System role: ${roleName}`,
          isSystem: true,
        },
      })
      for (const permKey of perms) {
        const permId = permMap.get(permKey)
        if (!permId) continue
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: permId },
        })
      }
    }

    // Assign Owner role to the owner's membership
    const ownerRole = await tx.role.findUnique({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Owner" } },
    })
    if (ownerRole) {
      await tx.membershipRole.create({
        data: { membershipId: membership.id, roleId: ownerRole.id },
      })
    }

    // Default pipeline
    const pipeline = await tx.pipeline.create({
      data: {
        workspaceId: workspace.id,
        name: "Sales Pipeline",
        entityType: "deal",
        isDefault: true,
      },
    })
    const stages = [
      { name: "Lead", position: 0, probability: 10, color: "#94a3b8" },
      { name: "Qualified", position: 1, probability: 25, color: "#3b82f6" },
      { name: "Proposal", position: 2, probability: 50, color: "#8b5cf6" },
      { name: "Negotiation", position: 3, probability: 75, color: "#f59e0b" },
      { name: "Won", position: 4, probability: 100, color: "#10b981", isClosed: true, isWon: true },
      { name: "Lost", position: 5, probability: 0, color: "#ef4444", isClosed: true },
    ]
    for (const s of stages) {
      await tx.pipelineStage.create({ data: { pipelineId: pipeline.id, ...s } })
    }

    // Default statuses
    const projectStatuses = [
      { name: "Planning", position: 0, color: "#64748b", category: "planning" },
      { name: "In Progress", position: 1, color: "#3b82f6", category: "active" },
      { name: "On Hold", position: 2, color: "#f59e0b", category: "on_hold" },
      { name: "Completed", position: 3, color: "#10b981", category: "done" },
      { name: "Cancelled", position: 4, color: "#ef4444", category: "cancelled" },
    ]
    for (const ps of projectStatuses) {
      await tx.projectStatus.create({ data: { workspaceId: workspace.id, ...ps } })
    }
    const taskStatuses = [
      { name: "Backlog", position: 0, color: "#64748b", category: "todo" },
      { name: "To Do", position: 1, color: "#94a3b8", category: "todo" },
      { name: "In Progress", position: 2, color: "#3b82f6", category: "in_progress" },
      { name: "In Review", position: 3, color: "#8b5cf6", category: "in_progress" },
      { name: "Done", position: 4, color: "#10b981", category: "done" },
      { name: "Blocked", position: 5, color: "#ef4444", category: "blocked" },
    ]
    for (const ts of taskStatuses) {
      await tx.taskStatus.create({ data: { workspaceId: workspace.id, ...ts } })
    }

    // Default services
    const services = [
      { name: "Strategy Consulting", defaultRateMinor: BigInt(25000), billingUnit: "hour" },
      { name: "Creative Production", defaultRateMinor: BigInt(18000), billingUnit: "hour" },
      { name: "Campaign Management", defaultRateMinor: BigInt(15000), billingUnit: "hour" },
      { name: "SEO", defaultRateMinor: BigInt(12000), billingUnit: "hour" },
      { name: "Paid Media", defaultRateMinor: BigInt(14000), billingUnit: "hour" },
    ]
    for (const s of services) {
      await tx.service.create({ data: { workspaceId: workspace.id, ...s } })
    }

    // Default feature flags
    const flags = [
      { key: "crm", enabled: true },
      { key: "projects", enabled: true },
      { key: "approvals", enabled: true },
      { key: "time_tracking", enabled: true },
      { key: "finance", enabled: true },
      { key: "portal", enabled: true },
      { key: "automations", enabled: false },
      { key: "ai_assistant", enabled: false },
    ]
    for (const f of flags) {
      await tx.featureFlag.create({ data: { workspaceId: workspace.id, ...f } })
    }

    return { workspaceId: workspace.id, membershipId: membership.id }
  })
}

export async function ensureSeedPermissions() {
  return ensurePermissions()
}

export { isSystemRole }
