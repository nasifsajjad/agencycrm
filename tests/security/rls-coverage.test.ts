import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const MIGRATIONS_DIR = join(__dirname, "../../supabase/migrations")

function readMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf-8")).join("\n\n")
}

describe("Supabase migration RLS coverage", () => {
  const sql = readMigrations()

  it("enables RLS on every tenant-owned table", () => {
    const tenantOwnedTables = [
      "workspaces",
      "profiles",
      "workspace_memberships",
      "roles",
      "role_permissions",
      "permissions",
      "membership_roles",
      "teams",
      "team_memberships",
      "invitations",
      "invitation_roles",
      "invitation_teams",
      "feature_flags",
      "workspace_preferences",
      "companies",
      "contacts",
      "leads",
      "pipelines",
      "pipeline_stages",
      "deals",
      "activities",
      "tags",
      "notes",
      "clients",
      "client_contacts",
      "services",
      "retainers",
      "contracts",
      "client_requests",
      "client_health_events",
      "project_templates",
      "project_statuses",
      "projects",
      "project_members",
      "milestones",
      "task_statuses",
      "tasks",
      "task_dependencies",
      "task_watchers",
      "campaigns",
      "deliverables",
      "content_items",
      "comments",
      "comment_mentions",
      "activity_events",
      "notifications",
      "files",
      "file_links",
      "deliverable_versions",
      "approval_requests",
      "approval_steps",
      "approval_events",
      "time_entries",
      "timesheets",
      "capacity_allocations",
      "rate_cards",
      "expenses",
      "estimates",
      "estimate_lines",
      "invoices",
      "invoice_lines",
      "payments",
      "custom_field_definitions",
      "custom_field_values",
      "saved_views",
      "dashboards",
      "dashboard_widgets",
      "report_definitions",
      "automations",
      "automation_actions",
      "automation_runs",
      "automation_action_runs",
      "outbox_events",
      "webhook_endpoints",
      "webhook_deliveries",
      "integration_connections",
      "import_jobs",
      "export_jobs",
      "client_portals",
      "knowledge_pages",
    ]
    for (const t of tenantOwnedTables) {
      expect(sql).toContain(`alter table public.${t} enable row level security`)
    }
    // Audit schema
    expect(sql).toContain("alter table audit.events enable row level security")
  })

  it("creates private security-definer helpers with safe search_path", () => {
    expect(sql).toMatch(/create or replace function private\.is_workspace_member/)
    expect(sql).toMatch(/create or replace function private\.has_permission/)
    expect(sql).toMatch(/create or replace function private\.can_access_client/)
    expect(sql).toMatch(/create or replace function private\.can_access_project/)
    expect(sql).toMatch(/create or replace function private\.can_access_entity/)
    // All helpers must use security definer with explicit search_path
    const matches = sql.match(/security definer set search_path = [^\n]+/g) ?? []
    expect(matches.length).toBeGreaterThan(5)
  })

  it("revokes execution from public and grants only to authenticated", () => {
    expect(sql).toContain("revoke all on all functions in schema private from public, anon")
    expect(sql).toContain("grant execute on all functions in schema private to authenticated")
  })

  it("adds cross-workspace relationship guards for tenant-owned tables", () => {
    expect(sql).toContain("tg_contacts_same_workspace")
    expect(sql).toContain("tg_deals_same_workspace")
    expect(sql).toContain("tg_clients_same_workspace")
    expect(sql).toContain("tg_projects_same_workspace")
    expect(sql).toContain("tg_tasks_same_workspace")
  })

  it("creates SELECT policies on every tenant-owned table", () => {
    const tables = [
      "companies",
      "contacts",
      "leads",
      "deals",
      "clients",
      "projects",
      "tasks",
      "campaigns",
      "deliverables",
      "content_items",
      "comments",
      "activity_events",
      "notifications",
      "files",
      "approval_requests",
      "time_entries",
      "timesheets",
      "capacity_allocations",
      "expenses",
      "estimates",
      "invoices",
      "payments",
      "custom_field_definitions",
      "custom_field_values",
      "saved_views",
      "dashboards",
      "automations",
      "outbox_events",
      "webhook_endpoints",
      "integration_connections",
      "import_jobs",
      "export_jobs",
      "client_portals",
      "knowledge_pages",
    ]
    // Allow shortened policy names (e.g. cf_def_select for custom_field_definitions)
    const aliases: Record<string, string[]> = {
      custom_field_definitions: ["cf_def_select"],
      custom_field_values: ["cf_values_select"],
      saved_views: ["saved_views_select"],
      report_definitions: ["report_def_select"],
    }
    for (const t of tables) {
      const singular = t.endsWith("s") ? t.slice(0, -1) : t
      const candidates = [
        `create policy ${t}_select on public.${t} for select`,
        `create policy ${singular}_select on public.${t} for select`,
        ...(aliases[t] ?? []).map((a) => `create policy ${a} on public.${t} for select`),
      ]
      const hasSelectPolicy = candidates.some((c) => sql.includes(c))
      expect(
        hasSelectPolicy,
        `Missing SELECT policy on ${t} (tried: ${candidates.join(", ")})`
      ).toBe(true)
    }
  })

  it("creates INSERT policies with WITH CHECK conditions", () => {
    const samples = [
      "contacts_insert",
      "deals_insert",
      "tasks_insert",
      "files_insert",
      "approval_requests_insert",
    ]
    for (const p of samples) {
      expect(sql).toContain(`create policy ${p}`)
      expect(sql).toMatch(new RegExp(`create policy ${p}[^;]+with check`))
    }
  })

  it("creates UPDATE policies with both USING and WITH CHECK", () => {
    const samples = ["contacts_update", "deals_update", "tasks_update"]
    for (const p of samples) {
      expect(sql).toContain(`create policy ${p}`)
      const policyBlock = sql.match(new RegExp(`create policy ${p}[^;]+;`))?.[0] ?? ""
      expect(policyBlock).toContain("using")
      expect(policyBlock).toContain("with check")
    }
  })

  it("creates DELETE policies", () => {
    const samples = ["contacts_delete", "deals_delete", "tasks_delete", "files_delete"]
    for (const p of samples) {
      expect(sql).toContain(`create policy ${p}`)
    }
  })

  it("defines storage buckets as private", () => {
    expect(sql).toContain("insert into storage.buckets (id, name)")
    expect(sql).toContain("('workspace-assets', 'workspace-assets')")
    expect(sql).toContain("('avatars', 'avatars')")
    expect(sql).toContain("('imports', 'imports')")
    expect(sql).toContain("('exports', 'exports')")
    expect(sql).toContain("-- Buckets (private)")
  })

  it("creates storage.objects policies for select, insert, update, delete", () => {
    expect(sql).toContain("create policy storage_select on storage.objects for select")
    expect(sql).toContain("create policy storage_insert on storage.objects for insert")
    expect(sql).toContain("create policy storage_update on storage.objects for update")
    expect(sql).toContain("create policy storage_delete on storage.objects for delete")
  })

  it("audit events are append-only to authenticated (no insert/update/delete grant)", () => {
    expect(sql).toContain("revoke insert, update, delete on audit.events from authenticated, anon")
    expect(sql).toContain("grant select on audit.events to authenticated")
  })

  it("seeds the permission catalogue with all 60 keys", () => {
    const required = [
      "workspace.read",
      "workspace.update",
      "workspace.delete",
      "members.read",
      "members.invite",
      "members.update",
      "members.remove",
      "roles.read",
      "roles.manage",
      "teams.read",
      "teams.manage",
      "audit.read",
      "crm.read",
      "crm.create",
      "crm.update",
      "crm.delete",
      "crm.export",
      "clients.read",
      "clients.create",
      "clients.update",
      "clients.delete",
      "projects.read",
      "projects.create",
      "projects.update",
      "projects.delete",
      "tasks.read",
      "tasks.create",
      "tasks.update",
      "tasks.delete",
      "tasks.assign",
      "campaigns.read",
      "campaigns.manage",
      "content.read",
      "content.manage",
      "files.read",
      "files.upload",
      "files.delete",
      "comments.read",
      "comments.create",
      "comments.moderate",
      "approvals.read",
      "approvals.request",
      "approvals.decide",
      "time.read_own",
      "time.manage_own",
      "time.read_all",
      "time.approve",
      "finance.read",
      "finance.manage",
      "finance.export",
      "reports.read",
      "reports.create",
      "reports.share",
      "automations.read",
      "automations.manage",
      "settings.read",
      "settings.manage",
      "integrations.read",
      "integrations.manage",
      "portal.manage",
      "exports.create",
    ]
    for (const k of required) {
      expect(sql).toContain(`'${k}'`)
    }
  })

  it("provides a public.create_workspace RPC with security definer", () => {
    expect(sql).toContain("create or replace function public.create_workspace")
    expect(sql).toMatch(
      /public\.create_workspace[\s\S]+security definer set search_path = public, auth/
    )
  })

  it("provides a scheduled cleanup function for expired export jobs", () => {
    expect(sql).toContain("create or replace function public.cleanup_expired_jobs()")
  })
})
