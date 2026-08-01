import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { db } from "@/lib/db"
import { previewImport, executeImport, exportToCsv, buildErrorCsv } from "@/lib/csv-service"
import { hashPassword } from "@/lib/auth"
import { bootstrapWorkspace } from "@/lib/workspace"
import type { WorkspaceContext } from "@/lib/auth"

let ctx: WorkspaceContext
let userEmail: string

async function freshWorkspace(): Promise<WorkspaceContext> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@aos-test.dev`
  const user = await db.user.create({
    data: {
      email,
      emailNormalized: email,
      passwordHash: await hashPassword("test-password-12345"),
      displayName: "Test User",
    },
  })
  const { workspaceId, membershipId } = await bootstrapWorkspace({
    name: `Test Workspace ${Date.now()}`,
    slug: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ownerId: user.id,
  })
  return {
    workspaceId,
    workspaceSlug: "test",
    workspaceName: "Test",
    userId: user.id,
    membershipId,
    roles: ["Owner"],
    permissions: new Set(),
    isOwner: true,
  }
}

describe("csv-service", () => {
  beforeEach(async () => {
    // Clean order matters
    await db.outboxEvent.deleteMany()
    await db.notification.deleteMany()
    await db.auditEvent.deleteMany()
    await db.fileLink.deleteMany()
    await db.fileRecord.deleteMany()
    await db.timeEntry.deleteMany()
    await db.invoiceLine.deleteMany()
    await db.invoice.deleteMany()
    await db.expense.deleteMany()
    await db.task.deleteMany()
    await db.project.deleteMany()
    await db.deliverable.deleteMany()
    await db.campaign.deleteMany()
    await db.clientRequest.deleteMany()
    await db.clientHealthEvent.deleteMany()
    await db.retainer.deleteMany()
    await db.contract.deleteMany()
    await db.clientPortal.deleteMany()
    await db.clientContact.deleteMany()
    await db.client.deleteMany()
    await db.lead.deleteMany()
    await db.deal.deleteMany()
    await db.activity.deleteMany()
    await db.note.deleteMany()
    await db.contact.deleteMany()
    await db.company.deleteMany()
    await db.session.deleteMany()
    await db.invitation.deleteMany()
    await db.workspaceMembership.deleteMany()
    await db.workspace.deleteMany()
    await db.user.deleteMany()

    ctx = await freshWorkspace()
    userEmail = ctx.userId
  })

  afterEach(async () => {
    // Same cleanup
  })

  it("previews a contacts CSV with header detection", () => {
    const csv = Buffer.from(
      "firstName,lastName,email\nAvery,Chen,avery@test.com\nJordan,Kim,jordan@test.com\n"
    )
    const preview = previewImport("contacts", csv)
    expect(preview.headers).toContain("firstName")
    expect(preview.headers).toContain("lastName")
    expect(preview.headers).toContain("email")
    expect(preview.totalRows).toBe(2)
    expect(preview.suggestedMapping["firstName"]).toBe("firstName")
    expect(preview.suggestedMapping["email"]).toBe("email")
  })

  it("executes a contacts import and creates rows", async () => {
    const csv = Buffer.from(
      "firstName,lastName,email\nAvery,Chen,avery@test.com\nJordan,Kim,jordan@test.com\n"
    )
    const mapping = { firstName: "firstName", lastName: "lastName", email: "email" }
    const result = await executeImport(ctx, "contacts", mapping, csv)
    expect(result.created).toBe(2)
    expect(result.errored).toBe(0)
    const contacts = await db.contact.findMany({ where: { workspaceId: ctx.workspaceId } })
    expect(contacts.length).toBe(2)
  })

  it("updates existing contacts on re-import with same email", async () => {
    const csv1 = Buffer.from("firstName,lastName,email\nAvery,Chen,avery@test.com\n")
    const csv2 = Buffer.from("firstName,lastName,email\nAvery,Chen-Updated,avery@test.com\n")
    const mapping = { firstName: "firstName", lastName: "lastName", email: "email" }
    await executeImport(ctx, "contacts", mapping, csv1)
    const result = await executeImport(ctx, "contacts", mapping, csv2)
    expect(result.updated).toBe(1)
    expect(result.created).toBe(0)
    const c = await db.contact.findFirstOrThrow({
      where: { workspaceId: ctx.workspaceId, email: "avery@test.com" },
    })
    expect(c.lastName).toBe("Chen-Updated")
  })

  it("exports contacts to CSV with header row", async () => {
    await db.contact.create({
      data: {
        workspaceId: ctx.workspaceId,
        firstName: "Avery",
        lastName: "Chen",
        email: "avery@test.com",
        ownerId: ctx.userId,
      },
    })
    const { csv, count } = await exportToCsv(ctx, "contacts")
    expect(count).toBe(1)
    expect(csv).toContain("firstName,lastName,email")
    expect(csv).toContain("Avery,Chen,avery@test.com")
  })

  it("buildErrorCsv produces a downloadable error file", () => {
    const errs = [{ row: 3, error: "Missing email", data: { firstName: "Foo", lastName: "Bar" } }]
    const csv = buildErrorCsv(errs)
    expect(csv).toContain("row,error,firstName,lastName")
    expect(csv).toContain("3,Missing email,Foo,Bar")
  })

  it("exports audit log when audit.read permission is granted", async () => {
    await db.auditEvent.create({
      data: {
        workspaceId: ctx.workspaceId,
        action: "test.action",
        entityType: "test",
        entityId: "x",
      },
    })
    const { csv, count } = await exportToCsv(ctx, "audit")
    expect(count).toBe(1)
    expect(csv).toContain("test.action")
  })
})
