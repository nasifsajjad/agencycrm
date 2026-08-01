import Link from "next/link"
import { db } from "@/lib/db"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/app/states"
import { classForStatus, humanStatus, formatDate } from "@/lib/format"

async function getPortal(slug: string) {
  return db.clientPortal.findUnique({
    where: { slug },
    include: { client: true, workspace: true },
  })
}

export default async function PortalProjectsPage({
  params,
}: {
  params: Promise<{ portalSlug: string }>
}) {
  const { portalSlug } = await params
  const portal = await getPortal(portalSlug)
  if (!portal) return null
  const projects = await db.project.findMany({
    where: { workspaceId: portal.workspaceId, clientId: portal.clientId, visibility: "client" },
    include: { status: true, owner: true, _count: { select: { tasks: true } } },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div>
      <PageHeader title="Projects" description="Shared projects and their status" />
      {projects.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">No projects shared.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{p.name}</div>
                  {p.code && <div className="text-xs text-muted-foreground">{p.code}</div>}
                </div>
                {p.status && (
                  <Badge variant="outline" className={classForStatus(p.status.category)}>
                    {p.status.name}
                  </Badge>
                )}
              </div>
              {p.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{p._count.tasks} tasks</span>
                {p.dueDate && <span>Due {formatDate(p.dueDate)}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
