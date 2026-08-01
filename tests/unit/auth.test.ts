import { describe, it, expect } from "vitest"
import { normalizeEmail, AuthorizationError, can } from "@/lib/auth"
import type { WorkspaceContext } from "@/lib/auth"

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@BAR.com  ")).toBe("foo@bar.com")
    expect(normalizeEmail("User.Name+tag@Example.COM")).toBe("user.name+tag@example.com")
  })
})

describe("AuthorizationError", () => {
  it("has status 403", () => {
    const err = new AuthorizationError("nope")
    expect(err.status).toBe(403)
    expect(err.message).toBe("nope")
    expect(err.name).toBe("AuthorizationError")
  })
})

describe("can", () => {
  function ctx(overrides: Partial<WorkspaceContext> = {}): WorkspaceContext {
    return {
      workspaceId: "ws1",
      workspaceSlug: "ws1",
      workspaceName: "WS",
      userId: "u1",
      membershipId: "m1",
      roles: ["Team Member"],
      permissions: new Set(["crm.read", "crm.create"] as any),
      isOwner: false,
      ...overrides,
    }
  }

  it("returns true when permission is in set", () => {
    expect(can(ctx(), "crm.read")).toBe(true)
  })

  it("returns false when permission is missing", () => {
    expect(can(ctx(), "crm.delete")).toBe(false)
  })

  it("owner bypasses all checks", () => {
    const ownerCtx = ctx({ isOwner: true, permissions: new Set() })
    expect(can(ownerCtx, "workspace.delete")).toBe(true)
  })
})
