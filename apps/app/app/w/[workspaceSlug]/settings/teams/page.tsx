import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, Forbidden } from "@/components/app/states"
import { SettingsNav } from "@/components/app/settings-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "teams.read")) return <Forbidden />

  const teams = await db.team.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: {
      _count: { select: { memberships: true } },
      memberships: { include: { membership: { include: { user: true } } }, take: 5 },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Teams" description={`${teams.length} teams`} />
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <SettingsNav workspaceSlug={workspaceSlug} />
        </aside>
        <div className="space-y-3 lg:col-span-3">
          {teams.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No teams yet. Teams are created when members are grouped for capacity planning.
              </CardContent>
            </Card>
          ) : (
            teams.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{t.name}</CardTitle>
                    <Badge variant="outline">{t._count.memberships} members</Badge>
                  </div>
                </CardHeader>
                {t.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
