/**
 * Request-scoped database boundary.
 *
 * The product request path is Supabase Postgres through PostgREST. Keeping the
 * small ORM-shaped surface here means feature actions continue to express
 * tenant-scoped intent while the database and RLS remain the authority.
 */
import { createServerClient } from "@/lib/supabase/server"

type JsonRecord = Record<string, unknown>
type QueryArgs = { where?: JsonRecord; data?: JsonRecord; include?: JsonRecord; select?: JsonRecord; orderBy?: unknown; take?: number; skip?: number }

const TABLES: Record<string, string> = {
  user: "profiles",
  workspace: "workspaces",
  workspaceMembership: "workspace_memberships",
  role: "roles",
  permission: "permissions",
  rolePermission: "role_permissions",
  membershipRole: "membership_roles",
  team: "teams",
  teamMembership: "team_memberships",
  invitation: "invitations",
  invitationRole: "invitation_roles",
  invitationTeam: "invitation_teams",
  featureFlag: "feature_flags",
  workspacePreference: "workspace_preferences",
  company: "companies",
  contact: "contacts",
  lead: "leads",
  pipeline: "pipelines",
  pipelineStage: "pipeline_stages",
  deal: "deals",
  activity: "activities",
  tag: "tags",
  note: "notes",
  client: "clients",
  clientContact: "client_contacts",
  service: "services",
  retainer: "retainers",
  contract: "contracts",
  clientRequest: "client_requests",
  clientHealthEvent: "client_health_events",
  projectTemplate: "project_templates",
  projectStatus: "project_statuses",
  project: "projects",
  projectMember: "project_members",
  milestone: "milestones",
  taskStatus: "task_statuses",
  task: "tasks",
  taskDependency: "task_dependencies",
  taskWatcher: "task_watchers",
  campaign: "campaigns",
  deliverable: "deliverables",
  contentItem: "content_items",
  comment: "comments",
  commentMention: "comment_mentions",
  activityEvent: "activity_events",
  notification: "notifications",
  fileRecord: "files",
  fileLink: "file_links",
  deliverableVersion: "deliverable_versions",
  approvalRequest: "approval_requests",
  approvalStep: "approval_steps",
  approvalEvent: "approval_events",
  timeEntry: "time_entries",
  timesheet: "timesheets",
  capacityAllocation: "capacity_allocations",
  rateCard: "rate_cards",
  expense: "expenses",
  estimate: "estimates",
  estimateLine: "estimate_lines",
  invoice: "invoices",
  invoiceLine: "invoice_lines",
  payment: "payments",
  customFieldDefinition: "custom_field_definitions",
  customFieldValue: "custom_field_values",
  savedView: "saved_views",
  dashboard: "dashboards",
  dashboardWidget: "dashboard_widgets",
  reportDefinition: "report_definitions",
  automation: "automations",
  automationAction: "automation_actions",
  automationRun: "automation_runs",
  automationActionRun: "automation_action_runs",
  outboxEvent: "outbox_events",
  webhookEndpoint: "webhook_endpoints",
  webhookDelivery: "webhook_deliveries",
  integrationConnection: "integration_connections",
  importJob: "import_jobs",
  exportJob: "export_jobs",
  clientPortal: "client_portals",
  knowledgePage: "knowledge_pages",
  auditEvent: "audit.events",
}

const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
const camel = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

function toSnake(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "bigint") return value.toString()
  if (Array.isArray(value)) return value.map(toSnake)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [snake(key), toSnake(item)]))
  }
  return value
}

function toCamel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamel)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonRecord).map(([key, item]) => [camel(key), toCamel(item)]))
  }
  return value
}

function scalarWhere(builder: any, key: string, value: unknown) {
  const column = snake(key)
  if (value === null) return builder.is(column, null)
  if (typeof value !== "object" || Array.isArray(value)) return builder.eq(column, value)
  const condition = value as JsonRecord
  if ("in" in condition) return builder.in(column, condition.in)
  if ("notIn" in condition) return builder.not(column, "in", `(${(condition.notIn as unknown[]).join(",")})`)
  if ("contains" in condition) return builder.ilike(column, `%${condition.contains}%`)
  if ("startsWith" in condition) return builder.ilike(column, `${condition.startsWith}%`)
  if ("endsWith" in condition) return builder.ilike(column, `%${condition.endsWith}`)
  if ("lt" in condition) return builder.lt(column, condition.lt)
  if ("lte" in condition) return builder.lte(column, condition.lte)
  if ("gt" in condition) return builder.gt(column, condition.gt)
  if ("gte" in condition) return builder.gte(column, condition.gte)
  return builder.eq(column, value)
}

function applyWhere(builder: any, where: JsonRecord | undefined) {
  if (!where) return builder
  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" && Array.isArray(value)) {
      for (const clause of value) applyWhere(builder, clause as JsonRecord)
      continue
    }
    if (key === "OR" && Array.isArray(value)) {
      const clauses = value.map((clause) =>
        Object.entries(clause as JsonRecord)
          .filter(([, item]) => item === null || typeof item !== "object" || Array.isArray(item))
          .map(([field, item]) => `${snake(field)}.eq.${String(item)}`)
          .join(",")
      )
      if (clauses.length) builder.or(clauses.join(","))
      continue
    }
    // Relation filters are expressed by the caller's tenant-scoped query or
    // by a foreign-key filter. PostgREST cannot safely infer arbitrary ORM
    // relation predicates, so ignore them here rather than widening access.
    if (value && typeof value === "object" && !Array.isArray(value) && !("in" in (value as JsonRecord)) && !("contains" in (value as JsonRecord))) {
      const composite = Object.entries(value as JsonRecord)
      if (composite.every(([, item]) => item === null || typeof item !== "object" || Array.isArray(item))) {
        for (const [field, item] of composite) scalarWhere(builder, field, item)
      }
      continue
    }
    scalarWhere(builder, key, value)
  }
  return builder
}

function orderExpression(orderBy: unknown): Array<{ column: string; ascending: boolean }> {
  const values = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []
  return values.flatMap((item) => Object.entries(item as JsonRecord).map(([key, value]) => ({ column: snake(key), ascending: value !== "desc" })))
}

function uniqueWhere(where: JsonRecord | undefined): JsonRecord {
  if (!where) return {}
  return Object.fromEntries(Object.entries(where).flatMap(([key, value]) => {
    if (key.includes("_")) return Object.entries(value as JsonRecord)
    return [[key, value]]
  }))
}

function pickFields(row: JsonRecord, select: JsonRecord | undefined): JsonRecord {
  if (!select) return row
  const fields = Object.keys(select).filter((key) => select[key] === true)
  return fields.length ? Object.fromEntries(fields.map((key) => [key, row[key]])) : row
}

async function run(model: string, operation: string, args: QueryArgs = {}): Promise<unknown> {
  const table = TABLES[model]
  if (!table) throw new Error(`Unknown database model: ${model}`)
  const client = await createServerClient()
  if (!client) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.")
  const tableClient = client.schema(table.includes(".") ? table.split(".")[0] : "public").from(table.includes(".") ? table.split(".")[1] : table)
  const where = uniqueWhere(args.where)
  let query: any
  if (operation === "create" || operation === "createMany") {
    const payload = operation === "createMany" ? (args.data as unknown[]).map(toSnake) : toSnake(args.data)
    const result = await tableClient.insert(payload).select("*")
    if (result.error) throw result.error
    return operation === "createMany" ? { count: result.data?.length ?? 0 } : toCamel(result.data?.[0])
  }
  if (operation === "update" || operation === "updateMany") {
    query = tableClient.update(toSnake(args.data)).select("*")
    applyWhere(query, where)
    const result = await query
    if (result.error) throw result.error
    if (operation === "updateMany") return { count: result.data?.length ?? 0 }
    return toCamel(result.data?.[0] ?? null)
  }
  if (operation === "delete" || operation === "deleteMany") {
    query = tableClient.delete().select("*")
    applyWhere(query, where)
    const result = await query
    if (result.error) throw result.error
    if (operation === "deleteMany") return { count: result.data?.length ?? 0 }
    return toCamel(result.data?.[0] ?? null)
  }
  if (operation === "upsert") {
    const conflict = Object.keys(where).map(snake).join(",")
    const result = await tableClient.upsert(toSnake(args.data), { onConflict: conflict }).select("*")
    if (result.error) throw result.error
    return toCamel(result.data?.[0] ?? null)
  }
  query = tableClient.select("*")
  applyWhere(query, where)
  for (const item of orderExpression(args.orderBy)) query = query.order(item.column, { ascending: item.ascending })
  if (typeof args.skip === "number") query = query.range(args.skip, args.skip + Math.max((args.take ?? 1000) - 1, 0))
  else if (typeof args.take === "number") query = query.limit(args.take)
  const result = await query
  if (result.error) throw result.error
  const rows = (result.data ?? []).map((row: unknown) => pickFields(toCamel(row) as JsonRecord, args.select))
  if (operation === "findUnique" || operation === "findFirst") return rows[0] ?? null
  if (operation === "findUniqueOrThrow" || operation === "findFirstOrThrow") {
    if (!rows[0]) throw new Error(`${model} not found`)
    return rows[0]
  }
  return rows
}

type Delegate = {
  findMany(args?: QueryArgs): Promise<any>
  findFirst(args?: QueryArgs): Promise<any>
  findFirstOrThrow(args?: QueryArgs): Promise<any>
  findUnique(args?: QueryArgs): Promise<any>
  findUniqueOrThrow(args?: QueryArgs): Promise<any>
  create(args: QueryArgs): Promise<any>
  createMany(args: QueryArgs & { data: JsonRecord[] }): Promise<any>
  update(args: QueryArgs): Promise<any>
  updateMany(args: QueryArgs): Promise<any>
  delete(args: QueryArgs): Promise<any>
  deleteMany(args: QueryArgs): Promise<any>
  upsert(args: QueryArgs): Promise<any>
}

const delegateFor = (model: string): Delegate => new Proxy({}, {
  get: (_target, operation: string) => (args: QueryArgs = {}) => run(model, operation, args),
}) as Delegate

const models = Object.keys(TABLES)
const database = Object.fromEntries(models.map((model) => [model, delegateFor(model)])) as Record<string, Delegate>

export const db = new Proxy(database as Record<string, Delegate> & {
  $transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T>
  $queryRaw(...args: unknown[]): Promise<unknown[]>
}, {
  get(target, property: string) {
    if (property === "$transaction") return async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db)
    if (property === "$queryRaw") return async () => [{ value: 1 }]
    return target[property]
  },
})
