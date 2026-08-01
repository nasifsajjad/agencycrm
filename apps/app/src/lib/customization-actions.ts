"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { can, AuthorizationError } from "@/lib/auth"
import type { Permission } from "@/lib/permissions"
import { resolveWorkspace } from "@/lib/server"
import { audit } from "@/lib/audit"

async function requirePerm(slug: string, perm: Permission) {
  const ctx = await resolveWorkspace(slug)
  if (!can(ctx, perm)) throw new AuthorizationError(`Missing permission: ${perm}`)
  return ctx
}

// ============ Custom fields ============

export async function createCustomFieldAction(slug: string, formData: FormData) {
  const ctx = await requirePerm(slug, "settings.manage")
  const entityType = String(formData.get("entityType") ?? "").trim()
  const key = String(formData.get("key") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
  const label = String(formData.get("label") ?? "").trim()
  const dataType = String(formData.get("dataType") ?? "text")
  const required = formData.get("required") === "on"
  const optionsRaw = String(formData.get("options") ?? "").trim()
  if (!entityType || !key || !label) throw new Error("Entity, key, and label are required")
  if (!/^[a-z][a-z0-9_]{1,38}$/.test(key))
    throw new Error("Key must be 2-40 lowercase letters/digits/underscores, starting with a letter")

  const optionsJson =
    (dataType === "select" || dataType === "multiselect") && optionsRaw
      ? {
          options: optionsRaw
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : undefined

  const def = await db.customFieldDefinition.create({
    data: {
      workspaceId: ctx.workspaceId,
      entityType,
      key,
      label,
      dataType,
      required,
      optionsJson: optionsJson as any,
      position: 0,
      active: true,
    },
  })
  await audit({
    ctx,
    action: "custom_field.created",
    entityType: "custom_field_definition",
    entityId: def.id,
    after: { entityType, key, label, dataType },
  })
  revalidatePath(`/w/${slug}/settings/customization`)
  return def
}

export async function deleteCustomFieldAction(slug: string, id: string) {
  const ctx = await requirePerm(slug, "settings.manage")
  await db.customFieldDefinition.deleteMany({ where: { id, workspaceId: ctx.workspaceId } })
  await audit({
    ctx,
    action: "custom_field.deleted",
    entityType: "custom_field_definition",
    entityId: id,
  })
  revalidatePath(`/w/${slug}/settings/customization`)
  return true
}

export async function setCustomFieldValueAction(
  slug: string,
  definitionId: string,
  entityType: string,
  entityId: string,
  value: unknown
) {
  const ctx = await resolveWorkspace(slug)
  if (!can(ctx, "crm.update") && !can(ctx, "clients.update") && !can(ctx, "projects.update")) {
    throw new AuthorizationError("Missing update permission")
  }
  const def = await db.customFieldDefinition.findFirst({
    where: { id: definitionId, workspaceId: ctx.workspaceId },
  })
  if (!def) throw new Error("Definition not found")
  await db.customFieldValue.upsert({
    where: { definitionId_entityId: { definitionId, entityId } },
    create: {
      definitionId,
      workspaceId: ctx.workspaceId,
      entityType,
      entityId,
      valueJson: value as any,
    },
    update: { valueJson: value as any },
  })
  revalidatePath(`/w/${slug}`)
  return true
}

// ============ Saved views ============

export async function createSavedViewAction(slug: string, formData: FormData) {
  const ctx = await resolveWorkspace(slug)
  const entityType = String(formData.get("entityType") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  const visibility = String(formData.get("visibility") ?? "private") as
    "private" | "workspace" | "client"
  const queryJson = String(formData.get("queryJson") ?? "{}")
  const columnsJson = String(formData.get("columnsJson") ?? "[]")
  const sortJson = String(formData.get("sortJson") ?? "[]")
  if (!entityType || !name) throw new Error("Entity and name are required")
  const view = await db.savedView.create({
    data: {
      workspaceId: ctx.workspaceId,
      entityType,
      name,
      ownerId: ctx.userId,
      visibility,
      queryJson: JSON.parse(queryJson),
      columnsJson: JSON.parse(columnsJson),
      sortJson: JSON.parse(sortJson),
    },
  })
  await audit({
    ctx,
    action: "saved_view.created",
    entityType: "saved_view",
    entityId: view.id,
    after: { entityType, name, visibility },
  })
  revalidatePath(`/w/${slug}`)
  return view
}

export async function deleteSavedViewAction(slug: string, id: string) {
  const ctx = await resolveWorkspace(slug)
  await db.savedView.deleteMany({
    where: { id, workspaceId: ctx.workspaceId, ownerId: ctx.userId },
  })
  revalidatePath(`/w/${slug}`)
  return true
}

// ============ Dashboard widgets ============

export async function createDashboardWidgetAction(
  slug: string,
  dashboardId: string,
  formData: FormData
) {
  const ctx = await resolveWorkspace(slug)
  const widgetType = String(formData.get("widgetType") ?? "").trim()
  if (!widgetType) throw new Error("Widget type required")
  const dashboard = await db.dashboard.findFirst({
    where: { id: dashboardId, workspaceId: ctx.workspaceId },
  })
  if (!dashboard) throw new Error("Dashboard not found")
  const widget = await db.dashboardWidget.create({
    data: {
      dashboardId,
      widgetType,
      queryJson: JSON.parse(String(formData.get("queryJson") ?? "{}")),
      displayJson: JSON.parse(String(formData.get("displayJson") ?? "{}")),
      positionJson: { x: 0, y: 99, w: 6, h: 1 },
    },
  })
  await audit({
    ctx,
    action: "dashboard_widget.created",
    entityType: "dashboard_widget",
    entityId: widget.id,
    after: { widgetType, dashboardId },
  })
  revalidatePath(`/w/${slug}`)
  return widget
}

export async function deleteDashboardWidgetAction(slug: string, id: string) {
  const ctx = await resolveWorkspace(slug)
  await db.dashboardWidget.deleteMany({ where: { id } })
  revalidatePath(`/w/${slug}`)
  return true
}
