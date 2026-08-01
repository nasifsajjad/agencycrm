import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const migrationSql = readFileSync(join(__dirname, "../../supabase/migrations/0007_rls_policies.sql"), "utf8")
const helperSql = readFileSync(join(__dirname, "../../supabase/migrations/0006_authorization_helpers.sql"), "utf8")
const relationshipSql = ["0003_crm.sql", "0004_clients_delivery_collaboration.sql"].map((file) => readFileSync(join(__dirname, "../../supabase/migrations", file), "utf8")).join("\n")

describe("database-enforced tenant isolation", () => {
  it("derives membership from auth.uid rather than request data", () => {
    expect(helperSql).toContain("auth.uid()")
    expect(helperSql).toMatch(/is_workspace_member[\s\S]*workspace_memberships[\s\S]*user_id = auth\.uid\(\)/)
  })

  it("requires workspace permission in every CRM write policy", () => {
    for (const table of ["contacts", "companies", "leads", "deals", "clients", "projects", "tasks"]) {
      expect(migrationSql).toContain(`public.${table}`)
      expect(migrationSql).toMatch(new RegExp(`create policy [^;]+ on public\\.${table} for insert[\\s\\S]*with check`))
    }
  })

  it("relationship triggers reject guessed cross-workspace foreign keys", () => {
    for (const trigger of ["tg_contacts_same_workspace", "tg_deals_same_workspace", "tg_clients_same_workspace", "tg_projects_same_workspace", "tg_tasks_same_workspace"]) {
      expect(relationshipSql).toContain(trigger)
    }
    expect(relationshipSql).toContain("Cross-workspace company reference forbidden")
    expect(relationshipSql).toContain("Cross-workspace project reference forbidden")
  })

  it("portal access is client-explicit", () => {
    expect(helperSql).toContain("can_access_client")
    expect(migrationSql).toMatch(/client_portals[\s\S]*client_id/)
    expect(migrationSql).toContain("private.can_access_client(client_id)")
  })
})
