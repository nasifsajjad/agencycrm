import { describe, expect, it } from "vitest"
import { buildErrorCsv, executeImport, previewImport } from "@/lib/csv-service"
import type { WorkspaceContext } from "@/lib/auth"

const owner: WorkspaceContext = {
  workspaceId: "workspace-a",
  workspaceSlug: "agency-a",
  workspaceName: "Agency A",
  userId: "user-a",
  membershipId: "membership-a",
  roles: ["Owner"],
  permissions: new Set(),
  isOwner: true,
}

const contractor: WorkspaceContext = { ...owner, roles: ["Contractor"], isOwner: false, permissions: new Set(["tasks.read"]) }

describe("CSV service contract", () => {
  it("previews a contacts CSV with header detection", () => {
    const preview = previewImport("contacts", Buffer.from("firstName,lastName,email\nAvery,Chen,avery@test.com\nJordan,Kim,jordan@test.com\n"))
    expect(preview.headers).toEqual(["firstName", "lastName", "email"])
    expect(preview.totalRows).toBe(2)
    expect(preview.suggestedMapping.email).toBe("email")
  })

  it("returns a downloadable error CSV", () => {
    const csv = buildErrorCsv([{ row: 3, error: "Missing email", data: { firstName: "Foo", lastName: "Bar" } }])
    expect(csv).toContain("row,error,firstName,lastName")
    expect(csv).toContain("3,Missing email,Foo,Bar")
  })

  it("enforces CRM permission before parsing or writing an import", async () => {
    await expect(executeImport(contractor, "contacts", {}, Buffer.from("email\nnope@example.com"))).rejects.toThrow("Missing crm.create permission")
  })

  it("allows owner imports to reach the Supabase write boundary", async () => {
    // No Supabase credentials are supplied to unit runs; the boundary must be
    // reached after authorization and fail closed with a configuration error.
    await expect(executeImport(owner, "contacts", {}, Buffer.from("email\nnope@example.com"))).rejects.toThrow("Supabase")
  })
})
