import { redirect } from "next/navigation"
import { getCurrentUser, getWorkspaceContext } from "@/lib/auth"
import { AppShell } from "@/components/app/shell"
import { AuthorizationError } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/sign-in?next=/w/${workspaceSlug}`)

  const ctx = await getWorkspaceContext(workspaceSlug, user)
  if (!ctx) redirect("/app")

  const [memberships, notifications] = await Promise.all([
    db.workspaceMembership.findMany({
      where: { userId: user.id, status: "active" },
      include: { workspace: true },
    }),
    db.notification.findMany({
      where: { workspaceId: ctx.workspaceId, userId: user.id, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ])

  return (
    <AppShell
      ctx={{
        workspaceId: ctx.workspaceId,
        workspaceSlug: ctx.workspaceSlug,
        workspaceName: ctx.workspaceName,
        userId: ctx.userId,
        membershipId: ctx.membershipId,
        roles: ctx.roles,
        isOwner: ctx.isOwner,
        permissions: Array.from(ctx.permissions) as string[],
      }}
      user={{ id: user.id, email: user.email, displayName: user.displayName }}
      workspaces={memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
      }))}
      notifications={notifications}
    >
      {children}
    </AppShell>
  )
}

export { AuthorizationError }
