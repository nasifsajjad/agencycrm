import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, Forbidden } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDateTime, initials } from "@/lib/format"
import { buildPageInfo, parsePageParams } from "@agencyos/domain"
import { Pagination } from "@/components/app/pagination"

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ entityType?: string; page?: string; pageSize?: string }>
}) {
  const { workspaceSlug } = await params
  const resolvedSearchParams = await searchParams
  const { entityType } = resolvedSearchParams
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "audit.read")) return <Forbidden />

  const pageParams = parsePageParams(resolvedSearchParams)

  const where = { workspaceId: ctx.workspaceId, entityType: entityType || undefined }
  const [events, eventCount, entityTypes] = await Promise.all([
    db.auditEvent.findMany({
      where,
      include: { actorUser: true },
      orderBy: { occurredAt: "desc" },
      skip: pageParams.skip,
      take: pageParams.take,
    }),
    db.auditEvent.count({ where }),
    db.auditEvent.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { entityType: true },
      distinct: ["entityType"],
    }),
  ])

  const pageInfo = buildPageInfo(pageParams, eventCount)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Audit log"
        description="Append-only record of permission, approval, export, and financial mutations."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <a href={`/w/${workspaceSlug}/settings/audit`}>
          <Badge variant={entityType ? "outline" : "default"} className="cursor-pointer">
            All
          </Badge>
        </a>
        {entityTypes.map((e) => (
          <a
            key={e.entityType}
            href={`/w/${workspaceSlug}/settings/audit?entityType=${e.entityType}`}
          >
            <Badge
              variant={entityType === e.entityType ? "default" : "outline"}
              className="cursor-pointer capitalize"
            >
              {e.entityType}
            </Badge>
          </a>
        ))}
      </div>

      <Card className="divide-y divide-border/40">
        {events.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No audit events.
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px]">
                  {initials(e.actorUser?.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-medium">{e.actorUser?.displayName ?? "System"}</span>{" "}
                  <code className="text-xs text-muted-foreground">{e.action}</code>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  <span className="capitalize">{e.entityType}</span>
                  {e.entityId && <span> · {e.entityId.slice(0, 8)}…</span>}
                  <span> · {formatDateTime(e.occurredAt)}</span>
                </div>
                {e.beforeJson || e.afterJson ? (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View changes
                    </summary>
                    <div className="mt-1 grid gap-2 sm:grid-cols-2">
                      {e.beforeJson && (
                        <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">
                          {JSON.stringify(e.beforeJson, null, 2)}
                        </pre>
                      )}
                      {e.afterJson && (
                        <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">
                          {JSON.stringify(e.afterJson, null, 2)}
                        </pre>
                      )}
                    </div>
                  </details>
                ) : null}
              </div>
            </div>
          ))
        )}
        <Pagination
          info={pageInfo}
          basePath={`/w/${workspaceSlug}/settings/audit`}
          searchParams={resolvedSearchParams}
          label="events"
          className="px-4"
        />
      </Card>
    </div>
  )
}
