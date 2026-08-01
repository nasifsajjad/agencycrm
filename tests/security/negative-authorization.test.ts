import { describe, expect, it } from "vitest"
import { can, isSafeRedirect, type WorkspaceContext } from "@/lib/auth"
import { ROLE_PERMISSIONS } from "@/lib/permissions"

function context(roles: string[], permissions: string[] = []): WorkspaceContext {
  return {
    workspaceId: "workspace-a",
    workspaceSlug: "agency-a",
    workspaceName: "Agency A",
    userId: "user-a",
    membershipId: "membership-a",
    roles,
    permissions: new Set(permissions as never[]),
    isOwner: roles.includes("Owner"),
  }
}

describe("server authorization behavior", () => {
  it("contractors cannot read CRM or finance", () => {
    const ctx = context(["Contractor"], ROLE_PERMISSIONS.Contractor)
    expect(can(ctx, "tasks.read")).toBe(true)
    expect(can(ctx, "crm.read")).toBe(false)
    expect(can(ctx, "finance.read")).toBe(false)
  })

  it("clients cannot read internal CRM or finance", () => {
    const ctx = context(["Client"], ROLE_PERMISSIONS.Client)
    expect(can(ctx, "approvals.decide")).toBe(true)
    expect(can(ctx, "crm.read")).toBe(false)
    expect(can(ctx, "finance.read")).toBe(false)
  })

  it("finance cannot update clients", () => {
    const ctx = context(["Finance"], ROLE_PERMISSIONS.Finance)
    expect(can(ctx, "finance.manage")).toBe(true)
    expect(can(ctx, "clients.update")).toBe(false)
  })

  it("owner is the only implicit all-permission role", () => {
    expect(can(context(["Owner"]), "workspace.delete")).toBe(true)
    expect(can(context(["Administrator"], ROLE_PERMISSIONS.Administrator), "workspace.delete")).toBe(false)
  })

  it("safe redirect rejects external and protocol-relative targets", () => {
    expect(isSafeRedirect("/dashboard")).toBe("/dashboard")
    expect(isSafeRedirect("//evil.example")).toBe("/")
    expect(isSafeRedirect("https://evil.example")).toBe("/")
    expect(isSafeRedirect("javascript:alert(1)")).toBe("/")
  })
})
