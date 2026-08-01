import Link from "next/link"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { humanStatus, classForStatus, formatDate, initials, relativeTime } from "@/lib/format"
import { Clock, ListChecks, FileCheck2, AlertTriangle } from "lucide-react"

export default async function MyWorkPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const ctx = await resolveWorkspace(workspaceSlug)

  const [assignedTasks, approvalsForUser, timeEntries, activities] = await Promise.all([
    db.task.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        assigneeId: ctx.userId,
        status: { category: { not: "done" } },
      },
      include: { project: true, status: true },
      orderBy: { dueAt: "asc" },
      take: 20,
    }),
    db.approvalRequest.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        status: "pending",
        steps: { some: { status: "pending", approverType: "user" } },
      },
      include: { requestedBy: true },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    db.timeEntry.findMany({
      where: { workspaceId: ctx.workspaceId, userId: ctx.userId, status: "open" },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    db.activityEvent.findMany({
      where: { workspaceId: ctx.workspaceId, visibility: { in: ["internal", "client"] } },
      include: { actorUser: true },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
  ])

  const overdue = assignedTasks.filter((t) => t.dueAt && new Date(t.dueAt) < new Date())

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="My work"
        description={`${assignedTasks.length} assigned · ${overdue.length} overdue · ${approvalsForUser.length} pending approvals`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                <h2 className="text-sm font-medium">Assigned tasks</h2>
                <Badge variant="outline" className="ml-auto">
                  {assignedTasks.length}
                </Badge>
              </div>
            </div>
            <div className="divide-y divide-border/40">
              {assignedTasks.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing assigned. Time for a break? 🌿
                </div>
              ) : (
                assignedTasks.map((t) => {
                  const isOverdue = t.dueAt && new Date(t.dueAt) < new Date()
                  return (
                    <Link
                      key={t.id}
                      href={
                        t.project
                          ? `/w/${workspaceSlug}/projects/${t.project.id}`
                          : `/w/${workspaceSlug}/tasks`
                      }
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t.project?.name ?? "No project"}
                          {t.dueAt && (
                            <span className={isOverdue ? "ml-2 text-danger font-medium" : "ml-2"}>
                              · Due {formatDate(t.dueAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      {t.status && (
                        <Badge variant="outline" className={classForStatus(t.status.category)}>
                          {t.status.name}
                        </Badge>
                      )}
                    </Link>
                  )
                })
              )}
            </div>
          </Card>

          {overdue.length > 0 && (
            <Card className="border-danger/30 bg-red-50/50 dark:bg-red-950/10">
              <div className="border-b border-danger/20 px-4 py-3">
                <div className="flex items-center gap-2 text-danger">
                  <AlertTriangle className="h-4 w-4" />
                  <h2 className="text-sm font-medium">Overdue</h2>
                </div>
              </div>
              <div className="divide-y divide-danger/10">
                {overdue.map((t) => (
                  <div key={t.id} className="px-4 py-2.5 text-sm">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-danger">
                      Due {t.dueAt ? formatDate(t.dueAt) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <div className="border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" />
                <h2 className="text-sm font-medium">Pending approvals</h2>
              </div>
            </div>
            <div className="divide-y divide-border/40">
              {approvalsForUser.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  None pending.
                </div>
              ) : (
                approvalsForUser.map((a) => (
                  <Link
                    key={a.id}
                    href={`/w/${workspaceSlug}/approvals/${a.id}`}
                    className="block px-4 py-2.5 hover:bg-muted/30"
                  >
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.dueAt ? `Due ${relativeTime(a.dueAt)}` : "No due date"}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <h2 className="text-sm font-medium">Open time entries</h2>
              </div>
            </div>
            <div className="divide-y divide-border/40">
              {timeEntries.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No open entries.
                </div>
              ) : (
                timeEntries.map((t) => (
                  <div key={t.id} className="px-4 py-2.5">
                    <div className="text-sm font-medium">{t.description ?? "Untitled"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {t.minutes} min · {relativeTime(t.startedAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-medium">Recent activity</h2>
            </div>
            <div className="divide-y divide-border/40">
              {activities.map((e) => (
                <div key={e.id} className="flex items-start gap-2 px-4 py-2.5 text-xs">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-[9px]">
                      {initials(e.actorUser?.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div>
                      <span className="font-medium">{e.actorUser?.displayName ?? "Someone"}</span>{" "}
                      <span className="text-muted-foreground">{e.verb.replace(/[._]/g, " ")}</span>
                    </div>
                    <div className="text-muted-foreground">{relativeTime(e.occurredAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
