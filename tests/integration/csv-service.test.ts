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

const contractor: WorkspaceContext = {
  ...owner,
  roles: ["Contractor"],
  isOwner: false,
  permissions: new Set(["tasks.read"]),
}

describe("CSV service contract", () => {
  it("previews a contacts CSV with header detection", () => {
    const preview = previewImport(
      "contacts",
      Buffer.from(
        "firstName,lastName,email\nAvery,Chen,avery@test.com\nJordan,Kim,jordan@test.com\n"
      )
    )
    expect(preview.headers).toEqual(["firstName", "lastName", "email"])
    expect(preview.totalRows).toBe(2)
    expect(preview.suggestedMapping.email).toBe("email")
  })

  it("returns a downloadable error CSV", () => {
    const csv = buildErrorCsv([
      { row: 3, error: "Missing email", data: { firstName: "Foo", lastName: "Bar" } },
    ])
    expect(csv).toContain("row,error,firstName,lastName")
    expect(csv).toContain("3,Missing email,Foo,Bar")
  })

  it("enforces CRM permission before parsing or writing an import", async () => {
    await expect(
      executeImport(contractor, "contacts", {}, Buffer.from("email\nnope@example.com"))
    ).rejects.toThrow("Missing crm.create permission")
  })

  it("allows owner imports to reach the database write boundary", async () => {
    // The contract under test is that an owner gets PAST authorization and
    // fails at the database boundary, unlike the contractor above who is
    // stopped before anything is parsed or written.
    //
    // This previously asserted the message contained "Supabase" — the error
    // raised only when no credentials are configured. That made the test
    // depend on ambient environment: it passed on a machine with no Supabase
    // env and failed in CI, where placeholder credentials let execution get
    // one step further and die on Next's `cookies()` outside a request scope.
    // Both outcomes prove the same thing. Stubbing the env cannot fix it
    // either, because supabase/server.ts reads process.env into module-scope
    // constants at import time.
    //
    // So assert the property that actually matters and is stable: it rejects,
    // and not because of permissions.
    const error = await executeImport(
      owner,
      "contacts",
      {},
      Buffer.from("email\nnope@example.com")
    ).then(
      () => null,
      (e: unknown) => e
    )

    expect(error, "an unconfigured import must not silently succeed").toBeInstanceOf(Error)
    const message = (error as Error).message
    expect(message).not.toContain("permission")
    // Either boundary is acceptable: unconfigured client, or a configured
    // client that cannot reach a request scope outside Next.
    expect(message).toMatch(/supabase|cookies|request scope|fetch failed/i)
  })
})
