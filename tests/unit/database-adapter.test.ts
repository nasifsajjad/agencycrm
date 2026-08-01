import { describe, expect, it } from "vitest"
import { createDatabase } from "@agencyos/database"

type Row = Record<string, unknown>
type Filter = { kind: string; column?: string; value?: unknown; operator?: string }

class FakeBuilder implements PromiseLike<{ data: Row[] | null; error: Error | null; count?: number }> {
  private filters: Filter[] = []
  private selected = "*"
  private operation: "select" | "update" | "delete" = "select"
  private updateData: Row = {}
  private rangeStart = 0
  private rangeEnd: number | undefined
  private limitValue: number | undefined
  private orderBy: { column: string; ascending: boolean }[] = []

  constructor(private readonly client: FakeSupabase, private readonly table: string) {}

  select(columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.selected = columns
    this.client.lastHead = options?.head === true
    return this
  }
  insert(data: Row | Row[]) {
    const rows = Array.isArray(data) ? data : [data]
    this.client.rows[this.table].push(...rows.map((row) => ({ ...row })))
    return this
  }
  update(data: Row) { this.operation = "update"; this.updateData = data; return this }
  delete() { this.operation = "delete"; return this }
  eq(column: string, value: unknown) { this.filters.push({ kind: "eq", column, value }); return this }
  is(column: string, value: unknown) { this.filters.push({ kind: "is", column, value }); return this }
  in(column: string, value: unknown[]) { this.filters.push({ kind: "in", column, value }); return this }
  not(column: string, operator: string, value: string) { this.filters.push({ kind: "not", column, operator, value }); return this }
  ilike(column: string, value: string) { this.filters.push({ kind: "ilike", column, value }); return this }
  lt(column: string, value: unknown) { this.filters.push({ kind: "lt", column, value }); return this }
  lte(column: string, value: unknown) { this.filters.push({ kind: "lte", column, value }); return this }
  gt(column: string, value: unknown) { this.filters.push({ kind: "gt", column, value }); return this }
  gte(column: string, value: unknown) { this.filters.push({ kind: "gte", column, value }); return this }
  order(column: string, options: { ascending: boolean }) { this.orderBy.push({ column, ascending: options.ascending }); return this }
  range(start: number, end: number) { this.rangeStart = start; this.rangeEnd = end; return this }
  limit(value: number) { this.limitValue = value; return this }

  then<TResult1 = { data: Row[] | null; error: Error | null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: Error | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute() {
    let rows = [...(this.client.rows[this.table] ?? [])]
    if (this.selected.split(",").some((column) => column !== "*" && !this.client.columns[this.table]?.has(column))) {
      return { data: null, error: new Error("column does not exist") }
    }
    rows = rows.filter((row) => this.filters.every((filter) => {
      const actual = row[filter.column ?? ""]
      if (filter.kind === "eq") return actual === filter.value
      if (filter.kind === "is") return filter.value === null ? actual === null : actual === filter.value
      if (filter.kind === "in") return (filter.value as unknown[]).includes(actual)
      if (filter.kind === "not" && filter.operator === "in") return !(filter.value as string).includes(JSON.stringify(actual))
      if (filter.kind === "not" && filter.operator === "eq") return actual !== filter.value
      if (filter.kind === "ilike") {
        const pattern = String(filter.value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&").replace(/%/g, ".*")
        return new RegExp(`^${pattern}$`, "i").test(String(actual ?? ""))
      }
      if (filter.kind === "lt") return (actual as number) < (filter.value as number)
      if (filter.kind === "lte") return (actual as number) <= (filter.value as number)
      if (filter.kind === "gt") return (actual as number) > (filter.value as number)
      if (filter.kind === "gte") return (actual as number) >= (filter.value as number)
      return false
    }))
    for (const order of [...this.orderBy].reverse()) rows.sort((a, b) => String(a[order.column]).localeCompare(String(b[order.column])) * (order.ascending ? 1 : -1))
    if (this.rangeEnd !== undefined) rows = rows.slice(this.rangeStart, this.rangeEnd + 1)
    else if (this.limitValue !== undefined) rows = rows.slice(0, this.limitValue)
    if (this.operation === "update") {
      for (const row of rows) Object.assign(row, this.updateData)
    } else if (this.operation === "delete") {
      this.client.rows[this.table] = this.client.rows[this.table].filter((row) => !rows.includes(row))
    }
    const data = rows.map((row) => this.selected === "*" ? { ...row } : Object.fromEntries(this.selected.split(",").map((column) => [column, row[column]])))
    return { data: this.client.lastHead ? null : data, error: null, count: rows.length }
  }
}

class FakeSupabase {
  lastHead = false
  readonly columns: Record<string, Set<string>> = {
    companies: new Set(["id", "workspace_id", "name", "owner_user_id"]),
    contacts: new Set(["id", "workspace_id", "company_id", "email"]),
    profiles: new Set(["id", "user_id", "email"]),
  }
  rows: Record<string, Row[]> = {
    companies: [
      { id: "company-a", workspace_id: "workspace-a", name: "Acme", owner_user_id: "user-a" },
      { id: "company-b", workspace_id: "workspace-a", name: "Beta", owner_user_id: "user-b" },
    ],
    contacts: [
      { id: "contact-a", workspace_id: "workspace-a", company_id: "company-a", email: "blocked@example.com" },
      { id: "contact-b", workspace_id: "workspace-a", company_id: "company-b", email: "ok@example.com" },
    ],
    profiles: [
      { id: "profile-a", user_id: "user-a", email: "a@example.com" },
      { id: "profile-b", user_id: "user-b", email: "b@example.com" },
    ],
  }
  schema() { return { from: (table: string) => new FakeBuilder(this, table) } }
  rpc() { throw new Error("not used") }
}

describe("Supabase database adapter semantics", () => {
  it("implements relation none and belongs-to isNot without silently broadening results", async () => {
    const client = new FakeSupabase()
    const db = createDatabase(() => client as never)
    const companiesWithoutBlockedContact = await db.company.findMany({
      where: { contacts: { none: { email: "blocked@example.com" } } },
      select: { id: true },
    })
    expect(companiesWithoutBlockedContact).toEqual([{ id: "company-b" }])

    const contactsNotOwnedByAcme = await db.contact.findMany({
      where: { company: { isNot: { name: "Acme" } } },
      select: { id: true },
    })
    expect(contactsNotOwnedByAcme).toEqual([{ id: "contact-b" }])
  })

  it("rejects relation predicates it cannot faithfully express", async () => {
    const db = createDatabase(() => new FakeSupabase() as never)
    await expect(db.company.findMany({ where: { contacts: { every: { email: { contains: "@" } } } } })).rejects.toThrow("every")
  })

  it("makes empty in filters empty and notIn filters unconstrained", async () => {
    const db = createDatabase(() => new FakeSupabase() as never)
    expect(await db.company.findMany({ where: { id: { in: [] } } })).toEqual([])
    expect(await db.company.findMany({ where: { id: { notIn: [] } }, select: { id: true } })).toHaveLength(2)
  })

  it("preflights single-row updates so a non-unique filter cannot partially mutate", async () => {
    const client = new FakeSupabase()
    const db = createDatabase(() => client as never)
    await expect(db.company.update({ where: { workspaceId: "workspace-a" }, data: { name: "wrong" } })).rejects.toThrow("unique")
    expect(client.rows.companies.map((row) => row.name)).toEqual(["Acme", "Beta"])
  })

  it("fails explicitly for generic transactions and invalid projections", async () => {
    const db = createDatabase(() => new FakeSupabase() as never)
    await expect(db.$transaction(async () => true)).rejects.toThrow("transaction RPC")
    await expect(db.company.findMany({ select: { madeUpField: true } })).rejects.toThrow("column does not exist")
  })
})
