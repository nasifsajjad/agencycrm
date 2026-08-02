import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { PageHeader, EmptyState } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BellOff, Check } from "lucide-react"
import { relativeTime } from "@/lib/format"
import { MarkAllReadButton, MarkReadButton } from "@/components/app/notification-actions"
import { buildPageInfo, parsePageParams } from "@agencyos/domain"
import { Pagination } from "@/components/app/pagination"

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const { workspaceSlug } = await params
  const resolvedSearchParams = await searchParams
  const ctx = await resolveWorkspace(workspaceSlug)

  const pageParams = parsePageParams(resolvedSearchParams)

  const where = { workspaceId: ctx.workspaceId, userId: ctx.userId }
  const [notifications, notificationCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pageParams.skip,
      take: pageParams.take,
    }),
    db.notification.count({ where }),
  ])

  const pageInfo = buildPageInfo(pageParams, notificationCount)

  const unreadCount = notifications.filter((n) => !n.readAt).length

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread`}
        action={unreadCount > 0 ? <MarkAllReadButton workspaceSlug={workspaceSlug} /> : undefined}
      />
      {notifications.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up." />
      ) : (
        <Card className="divide-y divide-border/40">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 ${n.readAt ? "" : "bg-brand/5"}`}
            >
              <div
                className={`mt-1 h-2 w-2 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {relativeTime(n.createdAt)}
                </div>
              </div>
              {!n.readAt && <MarkReadButton workspaceSlug={workspaceSlug} id={n.id} />}
            </div>
          ))}
          <Pagination
            info={pageInfo}
            basePath={`/w/${workspaceSlug}/notifications`}
            searchParams={resolvedSearchParams}
            label="notifications"
            className="px-4"
          />
        </Card>
      )}
    </div>
  )
}
