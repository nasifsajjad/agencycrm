import { describe, it, expect } from "vitest"
import { PERMISSIONS, ROLE_PERMISSIONS, isSystemRole } from "@/lib/permissions"

describe("permissions catalogue", () => {
  it("contains the required permission keys from the contract", () => {
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
    for (const key of required) {
      expect(PERMISSIONS).toContain(key)
    }
  })

  it("Owner role receives all permissions", () => {
    expect(ROLE_PERMISSIONS.Owner.length).toBe(PERMISSIONS.length)
  })

  it("Administrator receives all permissions except workspace.delete", () => {
    expect(ROLE_PERMISSIONS.Administrator).not.toContain("workspace.delete")
    expect(ROLE_PERMISSIONS.Administrator.length).toBe(PERMISSIONS.length - 1)
  })

  it("Contractor role is restricted to a small set", () => {
    expect(ROLE_PERMISSIONS.Contractor).not.toContain("crm.read")
    expect(ROLE_PERMISSIONS.Contractor).not.toContain("finance.read")
    expect(ROLE_PERMISSIONS.Contractor).not.toContain("members.read")
    expect(ROLE_PERMISSIONS.Contractor).toContain("tasks.read")
    expect(ROLE_PERMISSIONS.Contractor).toContain("tasks.update")
  })

  it("Client role cannot read internal CRM or finance", () => {
    expect(ROLE_PERMISSIONS.Client).not.toContain("crm.read")
    expect(ROLE_PERMISSIONS.Client).not.toContain("finance.read")
    expect(ROLE_PERMISSIONS.Client).toContain("approvals.decide")
  })

  it("isSystemRole identifies the 10 default roles", () => {
    expect(isSystemRole("Owner")).toBe(true)
    expect(isSystemRole("Administrator")).toBe(true)
    expect(isSystemRole("Operations")).toBe(true)
    expect(isSystemRole("Sales")).toBe(true)
    expect(isSystemRole("Account Manager")).toBe(true)
    expect(isSystemRole("Team Member")).toBe(true)
    expect(isSystemRole("Contractor")).toBe(true)
    expect(isSystemRole("Finance")).toBe(true)
    expect(isSystemRole("Client")).toBe(true)
    expect(isSystemRole("Guest Reviewer")).toBe(true)
    expect(isSystemRole("Custom")).toBe(false)
  })
})
