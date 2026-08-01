/**
 * Request-scoped database boundary.
 *
 * The product request path is Supabase Postgres through PostgREST. Keeping the
 * small ORM-shaped surface here means feature actions continue to express
 * tenant-scoped intent while the database and RLS remain the authority.
 */
import { createServerClient, createServiceClient } from "@/lib/supabase/server"

type JsonRecord = Record<string, unknown>
type QueryArgs = {
  where?: JsonRecord
  data?: unknown
  include?: JsonRecord
  select?: JsonRecord
  orderBy?: unknown
  take?: number
  skip?: number
  distinct?: string | string[]
  create?: unknown
  update?: unknown
}
type ClientFactory = () =>
  ReturnType<typeof createServerClient> | ReturnType<typeof createServiceClient>

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

type Relation = {
  model: string
  foreignKey?: string
  targetForeignKey?: string
  junction?: { model: string; sourceKey: string; targetKey: string }
}
const RELATIONS: Record<string, Record<string, Relation>> = {
  workspaceMembership: {
    workspace: { model: "workspace", foreignKey: "workspaceId" },
    user: { model: "user", foreignKey: "userId" },
    roles: {
      model: "role",
      junction: { model: "membershipRole", sourceKey: "membershipId", targetKey: "roleId" },
    },
  },
  membershipRole: {
    role: { model: "role", foreignKey: "roleId" },
    membership: { model: "workspaceMembership", foreignKey: "membershipId" },
  },
  role: {
    permissions: {
      model: "permission",
      junction: { model: "rolePermission", sourceKey: "roleId", targetKey: "permissionId" },
    },
    memberships: {
      model: "workspaceMembership",
      junction: { model: "membershipRole", sourceKey: "roleId", targetKey: "membershipId" },
    },
  },
  rolePermission: {
    role: { model: "role", foreignKey: "roleId" },
    permission: { model: "permission", foreignKey: "permissionId" },
  },
  invitation: {
    workspace: { model: "workspace", foreignKey: "workspaceId" },
    roles: {
      model: "role",
      junction: { model: "invitationRole", sourceKey: "invitationId", targetKey: "roleId" },
    },
  },
  invitationRole: {
    role: { model: "role", foreignKey: "roleId" },
    invitation: { model: "invitation", foreignKey: "invitationId" },
  },
  pipeline: { stages: { model: "pipelineStage", targetForeignKey: "pipelineId" } },
  pipelineStage: { pipeline: { model: "pipeline", foreignKey: "pipelineId" } },
  company: {
    owner: { model: "user", foreignKey: "ownerId" },
    contacts: { model: "contact", targetForeignKey: "companyId" },
    deals: { model: "deal", targetForeignKey: "companyId" },
  },
  contact: {
    company: { model: "company", foreignKey: "companyId" },
    owner: { model: "user", foreignKey: "ownerId" },
    clientContacts: { model: "clientContact", targetForeignKey: "contactId" },
  },
  lead: {
    contact: { model: "contact", foreignKey: "contactId" },
    company: { model: "company", foreignKey: "companyId" },
    owner: { model: "user", foreignKey: "ownerId" },
  },
  deal: {
    stage: { model: "pipelineStage", foreignKey: "stageId" },
    company: { model: "company", foreignKey: "companyId" },
    primaryContact: { model: "contact", foreignKey: "primaryContactId" },
    owner: { model: "user", foreignKey: "ownerId" },
  },
  activity: {
    owner: { model: "user", foreignKey: "ownerId" },
    contact: { model: "contact", foreignKey: "contactId" },
    deal: { model: "deal", foreignKey: "dealId" },
  },
  note: { owner: { model: "user", foreignKey: "ownerId" } },
  client: {
    owner: { model: "user", foreignKey: "ownerId" },
    projects: { model: "project", targetForeignKey: "clientId" },
    clientRequests: { model: "clientRequest", targetForeignKey: "clientId" },
    retainers: { model: "retainer", targetForeignKey: "clientId" },
    invoices: { model: "invoice", targetForeignKey: "clientId" },
    expenses: { model: "expense", targetForeignKey: "clientId" },
    clientContacts: { model: "clientContact", targetForeignKey: "clientId" },
  },
  clientContact: {
    client: { model: "client", foreignKey: "clientId" },
    contact: { model: "contact", foreignKey: "contactId" },
  },
  clientRequest: {
    client: { model: "client", foreignKey: "clientId" },
    workspace: { model: "workspace", foreignKey: "workspaceId" },
  },
  project: {
    client: { model: "client", foreignKey: "clientId" },
    status: { model: "projectStatus", foreignKey: "statusId" },
    owner: { model: "user", foreignKey: "ownerId" },
    tasks: { model: "task", targetForeignKey: "projectId" },
    milestones: { model: "milestone", targetForeignKey: "projectId" },
    timeEntries: { model: "timeEntry", targetForeignKey: "projectId" },
    deliverables: { model: "deliverable", targetForeignKey: "projectId" },
    campaigns: { model: "campaign", targetForeignKey: "projectId" },
    members: { model: "projectMember", targetForeignKey: "projectId" },
  },
  projectMember: {
    membership: { model: "workspaceMembership", foreignKey: "membershipId" },
    project: { model: "project", foreignKey: "projectId" },
  },
  task: {
    project: { model: "project", foreignKey: "projectId" },
    status: { model: "taskStatus", foreignKey: "statusId" },
    assignee: { model: "user", foreignKey: "assigneeId" },
    owner: { model: "user", foreignKey: "ownerId" },
    milestone: { model: "milestone", foreignKey: "milestoneId" },
  },
  milestone: {
    project: { model: "project", foreignKey: "projectId" },
    tasks: { model: "task", targetForeignKey: "milestoneId" },
  },
  approvalRequest: {
    steps: { model: "approvalStep", targetForeignKey: "approvalRequestId" },
    events: { model: "approvalEvent", targetForeignKey: "approvalRequestId" },
    client: { model: "client", foreignKey: "clientId" },
  },
  approvalStep: {
    approvalRequest: { model: "approvalRequest", foreignKey: "approvalRequestId" },
    user: { model: "user", foreignKey: "approverId" },
  },
  approvalEvent: {
    approvalRequest: { model: "approvalRequest", foreignKey: "approvalRequestId" },
    actorUser: { model: "user", foreignKey: "actorUserId" },
  },
  timeEntry: {
    user: { model: "user", foreignKey: "userId" },
    project: { model: "project", foreignKey: "projectId" },
    client: { model: "client", foreignKey: "clientId" },
  },
  invoice: {
    client: { model: "client", foreignKey: "clientId" },
    lines: { model: "invoiceLine", targetForeignKey: "invoiceId" },
  },
  invoiceLine: {
    invoice: { model: "invoice", foreignKey: "invoiceId" },
    project: { model: "project", foreignKey: "projectId" },
  },
  expense: {
    client: { model: "client", foreignKey: "clientId" },
    project: { model: "project", foreignKey: "projectId" },
  },
  clientPortal: {
    client: { model: "client", foreignKey: "clientId" },
    contact: { model: "contact", foreignKey: "contactId" },
    workspace: { model: "workspace", foreignKey: "workspaceId" },
  },
  fileRecord: {
    owner: { model: "user", foreignKey: "ownerId" },
    versions: { model: "deliverableVersion", targetForeignKey: "fileId" },
    client: { model: "client", foreignKey: "clientId" },
  },
  deliverable: {
    owner: { model: "user", foreignKey: "ownerId" },
    project: { model: "project", foreignKey: "projectId" },
    versions: { model: "deliverableVersion", targetForeignKey: "deliverableId" },
  },
  deliverableVersion: {
    owner: { model: "user", foreignKey: "ownerId" },
    deliverable: { model: "deliverable", foreignKey: "deliverableId" },
  },
  campaign: {
    owner: { model: "user", foreignKey: "ownerId" },
    project: { model: "project", foreignKey: "projectId" },
  },
  notification: {
    user: { model: "user", foreignKey: "userId" },
    actorUser: { model: "user", foreignKey: "actorUserId" },
  },
  auditEvent: { actorUser: { model: "user", foreignKey: "actorUserId" } },
}

const FIELD_ALIASES: Record<string, Record<string, string>> = {
  company: { ownerId: "owner_user_id" },
  contact: { ownerId: "owner_user_id" },
  lead: { ownerId: "owner_user_id" },
  deal: { ownerId: "owner_user_id" },
  activity: { ownerId: "owner_user_id" },
  note: { authorId: "author_user_id" },
  client: { ownerId: "owner_user_id" },
  project: { ownerId: "owner_user_id" },
  task: { ownerId: "owner_user_id", assigneeId: "assignee_user_id" },
  campaign: { ownerId: "owner_user_id" },
  deliverable: { ownerId: "owner_user_id" },
  contentItem: { ownerId: "owner_user_id" },
  comment: { authorId: "author_user_id" },
  activityEvent: { actorUserId: "actor_user_id" },
  notification: { userId: "user_id", actorUserId: "actor_user_id" },
  fileRecord: { uploaderId: "uploader_user_id" },
  approvalRequest: { requestedById: "requested_by" },
  approvalStep: { decidedById: "decided_by_user_id" },
  approvalEvent: { actorUserId: "actor_user_id" },
  integrationConnection: { connectedById: "connected_by" },
  savedView: { ownerId: "owner_user_id" },
  dashboard: { ownerId: "owner_user_id" },
}

const columnName = (model: string, key: string) => FIELD_ALIASES[model]?.[key] ?? snake(key)

const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
const camel = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

function toSnake(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "bigint") return value.toString()
  if (Array.isArray(value)) return value.map(toSnake)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, item]) => [snake(key), toSnake(item)])
    )
  }
  return value
}

function toCamel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toCamel)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord).map(([key, item]) => [camel(key), toCamel(item)])
    )
  }
  return value
}

function scalarWhere(builder: any, key: string, value: unknown, model?: string) {
  const column = columnName(model ?? "", key)
  if (value === null) return builder.is(column, null)
  if (typeof value !== "object" || Array.isArray(value)) return builder.eq(column, value)
  const condition = value as JsonRecord
  if ("in" in condition) return builder.in(column, condition.in)
  if ("notIn" in condition)
    return builder.not(column, "in", `(${(condition.notIn as unknown[]).join(",")})`)
  if ("contains" in condition) return builder.ilike(column, `%${condition.contains}%`)
  if ("startsWith" in condition) return builder.ilike(column, `${condition.startsWith}%`)
  if ("endsWith" in condition) return builder.ilike(column, `%${condition.endsWith}`)
  if ("lt" in condition) return builder.lt(column, condition.lt)
  if ("lte" in condition) return builder.lte(column, condition.lte)
  if ("gt" in condition) return builder.gt(column, condition.gt)
  if ("gte" in condition) return builder.gte(column, condition.gte)
  return builder.eq(column, value)
}

function applyWhere(builder: any, where: JsonRecord | undefined, model?: string) {
  if (!where) return builder
  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" && Array.isArray(value)) {
      for (const clause of value) applyWhere(builder, clause as JsonRecord, model)
      continue
    }
    if (key === "OR" && Array.isArray(value)) {
      const clauses = value.map((clause) =>
        Object.entries(clause as JsonRecord)
          .filter(([, item]) => item === null || typeof item !== "object" || Array.isArray(item))
          .map(([field, item]) => `${columnName(model ?? "", field)}.eq.${String(item)}`)
          .join(",")
      )
      if (clauses.length) builder.or(clauses.join(","))
      continue
    }
    // Relation filters are expressed by the caller's tenant-scoped query or
    // by a foreign-key filter. PostgREST cannot safely infer arbitrary ORM
    // relation predicates, so ignore them here rather than widening access.
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !("in" in (value as JsonRecord)) &&
      !("contains" in (value as JsonRecord))
    ) {
      const composite = Object.entries(value as JsonRecord)
      if (
        composite.every(
          ([, item]) => item === null || typeof item !== "object" || Array.isArray(item)
        )
      ) {
        for (const [field, item] of composite) scalarWhere(builder, field, item, model)
      }
      continue
    }
    scalarWhere(builder, key, value, model)
  }
  return builder
}

function orderExpression(orderBy: unknown): Array<{ column: string; ascending: boolean }> {
  const values = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []
  return values.flatMap((item) =>
    Object.entries(item as JsonRecord).map(([key, value]) => ({
      column: snake(key),
      ascending: value !== "desc",
    }))
  )
}

function uniqueWhere(where: JsonRecord | undefined): JsonRecord {
  if (!where) return {}
  return Object.fromEntries(
    Object.entries(where).flatMap(([key, value]) => {
      if (key.includes("_")) return Object.entries(value as JsonRecord)
      return [[key, value]]
    })
  )
}

function pickFields(row: JsonRecord, select: JsonRecord | undefined): JsonRecord {
  if (!select) return row
  const fields = Object.keys(select).filter((key) => select[key] === true)
  return fields.length ? Object.fromEntries(fields.map((key) => [key, row[key]])) : row
}

function toSql(model: string, value: unknown): unknown {
  const converted = toSnake(value) as JsonRecord | unknown[] | null | undefined
  if (!converted || Array.isArray(converted) || typeof converted !== "object") return converted
  const aliases = FIELD_ALIASES[model] ?? {}
  const result = { ...(converted as JsonRecord) }
  for (const [field, sqlField] of Object.entries(aliases)) {
    const defaultField = snake(field)
    if (defaultField in result) {
      result[sqlField] = result[defaultField]
      delete result[defaultField]
    }
  }
  return result
}

function toModel(model: string, value: unknown): unknown {
  const converted = toCamel(value) as JsonRecord | unknown[] | null | undefined
  if (!converted || Array.isArray(converted) || typeof converted !== "object") return converted
  const result = { ...(converted as JsonRecord) }
  for (const [field, sqlField] of Object.entries(FIELD_ALIASES[model] ?? {})) {
    const camelSqlField = camel(sqlField)
    if (camelSqlField in result) {
      result[field] = result[camelSqlField]
      delete result[camelSqlField]
    }
  }
  return result
}

async function hydrate(
  model: string,
  row: JsonRecord,
  specification: JsonRecord | undefined
): Promise<JsonRecord> {
  if (!specification) return row
  const relations = RELATIONS[model] ?? {}
  for (const [name, requested] of Object.entries(specification)) {
    if (name === "_count") {
      const counts: JsonRecord = {}
      for (const [countName, enabled] of Object.entries((requested as JsonRecord).select ?? {})) {
        const relation = relations[countName]
        if (enabled && relation?.targetForeignKey) {
          const records = await run(relation.model, "findMany", {
            where: { [relation.targetForeignKey]: row.id },
          })
          counts[countName] = (records as unknown[]).length
        } else counts[countName] = 0
      }
      row._count = counts
      continue
    }
    const relation = relations[name]
    if (!relation) continue
    const nested = requested === true ? {} : (requested as JsonRecord)
    if (relation.junction) {
      const links = (await run(relation.junction.model, "findMany", {
        where: { [relation.junction.sourceKey]: row.id },
      })) as JsonRecord[]
      const ids = links.map((link) => link[relation.junction!.targetKey]).filter(Boolean)
      row[name] = []
      for (const id of ids) {
        const target = await run(relation.model, "findFirst", {
          where: { id },
          include: nested.include as JsonRecord | undefined,
          select: nested.select as JsonRecord | undefined,
        })
        if (target) (row[name] as unknown[]).push(target)
      }
      if (!Array.isArray(row[name])) row[name] = []
      continue
    }
    if (relation.foreignKey) {
      const foreignId = row[relation.foreignKey]
      row[name] = foreignId
        ? await run(relation.model, "findFirst", {
            where: { id: foreignId },
            include: nested.include as JsonRecord | undefined,
            select: nested.select as JsonRecord | undefined,
          })
        : null
    } else if (relation.targetForeignKey) {
      row[name] = await run(relation.model, "findMany", {
        where: { [relation.targetForeignKey]: row.id },
        include: nested.include as JsonRecord | undefined,
        select: nested.select as JsonRecord | undefined,
        orderBy: nested.orderBy,
        take: typeof nested.take === "number" ? nested.take : undefined,
      })
    }
  }
  return row
}

async function run(
  model: string,
  operation: string,
  args: QueryArgs = {},
  getClient: ClientFactory = createServerClient
): Promise<unknown> {
  const table = TABLES[model]
  if (!table) throw new Error(`Unknown database model: ${model}`)
  const client = await getClient()
  if (!client)
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    )
  const tableClient: any = client
    .schema(table.includes(".") ? table.split(".")[0] : "public")
    .from(table.includes(".") ? table.split(".")[1] : table)
  const where = uniqueWhere(args.where)
  let query: any
  if (operation === "create" || operation === "createMany") {
    const payload =
      operation === "createMany"
        ? (args.data as unknown[]).map((item) => toSql(model, item))
        : toSql(model, args.data)
    const result = await tableClient.insert(payload).select("*")
    if (result.error) throw result.error
    return operation === "createMany"
      ? { count: result.data?.length ?? 0 }
      : toModel(model, result.data?.[0])
  }
  if (operation === "update" || operation === "updateMany") {
    query = tableClient.update(toSql(model, args.data)).select("*")
    applyWhere(query, where, model)
    const result = await query
    if (result.error) throw result.error
    if (operation === "updateMany") return { count: result.data?.length ?? 0 }
    return toModel(model, result.data?.[0] ?? null)
  }
  if (operation === "delete" || operation === "deleteMany") {
    query = tableClient.delete().select("*")
    applyWhere(query, where, model)
    const result = await query
    if (result.error) throw result.error
    if (operation === "deleteMany") return { count: result.data?.length ?? 0 }
    return toModel(model, result.data?.[0] ?? null)
  }
  if (operation === "upsert") {
    const conflict = Object.keys(where).map(snake).join(",")
    // PostgREST uses one payload for both insert and conflict-update paths.
    // Prefer the complete create payload so compound keys and required tenant
    // columns remain present.
    const payload = args.data ?? args.create ?? args.update
    const result = await tableClient
      .upsert(toSql(model, payload), { onConflict: conflict })
      .select("*")
    if (result.error) throw result.error
    return toModel(model, result.data?.[0] ?? null)
  }
  if (operation === "count") {
    query = tableClient.select("id", { count: "exact", head: true })
    applyWhere(query, where, model)
    const result = await query
    if (result.error) throw result.error
    return result.count ?? 0
  }
  query = tableClient.select("*")
  applyWhere(query, where, model)
  for (const item of orderExpression(args.orderBy))
    query = query.order(item.column, { ascending: item.ascending })
  if (typeof args.skip === "number")
    query = query.range(args.skip, args.skip + Math.max((args.take ?? 1000) - 1, 0))
  else if (typeof args.take === "number") query = query.limit(args.take)
  const result = await query
  if (result.error) throw result.error
  const hydratedRows: JsonRecord[] = []
  for (const raw of result.data ?? [])
    hydratedRows.push(await hydrate(model, toModel(model, raw) as JsonRecord, args.include))
  const rows = hydratedRows.map((row) => pickFields(row, args.select))
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
  createMany(args: QueryArgs & { data: unknown[] }): Promise<any>
  update(args: QueryArgs): Promise<any>
  updateMany(args: QueryArgs): Promise<any>
  delete(args: QueryArgs): Promise<any>
  deleteMany(args: QueryArgs): Promise<any>
  upsert(args: QueryArgs): Promise<any>
  count(args?: QueryArgs): Promise<number>
}

const delegateFor = (model: string, getClient: ClientFactory = createServerClient): Delegate =>
  new Proxy(
    {},
    {
      get:
        (_target, operation: string) =>
        (args: QueryArgs = {}) =>
          run(model, operation, args, getClient),
    }
  ) as Delegate

const models = Object.keys(TABLES)
const database = Object.fromEntries(models.map((model) => [model, delegateFor(model)])) as Record<
  string,
  Delegate
>
type Database = Record<string, Delegate> & {
  $transaction<T>(callback: (tx: Database) => Promise<T>): Promise<T>
}

export const db: Database = new Proxy(database as Database, {
  get(target, property: string) {
    if (property === "$transaction")
      return async <T>(callback: (tx: Database) => Promise<T>) => callback(db)
    return target[property]
  },
})

const serviceDatabase = Object.fromEntries(
  models.map((model) => [model, delegateFor(model, createServiceClient)])
) as Record<string, Delegate>

/** Trusted worker database boundary. Never import into client components. */
export const serviceDb: Database = new Proxy(serviceDatabase as Database, {
  get(target, property: string) {
    if (property === "$transaction")
      return async <T>(callback: (tx: Database) => Promise<T>) => callback(serviceDb)
    return target[property]
  },
})
