import Link from "next/link"
import { Plus } from "lucide-react"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ProjectFormDialog } from "@/components/app/project-form"
import { humanStatus, classForStatus, formatDate, formatMoney, initials } from "@/lib/format"

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ new?: string }>
}) {
  const { workspaceSlug } = await params
  const { new: isNew } = await searchParams
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "projects.read")) return <Forbidden />

  const [projects, clients, statuses] = await Promise.all([
    db.project.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        client: true,
        status: true,
        owner: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.client.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
    }),
    db.projectStatus.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { position: "asc" },
    }),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Projects"
        description={`${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
        action={
          can(ctx, "projects.create") && (
            <ProjectFormDialog
              workspaceSlug={workspaceSlug}
              clients={clients}
              statuses={statuses}
              defaultOpen={isNew === "1"}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New project
                </Button>
              }
            />
          )
        }
      />
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project from a template or from scratch."
          action={
            can(ctx, "projects.create")
              ? { label: "New project", href: `/w/${workspaceSlug}/projects?new=1` }
              : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Project</th>
                  <th className="px-4 py-2 text-left font-medium">Client</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Owner</th>
                  <th className="px-4 py-2 text-left font-medium">Due</th>
                  <th className="px-4 py-2 text-right font-medium">Budget</th>
                  <th className="px-4 py-2 text-right font-medium">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/w/${workspaceSlug}/projects/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.code && (
                        <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.client?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {p.status && (
                        <Badge variant="outline" className={classForStatus(p.status.category)}>
                          {p.status.name}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.owner && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px]">
                              {initials(p.owner.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {p.owner.displayName}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {p.dueDate ? formatDate(p.dueDate) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {p.budgetMinor > 0 ? formatMoney(p.budgetMinor) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {p._count.tasks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
