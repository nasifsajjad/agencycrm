import { redirect } from "next/navigation"
import { createHash } from "node:crypto"
import { AcceptInviteForm } from "@/components/auth/accept-invite-form"
import { createServerClient } from "@/lib/supabase/server"

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) redirect("/sign-in")

  const supabase = await createServerClient()
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const { data: invitationRows } = supabase ? await supabase.rpc("get_invitation", { p_token_hash: tokenHash }) : { data: null }
  const first = invitationRows?.[0]
  const matched = first ? {
    id: first.invitation_id,
    emailNormalized: first.email_normalized,
    workspace: { name: first.workspace_name, slug: first.workspace_slug },
    roles: (invitationRows ?? []).map((row) => ({ role: { id: row.role_id, name: row.role_name } })),
  } : null

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
