import type { SupabaseClient } from "@supabase/supabase-js"

type JsonRecord = Record<string, unknown>
type ClientFactory = () => Promise<SupabaseClient | null> | SupabaseClient | null

export type QueryArgs = {
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

type Relation = {
  model: string
  foreignKey?: string
  targetForeignKey?: string
  junction?: { model: string; sourceKey: string; targetKey: string }
}

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

const RELATIONS: Record<string, Record<string, Relation>> = {
  workspaceMembership: {
    workspace: { model: "workspace", foreignKey: "workspaceId" },
    user: { model: "user", foreignKey: "userId" },
    roles: { model: "role", junction: { model: "membershipRole", sourceKey: "membershipId", targetKey: "roleId" } },
  },
  membershipRole: {
    role: { model: "role", foreignKey: "roleId" },
    membership: { model: "workspaceMembership", foreignKey: "membershipId" },
  },
  role: {
    permissions: { model: "permission", junction: { model: "rolePermission", sourceKey: "roleId", targetKey: "permissionId" } },
    memberships: { model: "workspaceMembership", junction: { model: "membershipRole", sourceKey: "roleId", targetKey: "membershipId" } },
  },
  rolePermission: {
    role: { model: "role", foreignKey: "roleId" },
    permission: { model: "permission", foreignKey: "permissionId" },
  },
  invitation: {
    workspace: { model: "workspace", foreignKey: "workspaceId" },
    roles: { model: "role", junction: { model: "invitationRole", sourceKey: "invitationId", targetKey: "roleId" } },
    teams: { model: "team", junction: { model: "invitationTeam", sourceKey: "invitationId", targetKey: "teamId" } },
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
    company: { model: "company", foreignKey: "companyId" },
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
    requestedBy: { model: "user", foreignKey: "requestedById" },
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
  automation: { actions: { model: "automationAction", targetForeignKey: "automationId" } },
  automationRun: { actions: { model: "automationActionRun", targetForeignKey: "runId" } },
}

const FIELD_ALIASES: Record<string, Record<string, string>> = {
  company: { ownerId: "owner_user_id" }, contact: { ownerId: "owner_user_id" }, lead: { ownerId: "owner_user_id" },
  deal: { ownerId: "owner_user_id" }, activity: { ownerId: "owner_user_id" }, note: { authorId: "author_user_id" },
  client: { ownerId: "owner_user_id" }, project: { ownerId: "owner_user_id" },
  task: { ownerId: "owner_user_id", assigneeId: "assignee_user_id" }, campaign: { ownerId: "owner_user_id" },
  deliverable: { ownerId: "owner_user_id" }, contentItem: { ownerId: "owner_user_id" },
  comment: { authorId: "author_user_id" }, activityEvent: { actorUserId: "actor_user_id" },
  notification: { userId: "user_id", actorUserId: "actor_user_id" }, fileRecord: { uploaderId: "uploader_user_id" },
  approvalRequest: { requestedById: "requested_by" }, approvalStep: { decidedById: "decided_by_user_id" },
  approvalEvent: { actorUserId: "actor_user_id" }, integrationConnection: { connectedById: "connected_by" },
  savedView: { ownerId: "owner_user_id" }, dashboard: { ownerId: "owner_user_id" },
}

const COMPOSITE_KEYS: Record<string, string[]> = {
  workspaceId_name: ["workspaceId", "name"],
  roleId_permissionId: ["roleId", "permissionId"],
  workspaceId_userId: ["workspaceId", "userId"],
  definitionId_entityId: ["definitionId", "entityId"],
}

const ZERO_UUID = "00000000-0000-0000-0000-000000000000"
const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
const camel = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
const columnName = (model: string, key: string) => FIELD_ALIASES[model]?.[key] ?? snake(key)
const isRecord = (value: unknown): value is JsonRecord => Boolean(value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date))

function toSnake(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "bigint") return value.toString()
  if (Array.isArray(value)) return value.map(toSnake)
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [snake(key), toSnake(item)]))
  return value
}

function toModel(model: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => toModel(model, item))
  if (!isRecord(value)) return value
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [camel(key), toModel(model, item)]))
  for (const [field, sqlField] of Object.entries(FIELD_ALIASES[model] ?? {})) {
    const camelSqlField = camel(sqlField)
    if (camelSqlField in result) {
      result[field] = result[camelSqlField]
      delete result[camelSqlField]
    }
  }
  return result
}

function toSql(model: string, value: unknown): unknown {
  const converted = toSnake(value)
  if (!isRecord(converted)) return converted
  const result = { ...converted }
  for (const [field, sqlField] of Object.entries(FIELD_ALIASES[model] ?? {})) {
    const defaultField = snake(field)
    if (defaultField in result) {
      result[sqlField] = result[defaultField]
      delete result[defaultField]
    }
  }
  return result
}

function normalizeWhere(where: JsonRecord | undefined): JsonRecord {
  if (!where) return {}
  const result: JsonRecord = {}
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue
    const fields = COMPOSITE_KEYS[key]
    if (fields) {
      if (!isRecord(value)) throw new Error(`Invalid composite unique filter '${key}'`)
      for (const field of fields) {
        if (!(field in value)) throw new Error(`Composite unique filter '${key}' is missing '${field}'`)
        result[field] = value[field]
      }
    } else result[key] = value
  }
  return result
}

function scalarWhere(builder: any, model: string, key: string, value: unknown) {
  if (value === undefined) return builder
  const column = columnName(model, key)
  if (value === null) return builder.is(column, null)
  if (!isRecord(value) || Array.isArray(value)) return builder.eq(column, value)
  const supported = ["equals", "in", "notIn", "contains", "startsWith", "endsWith", "lt", "lte", "gt", "gte", "not"]
  const unknown = Object.keys(value).filter((operator) => !supported.includes(operator))
  if (unknown.length) throw new Error(`Unsupported filter operator '${unknown[0]}' on ${model}.${key}`)
  if ("equals" in value) scalarWhere(builder, model, key, value.equals)
  if ("in" in value) {
    if (!Array.isArray(value.in)) throw new Error(`'in' must be an array for ${model}.${key}`)
    builder.in(column, value.in)
  }
  if ("notIn" in value) {
    if (!Array.isArray(value.notIn)) throw new Error(`'notIn' must be an array for ${model}.${key}`)
    builder.not(column, "in", `(${value.notIn.map((item) => typeof item === "string" ? JSON.stringify(item) : String(item)).join(",")})`)
  }
  if ("contains" in value) builder.ilike(column, `%${escapeLike(String(value.contains))}%`)
  if ("startsWith" in value) builder.ilike(column, `${escapeLike(String(value.startsWith))}%`)
  if ("endsWith" in value) builder.ilike(column, `%${escapeLike(String(value.endsWith))}`)
  if ("lt" in value) builder.lt(column, value.lt)
  if ("lte" in value) builder.lte(column, value.lte)
  if ("gt" in value) builder.gt(column, value.gt)
  if ("gte" in value) builder.gte(column, value.gte)
  if ("not" in value) {
    if (isRecord(value.not)) throw new Error(`Nested 'not' filters are unsupported for ${model}.${key}`)
    builder.not(column, "eq", value.not)
  }
  return builder
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

async function matchingIds(model: string, where: JsonRecord, getClient: ClientFactory): Promise<string[]> {
  const rows = await run(model, "findMany", { where, select: { id: true } }, getClient)
  return (rows as JsonRecord[]).map((row) => String(row.id))
}

async function relationIds(model: string, relation: Relation, filter: unknown, getClient: ClientFactory): Promise<string[]> {
  if (!isRecord(filter)) throw new Error(`Invalid relation filter on ${model}`)
  const nested = "some" in filter || "none" in filter || "every" in filter || "is" in filter || "isNot" in filter ? filter : { is: filter }
  if (relation.foreignKey) {
    const targetWhere = (nested.is ?? nested.isNot) as JsonRecord | undefined
    if (!targetWhere) throw new Error(`Unsupported relation predicate on ${model}`)
    const ids = await matchingIds(relation.model, targetWhere, getClient)
    return ids
  }
  if (relation.targetForeignKey) {
    const predicate = nested.some ?? nested.none ?? nested.every
    if (!isRecord(predicate)) throw new Error(`To-many relation on ${model} requires some, none, or every`)
    const rows = await run(relation.model, "findMany", { where: predicate, select: { [relation.targetForeignKey]: true } }, getClient)
    return (rows as JsonRecord[]).map((row) => String(row[relation.targetForeignKey!])).filter(Boolean)
  }
  if (relation.junction) {
    const targetWhere = (nested.some ?? nested.none ?? nested.every) as JsonRecord | undefined
    if (!targetWhere) throw new Error(`Junction relation on ${model} requires some, none, or every`)
    const targetIds = await matchingIds(relation.model, targetWhere, getClient)
    if (!targetIds.length) return []
    const links = await run(relation.junction.model, "findMany", { where: { [relation.junction.targetKey]: { in: targetIds } }, select: { [relation.junction.sourceKey]: true } }, getClient)
    return (links as JsonRecord[]).map((row) => String(row[relation.junction!.sourceKey])).filter(Boolean)
  }
  throw new Error(`Relation ${model} is not queryable`)
}

async function applyWhere(builder: any, model: string, where: JsonRecord | undefined, getClient: ClientFactory) {
  const normalized = normalizeWhere(where)
  for (const [key, value] of Object.entries(normalized)) {
    if (key === "AND") {
      if (!Array.isArray(value)) throw new Error("AND must be an array")
      for (const clause of value) {
        if (!isRecord(clause)) throw new Error("AND clauses must be objects")
        await applyWhere(builder, model, clause, getClient)
      }
      continue
    }
    if (key === "OR") {
      if (!Array.isArray(value)) throw new Error("OR must be an array")
      const ids = new Set<string>()
      for (const clause of value) {
        if (!isRecord(clause)) throw new Error("OR clauses must be objects")
        for (const id of await matchingIds(model, clause, getClient)) ids.add(id)
      }
      builder.in("id", Array.from(ids).length ? Array.from(ids) : [ZERO_UUID])
      continue
    }
    const relation = RELATIONS[model]?.[key]
    if (relation) {
      const ids = await relationIds(model, relation, value, getClient)
      if (isRecord(value) && "none" in value) builder.not("id", "in", `(${ids.join(",") || ZERO_UUID})`)
      else builder.in(relation.foreignKey ? columnName(model, relation.foreignKey) : "id", ids.length ? ids : [ZERO_UUID])
      continue
    }
    scalarWhere(builder, model, key, value)
  }
  return builder
}

function orderExpression(model: string, orderBy: unknown): Array<{ column: string; ascending: boolean }> {
  const values = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []
  return values.flatMap((item) => {
    if (!isRecord(item)) throw new Error("orderBy entries must be objects")
    return Object.entries(item).map(([key, value]) => {
      if (value !== "asc" && value !== "desc") throw new Error(`Invalid order direction for ${model}.${key}`)
      return { column: columnName(model, key), ascending: value === "asc" }
    })
  })
}

function relationSpec(model: string, specification: JsonRecord | undefined) {
  if (!specification) return undefined
  const relations = RELATIONS[model] ?? {}
  const selected: JsonRecord = {}
  for (const [key, value] of Object.entries(specification)) {
    if (key === "_count" || key in relations) selected[key] = value
    else if (value !== true) continue
  }
  return selected
}

async function hydrate(model: string, row: JsonRecord, specification: JsonRecord | undefined, getClient: ClientFactory) {
  if (!specification) return row
  const relations = RELATIONS[model] ?? {}
  for (const [name, requested] of Object.entries(specification)) {
    if (name === "_count") {
      if (!isRecord(requested) || !isRecord(requested.select)) throw new Error("_count requires a select object")
      const counts: JsonRecord = {}
      for (const [countName, enabled] of Object.entries(requested.select)) {
        const relation = relations[countName]
        if (!relation || enabled !== true) throw new Error(`Unsupported relation count ${model}.${countName}`)
        const where = relation.targetForeignKey ? { [relation.targetForeignKey]: row.id } : { id: row.id }
        counts[countName] = relation.targetForeignKey ? await run(relation.model, "count", { where }, getClient) : 0
      }
      row._count = counts
      continue
    }
    const relation = relations[name]
    if (!relation) throw new Error(`Unsupported relation include ${model}.${name}`)
    const nested = requested === true ? {} : requested
    if (!isRecord(nested)) throw new Error(`Invalid include specification for ${model}.${name}`)
    const include = relationSpec(relation.model, nested.include)
    const select = nested.select as JsonRecord | undefined
    if (relation.junction) {
      const links = await run(relation.junction.model, "findMany", { where: { [relation.junction.sourceKey]: row.id }, select: { [relation.junction.targetKey]: true } }, getClient) as JsonRecord[]
      const ids = links.map((link) => link[relation.junction!.targetKey]).filter(Boolean)
      row[name] = ids.length ? await run(relation.model, "findMany", { where: { id: { in: ids } }, include, select, orderBy: nested.orderBy, take: nested.take }, getClient) : []
    } else if (relation.foreignKey) {
      const foreignId = row[relation.foreignKey]
      row[name] = foreignId ? await run(relation.model, "findFirst", { where: { id: foreignId }, include, select }, getClient) : null
    } else if (relation.targetForeignKey) {
      row[name] = await run(relation.model, "findMany", { where: { [relation.targetForeignKey]: row.id, ...(isRecord(nested.where) ? nested.where : {}) }, include, select, orderBy: nested.orderBy, take: nested.take, skip: nested.skip }, getClient)
    }
  }
  return row
}

function pickFields(row: JsonRecord, select: JsonRecord | undefined) {
  if (!select) return row
  return Object.fromEntries(Object.entries(select).filter(([, value]) => value === true || isRecord(value)).map(([key]) => [key, row[key]]))
}

async function run(model: string, operation: string, args: QueryArgs = {}, getClient: ClientFactory): Promise<unknown> {
  const table = TABLES[model]
  if (!table) throw new Error(`Unknown database model: ${model}`)
  const unsupported = Object.keys(args).filter((key) => !["where", "data", "include", "select", "orderBy", "take", "skip", "distinct", "create", "update"].includes(key))
  if (unsupported.length) throw new Error(`Unsupported database argument '${unsupported[0]}'`)
  if (args.include && args.select) throw new Error("include and select cannot be used together")
  if (args.distinct) throw new Error("distinct is not supported by the Supabase adapter; use an explicit query")
  if (args.take !== undefined && (!Number.isInteger(args.take) || args.take < 0)) throw new Error("take must be a non-negative integer")
  if (args.skip !== undefined && (!Number.isInteger(args.skip) || args.skip < 0)) throw new Error("skip must be a non-negative integer")
  const client = await getClient()
  if (!client) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.")
  const [schema, name] = table.includes(".") ? table.split(".") : ["public", table]
  const tableClient: any = client.schema(schema).from(name)
  const where = normalizeWhere(args.where)

  if (operation === "create" || operation === "createMany") {
    if (args.data === undefined) throw new Error(`${model}.${operation} requires data`)
    const payload = operation === "createMany" ? (Array.isArray(args.data) ? args.data.map((item) => toSql(model, item)) : (() => { throw new Error(`${model}.createMany data must be an array`) })()) : toSql(model, args.data)
    if (operation === "createMany" && (payload as unknown[]).length === 0) return { count: 0 }
    const result = await tableClient.insert(payload).select("*")
    if (result.error) throw result.error
    return operation === "createMany" ? { count: result.data?.length ?? 0 } : toModel(model, result.data?.[0])
  }
  if (operation === "update" || operation === "updateMany") {
    if (args.data === undefined) throw new Error(`${model}.${operation} requires data`)
    const query = tableClient.update(toSql(model, args.data)).select("*")
    await applyWhere(query, model, where, getClient)
    const result = await query
    if (result.error) throw result.error
    if (operation === "updateMany") return { count: result.data?.length ?? 0 }
    if (!result.data?.length) throw new Error(`${model} not found for update`)
    if (result.data.length > 1) throw new Error(`${model} update matched multiple records`)
    return toModel(model, result.data[0])
  }
  if (operation === "delete" || operation === "deleteMany") {
    const query = tableClient.delete().select("*")
    await applyWhere(query, model, where, getClient)
    const result = await query
    if (result.error) throw result.error
    if (operation === "deleteMany") return { count: result.data?.length ?? 0 }
    if (!result.data?.length) throw new Error(`${model} not found for delete`)
    if (result.data.length > 1) throw new Error(`${model} delete matched multiple records`)
    return toModel(model, result.data[0])
  }
  if (operation === "upsert") {
    if (!Object.keys(where).length) throw new Error(`${model}.upsert requires a unique where filter`)
    if (Object.values(where).some((value) => isRecord(value))) throw new Error(`${model}.upsert only supports scalar unique filters`)
    const payload = args.create ?? args.data
    if (payload === undefined) throw new Error(`${model}.upsert requires create/data`)
    const conflict = Object.keys(where).map((key) => columnName(model, key)).join(",")
    const result = await tableClient.upsert(toSql(model, payload), { onConflict: conflict }).select("*")
    if (result.error) throw result.error
    return toModel(model, result.data?.[0] ?? null)
  }
  if (operation === "count") {
    const query = tableClient.select("id", { count: "exact", head: true })
    await applyWhere(query, model, where, getClient)
    const result = await query
    if (result.error) throw result.error
    return result.count ?? 0
  }
  if (!["findMany", "findFirst", "findUnique", "findFirstOrThrow", "findUniqueOrThrow"].includes(operation)) throw new Error(`Unsupported database operation '${operation}'`)
  const query = tableClient.select("*")
  await applyWhere(query, model, where, getClient)
  for (const item of orderExpression(model, args.orderBy)) query.order(item.column, { ascending: item.ascending })
  if (args.skip !== undefined) query.range(args.skip, args.skip + Math.max((args.take ?? 1000) - 1, 0))
  else if (args.take !== undefined) query.limit(args.take)
  const result = await query
  if (result.error) throw result.error
  if ((operation === "findUnique" || operation === "findUniqueOrThrow") && (result.data?.length ?? 0) > 1) throw new Error(`${model} unique filter matched multiple records`)
  const specification = relationSpec(model, args.include ?? args.select)
  const hydrated = []
  for (const raw of result.data ?? []) hydrated.push(await hydrate(model, toModel(model, raw) as JsonRecord, specification, getClient))
  const rows = hydrated.map((row) => pickFields(row, args.select))
  if (operation === "findUnique" || operation === "findFirst") return rows[0] ?? null
  if (!rows[0]) throw new Error(`${model} not found`)
  return rows[0]
}

export type Delegate = {
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

export type Database = Record<string, Delegate> & {
  $transaction<T>(callback: (tx: Database) => Promise<T>): Promise<T>
}

export function createDatabase(getClient: ClientFactory): Database {
  const delegates = Object.fromEntries(Object.keys(TABLES).map((model) => [model, new Proxy({}, { get: (_target, operation: string) => (args: QueryArgs = {}) => run(model, operation, args, getClient) })])) as Record<string, Delegate>
  return new Proxy(delegates as Database, {
    get(target, property: string) {
      if (property === "$transaction") return async () => { throw new Error("Generic adapter transactions are unsupported. Use a PostgreSQL transaction RPC.") }
      return target[property]
    },
  })
}

export async function callDatabaseRpc<T = unknown>(getClient: ClientFactory, functionName: string, args: JsonRecord): Promise<T> {
  const client = await getClient()
  if (!client) throw new Error("Supabase is not configured")
  const { data, error } = await client.rpc(functionName, args)
  if (error) throw error
  return data as T
}

