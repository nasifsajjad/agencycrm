import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AcceptInviteForm } from "@/components/auth/accept-invite-form"

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) redirect("/sign-in")

  // Find invitation by token hash (we stored bcrypt hash, so we need to iterate)
  // In local mode, we'll do a linear scan and compare with bcrypt
  const invitations = await db.invitation.findMany({
    where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { workspace: true, roles: { include: { role: true } } },
  })

  const bcrypt = await import("bcryptjs")
  let matched: (typeof invitations)[number] | null = null
  for (const inv of invitations) {
    const ok = await bcrypt.compare(token, inv.tokenHash)
    if (ok) {
      matched = inv
      break
    }
  }

  if (!matched) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Invitation not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This invite link is invalid, expired, or has already been used. Please ask your
            workspace admin to send a new invitation.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Accept invitation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;ve been invited to join <strong>{matched.workspace.name}</strong>
          {matched.roles.length > 0 && (
            <>
              {" "}
              as <strong>{matched.roles.map((r) => r.role.name).join(", ")}</strong>
            </>
          )}
          .
        </p>
        <AcceptInviteForm
          invitationId={matched.id}
          workspaceSlug={matched.workspace.slug}
          email={matched.emailNormalized}
          roles={matched.roles.map((r) => ({ id: r.role.id, name: r.role.name }))}
        />
      </div>
    </div>
  )
}
