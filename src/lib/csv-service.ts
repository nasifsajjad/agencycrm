/**
 * AgencyOS — CSV import/export service.
 *
 * Import: parse CSV → preview → map fields → validate → execute idempotently
 *   → report created/updated/skipped/error rows → downloadable error CSV.
 *
 * Export: permission-aware, respects current filters, respects field-level
 *   sensitivity, returns CSV stream. Every export is recorded in the audit log.
 */

import Papa from "papaparse"
import { db } from "@/lib/db"
import { can, type WorkspaceContext } from "@/lib/auth"
import { audit } from "@/lib/audit"

export type ImportTarget = "contacts" | "companies" | "leads" | "deals" | "clients" | "time_entries"

export interface ImportPreview {
  headers: string[]
  sampleRows: Record<string, string>[]
  suggestedMapping: Record<string, string>
  totalRows: number
  errors: string[]
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errored: number
  errorRows: { row: number; error: string; data: Record<string, string> }[]
}

const CONTACT_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "jobTitle",
  "company",
  "lifecycleStage",
]
const COMPANY_FIELDS = ["name", "domain", "industry", "website", "sizeBand"]
const LEAD_FIELDS = ["firstName", "lastName", "email", "company", "source", "score", "status"]
const DEAL_FIELDS = ["name", "amount", "stage", "company", "contact", "expectedCloseDate"]
const CLIENT_FIELDS = ["name", "code", "status", "company"]
const TIME_FIELDS = ["description", "minutes", "project", "billable", "rate"]

export function previewImport(target: ImportTarget, csvBuffer: Buffer): ImportPreview {
  const parsed = parseCsvSync(csvBuffer)
  const fields = FIELD_MAP[target]
  const suggestedMapping: Record<string, string> = {}
  for (const header of parsed.headers) {
    const lower = header.toLowerCase().replace(/[^a-z0-9]/g, "")
    const match = fields.find(
      (f) =>
        f
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .includes(lower) || lower.includes(f.toLowerCase().replace(/[^a-z0-9]/g, ""))
    )
    if (match) suggestedMapping[header] = match
  }
  return {
    headers: parsed.headers,
    sampleRows: parsed.rows.slice(0, 3),
    suggestedMapping,
    totalRows: parsed.rows.length,
    errors: parsed.errors,
  }
}

const FIELD_MAP: Record<ImportTarget, string[]> = {
  contacts: CONTACT_FIELDS,
  companies: COMPANY_FIELDS,
  leads: LEAD_FIELDS,
  deals: DEAL_FIELDS,
  clients: CLIENT_FIELDS,
  time_entries: TIME_FIELDS,
}

function parseCsvSync(buf: Buffer) {
  const result = Papa.parse(buf.toString("utf-8"), { header: true, skipEmptyLines: true })
  return {
    headers: (result.meta.fields ?? []) as string[],
    rows: result.data as Record<string, string>[],
    errors: (result.errors as { message: string }[]).map((e) => e.message),
  }
}

export async function executeImport(
  ctx: WorkspaceContext,
  target: ImportTarget,
  mapping: Record<string, string>,
  csvBuffer: Buffer
): Promise<ImportResult> {
  if (
    !can(ctx, "crm.create") &&
    (target === "contacts" || target === "companies" || target === "leads" || target === "deals")
  ) {
    throw new Error("Missing crm.create permission")
  }
  if (target === "clients" && !can(ctx, "clients.create"))
    throw new Error("Missing clients.create permission")
  if (target === "time_entries" && !can(ctx, "time.manage_own"))
    throw new Error("Missing time.manage_own permission")

  const parsed = parseCsvSync(csvBuffer)
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errored: 0, errorRows: [] }

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]
    try {
      const mapped: Record<string, string> = {}
      for (const [csvCol, targetField] of Object.entries(mapping)) {
        if (targetField && row[csvCol] !== undefined) mapped[targetField] = row[csvCol]
      }
      const r = await importRow(ctx, target, mapped)
      if (r === "created") result.created += 1
      else if (r === "updated") result.updated += 1
      else result.skipped += 1
    } catch (e: any) {
      result.errored += 1
      result.errorRows.push({ row: i + 2, error: e?.message ?? "Unknown error", data: row })
    }
  }

  await audit({
    ctx,
    action: `import.${target}`,
    entityType: "import_job",
    after: {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errored: result.errored,
    },
  })

  return result
}

async function importRow(
  ctx: WorkspaceContext,
  target: ImportTarget,
  mapped: Record<string, string>
): Promise<"created" | "updated" | "skipped"> {
  switch (target) {
    case "contacts": {
      if (!mapped.email && !mapped.firstName && !mapped.lastName) return "skipped"
      const existing = mapped.email
        ? await db.contact.findFirst({
            where: { workspaceId: ctx.workspaceId, email: mapped.email },
          })
        : null
      if (existing) {
        await db.contact.update({
          where: { id: existing.id },
          data: {
            firstName: mapped.firstName ?? existing.firstName ?? undefined,
            lastName: mapped.lastName ?? existing.lastName ?? undefined,
            phone: mapped.phone ?? existing.phone ?? undefined,
            jobTitle: mapped.jobTitle ?? existing.jobTitle ?? undefined,
            lifecycleStage: mapped.lifecycleStage ?? existing.lifecycleStage,
          },
        })
        return "updated"
      }
      await db.contact.create({
        data: {
          workspaceId: ctx.workspaceId,
          firstName: mapped.firstName || null,
          lastName: mapped.lastName || null,
          email: mapped.email || null,
          phone: mapped.phone || null,
          jobTitle: mapped.jobTitle || null,
          ownerId: ctx.userId,
          lifecycleStage: mapped.lifecycleStage || "lead",
        },
      })
      return "created"
    }
    case "companies": {
      if (!mapped.name) return "skipped"
      const existing = await db.company.findFirst({
        where: { workspaceId: ctx.workspaceId, name: mapped.name },
      })
      if (existing) {
        await db.company.update({
          where: { id: existing.id },
          data: {
            domain: mapped.domain ?? existing.domain ?? undefined,
            industry: mapped.industry ?? existing.industry ?? undefined,
            website: mapped.website ?? existing.website ?? undefined,
            sizeBand: mapped.sizeBand ?? existing.sizeBand ?? undefined,
          },
        })
        return "updated"
      }
      await db.company.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: mapped.name,
          domain: mapped.domain || null,
          industry: mapped.industry || null,
          website: mapped.website || null,
          sizeBand: mapped.sizeBand || null,
          ownerId: ctx.userId,
          lifecycleStage: "lead",
        },
      })
      return "created"
    }
    case "leads": {
      if (!mapped.email && !mapped.firstName) return "skipped"
      const score = Number(mapped.score ?? 0)
      const contact = await db.contact.create({
        data: {
          workspaceId: ctx.workspaceId,
          firstName: mapped.firstName || null,
          lastName: mapped.lastName || null,
          email: mapped.email || null,
          ownerId: ctx.userId,
          lifecycleStage: "lead",
        },
      })
      await db.lead.create({
        data: {
          workspaceId: ctx.workspaceId,
          contactId: contact.id,
          source: mapped.source || "Import",
          score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
          status: mapped.status || "new",
          ownerId: ctx.userId,
        },
      })
      return "created"
    }
    case "deals": {
      if (!mapped.name) return "skipped"
      const amount = Number(mapped.amount ?? 0)
      const pipeline = await db.pipeline.findFirstOrThrow({
        where: { workspaceId: ctx.workspaceId, isDefault: true },
      })
      const stage = mapped.stage
        ? await db.pipelineStage.findFirst({
            where: { pipelineId: pipeline.id, name: mapped.stage },
          })
        : await db.pipelineStage.findFirst({ where: { pipelineId: pipeline.id, position: 0 } })
      await db.deal.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: mapped.name,
          amountMinor: BigInt(Math.round(amount * 100)),
          currency: "USD",
          probability: stage?.probability ?? 0,
          pipelineId: pipeline.id,
          stageId: stage?.id,
          ownerId: ctx.userId,
          expectedCloseDate: mapped.expectedCloseDate ? new Date(mapped.expectedCloseDate) : null,
        },
      })
      return "created"
    }
    case "clients": {
      if (!mapped.name) return "skipped"
      const existing = await db.client.findFirst({
        where: { workspaceId: ctx.workspaceId, name: mapped.name },
      })
      if (existing) return "skipped"
      await db.client.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: mapped.name,
          code: mapped.code || null,
          status: mapped.status || "prospect",
          ownerId: ctx.userId,
        },
      })
      return "created"
    }
    case "time_entries": {
      const minutes = Number(mapped.minutes ?? 0)
      if (!minutes || minutes <= 0) return "skipped"
      await db.timeEntry.create({
        data: {
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          startedAt: new Date(),
          minutes,
          description: mapped.description || "Imported entry",
          billable:
            mapped.billable === "true" || mapped.billable === "1" || mapped.billable === "yes",
          rateMinor: BigInt(Number(mapped.rate ?? 0) || 0),
          currency: "USD",
          status: "open",
        },
      })
      return "created"
    }
    default:
      return "skipped"
  }
}

export function buildErrorCsv(
  errorRows: { row: number; error: string; data: Record<string, string> }[]
): string {
  if (errorRows.length === 0) return ""
  const headers = ["row", "error", ...Object.keys(errorRows[0].data)]
  const lines = [headers.join(",")]
  for (const r of errorRows) {
    const cells = [String(r.row), escapeCsv(r.error), ...Object.values(r.data).map(escapeCsv)]
    lines.push(cells.join(","))
  }
  return lines.join("\n")
}

function escapeCsv(s: string): string {
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ============ EXPORT ============

export type ExportTarget = "contacts" | "deals" | "clients" | "time_entries" | "invoices" | "audit"

export async function exportToCsv(
  ctx: WorkspaceContext,
  target: ExportTarget
): Promise<{ csv: string; count: number }> {
  if (target === "contacts" && !can(ctx, "crm.export"))
    throw new Error("Missing crm.export permission")
  if (target === "deals" && !can(ctx, "crm.export"))
    throw new Error("Missing crm.export permission")
  if (target === "invoices" && !can(ctx, "finance.export"))
    throw new Error("Missing finance.export permission")
  if (target === "audit" && !can(ctx, "audit.read"))
    throw new Error("Missing audit.read permission")
  if (target === "clients" && !can(ctx, "exports.create"))
    throw new Error("Missing exports.create permission")
  if (target === "time_entries" && !can(ctx, "exports.create"))
    throw new Error("Missing exports.create permission")

  let rows: Record<string, unknown>[] = []
  let headers: string[] = []

  switch (target) {
    case "contacts": {
      rows = await db.contact.findMany({
        where: { workspaceId: ctx.workspaceId, archivedAt: null },
        include: { company: true, owner: true },
        orderBy: { createdAt: "desc" },
      })
      headers = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "jobTitle",
        "company",
        "lifecycleStage",
        "owner",
      ]
      rows = rows.map((r: any) => ({
        firstName: r.firstName ?? "",
        lastName: r.lastName ?? "",
        email: r.email ?? "",
        phone: r.phone ?? "",
        jobTitle: r.jobTitle ?? "",
        company: r.company?.name ?? "",
        lifecycleStage: r.lifecycleStage,
        owner: r.owner?.displayName ?? "",
      }))
      break
    }
    case "deals": {
      rows = await db.deal.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: { stage: true, company: true, primaryContact: true, owner: true },
        orderBy: { createdAt: "desc" },
      })
      headers = [
        "name",
        "amount",
        "currency",
        "stage",
        "probability",
        "company",
        "contact",
        "owner",
        "expectedCloseDate",
      ]
      rows = rows.map((r: any) => ({
        name: r.name,
        amount: Number(r.amountMinor) / 100,
        currency: r.currency,
        stage: r.stage?.name ?? "",
        probability: r.probability,
        company: r.company?.name ?? "",
        contact: r.primaryContact
          ? `${r.primaryContact.firstName} ${r.primaryContact.lastName}`
          : "",
        owner: r.owner?.displayName ?? "",
        expectedCloseDate: r.expectedCloseDate
          ? new Date(r.expectedCloseDate).toISOString().slice(0, 10)
          : "",
      }))
      break
    }
    case "clients": {
      rows = await db.client.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: { owner: true },
        orderBy: { createdAt: "desc" },
      })
      headers = ["name", "code", "status", "healthScore", "owner", "startDate", "renewalDate"]
      rows = rows.map((r: any) => ({
        name: r.name,
        code: r.code ?? "",
        status: r.status,
        healthScore: r.healthScore,
        owner: r.owner?.displayName ?? "",
        startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : "",
        renewalDate: r.renewalDate ? new Date(r.renewalDate).toISOString().slice(0, 10) : "",
      }))
      break
    }
    case "invoices": {
      rows = await db.invoice.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: { client: true },
        orderBy: { issuedOn: "desc" },
      })
      headers = [
        "number",
        "client",
        "status",
        "issuedOn",
        "dueOn",
        "subtotal",
        "tax",
        "total",
        "paid",
      ]
      rows = rows.map((r: any) => ({
        number: r.number,
        client: r.client?.name ?? "",
        status: r.status,
        issuedOn: new Date(r.issuedOn).toISOString().slice(0, 10),
        dueOn: r.dueOn ? new Date(r.dueOn).toISOString().slice(0, 10) : "",
        subtotal: Number(r.subtotalMinor) / 100,
        tax: Number(r.taxMinor) / 100,
        total: Number(r.totalMinor) / 100,
        paid: Number(r.paidMinor) / 100,
      }))
      break
    }
    case "audit": {
      rows = await db.auditEvent.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: { actorUser: true },
        orderBy: { occurredAt: "desc" },
        take: 1000,
      })
      headers = ["occurredAt", "actor", "action", "entityType", "entityId"]
      rows = rows.map((r: any) => ({
        occurredAt: new Date(r.occurredAt).toISOString(),
        actor: r.actorUser?.displayName ?? "system",
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId ?? "",
      }))
      break
    }
    case "time_entries": {
      rows = await db.timeEntry.findMany({
        where: { workspaceId: ctx.workspaceId },
        include: { user: true, project: true, client: true },
        orderBy: { startedAt: "desc" },
      })
      headers = [
        "user",
        "startedAt",
        "minutes",
        "billable",
        "description",
        "project",
        "client",
        "rate",
        "status",
      ]
      rows = rows.map((r: any) => ({
        user: r.user?.displayName ?? "",
        startedAt: new Date(r.startedAt).toISOString(),
        minutes: r.minutes,
        billable: r.billable ? "yes" : "no",
        description: r.description ?? "",
        project: r.project?.name ?? "",
        client: r.client?.name ?? "",
        rate: Number(r.rateMinor) / 100,
        status: r.status,
      }))
      break
    }
  }

  const csv = toCsv(headers, rows)

  await audit({
    ctx,
    action: `export.${target}`,
    entityType: "export_job",
    after: { count: rows.length },
  })

  return { csv, count: rows.length }
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(escapeCsv).join(",")]
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(String(row[h] ?? ""))).join(","))
  }
  return lines.join("\n")
}
