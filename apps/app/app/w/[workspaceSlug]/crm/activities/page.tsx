import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Circle,
  Phone,
  Mail,
  CalendarClock,
  StickyNote,
  ListTodo,
} from "lucide-react"
import { ActivityCompleteButton } from "@/components/app/activity-complete-button"
import { formatDateTime, relativeTime } from "@/lib/format"
import { buildPageInfo, parsePageParams } from "@agencyos/domain"
import { Pagination } from "@/components/app/pagination"

const TYPE_ICON = {
  call: Phone,
  email: Mail,
  meeting: CalendarClock,
  task: ListTodo,
  note: StickyNote,
} as const

export default async function ActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const { workspaceSlug } = await params
  const resolvedSearchParams = await searchParams
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "crm.read")) return <Forbidden />

  const pageParams = parsePageParams(resolvedSearchParams)

  const where = { workspaceId: ctx.workspaceId }
  const [activities, activityCount] = await Promise.all([
    db.activity.findMany({
      where,
      include: { owner: true, contact: true, deal: true },
      orderBy: { createdAt: "desc" },
      skip: pageParams.skip,
      take: pageParams.take,
    }),
    db.activity.count({ where }),
  ])

  const pageInfo = buildPageInfo(pageParams, activityCount)

  const overdue = activities.filter((a) => a.dueAt && !a.completedAt && a.dueAt < new Date())
  const today = activities.filter((a) => {
    if (!a.dueAt || a.completedAt) return false
    const today = new Date()
    return a.dueAt.toDateString() === today.toDateString()
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Activities"
        description={`${pageInfo.total} activities · ${overdue.length} overdue · ${today.length} due today`}
      />
      {activities.length === 0 ? (
        <EmptyState
          title="No activities yet"
          description="Activities are created from contact, deal, and project pages."
        />
      ) : (
        <Card className="divide-y divide-border/40">
          {activities.map((a) => {
            const Icon = TYPE_ICON[a.activityType as keyof typeof TYPE_ICON] ?? ListTodo
            const isOverdue = a.dueAt && !a.completedAt && a.dueAt < new Date()
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-md ${a.completedAt ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-foreground/5 text-foreground"}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`truncate text-sm font-medium ${a.completedAt ? "line-through text-muted-foreground" : ""}`}
                    >
                      {a.subject ?? a.body?.slice(0, 80) ?? "Untitled activity"}
                    </span>
                    <Badge variant="outline" className="capitalize">
                      {a.activityType}
                    </Badge>
                    {isOverdue && (
                      <Badge
                        variant="outline"
                        className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      >
                        Overdue
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.contact && (
                      <span>
                        {a.contact.firstName} {a.contact.lastName} ·{" "}
                      </span>
                    )}
                    {a.deal && <span>{a.deal.name} · </span>}
                    {a.dueAt && (
                      <span>
                        Due {formatDateTime(a.dueAt)} ({relativeTime(a.dueAt)})
                      </span>
                    )}
                    {!a.dueAt && <span>Created {relativeTime(a.createdAt)}</span>}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {a.owner?.displayName ?? "—"}
                </div>
                {can(ctx, "crm.update") && !a.completedAt && (
                  <ActivityCompleteButton workspaceSlug={workspaceSlug} id={a.id} />
                )}
              </div>
            )
          })}
          <Pagination
            info={pageInfo}
            basePath={`/w/${workspaceSlug}/crm/activities`}
            searchParams={resolvedSearchParams}
            label="activities"
            className="px-4"
          />
        </Card>
      )}
    </div>
  )
}
