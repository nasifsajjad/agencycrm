import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, Forbidden } from "@/components/app/states"
import { SettingsNav } from "@/components/app/settings-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PERMISSIONS } from "@/lib/permissions"

export default async function RolesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "roles.read")) return <Forbidden />

  const roles = await db.role.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Roles & permissions"
        description={`${roles.length} roles · ${PERMISSIONS.length} permissions in catalogue`}
      />
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <SettingsNav workspaceSlug={workspaceSlug} />
        </aside>
        <div className="space-y-3 lg:col-span-3">
          {roles.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{r.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r._count.memberships} members</Badge>
                    {r.isSystem && <Badge variant="outline">System</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map((p) => (
                    <code
                      key={p.permission.key}
                      className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px]"
                    >
                      {p.permission.key}
                    </code>
                  ))}
                  {r.permissions.length === 0 && (
                    <span className="text-xs text-muted-foreground">No permissions assigned.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
