import Link from "next/link"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { humanStatus, classForStatus, relativeTime, formatDate } from "@/lib/format"
import { buildPageInfo, parsePageParams } from "@agencyos/domain"
import { Pagination } from "@/components/app/pagination"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ApprovalRequestDialog } from "@/components/app/approval-request-form"

export default async function ApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const { workspaceSlug } = await params
  const resolvedSearchParams = await searchParams
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "approvals.read")) return <Forbidden />

  const pageParams = parsePageParams(resolvedSearchParams)

  const canRequest = can(ctx, "approvals.request")

  const where = { workspaceId: ctx.workspaceId }
  const [approvals, approvalCount, members] = await Promise.all([
    db.approvalRequest.findMany({
      where,
      include: {
        requestedBy: true,
        steps: true,
        events: { orderBy: { occurredAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: pageParams.skip,
      take: pageParams.take,
    }),
    db.approvalRequest.count({ where }),
    canRequest
      ? db.workspaceMembership.findMany({
          where: { workspaceId: ctx.workspaceId, status: "active" },
          include: { user: { select: { id: true, displayName: true, email: true } } },
        })
      : Promise.resolve([]),
  ])

  const approvers = members
    .map((membership) => ({
      id: membership.user?.id ?? "",
      name: membership.user?.displayName ?? membership.user?.email ?? "Unknown",
      email: membership.user?.email ?? "",
    }))
    .filter((approver) => approver.id)

  const pageInfo = buildPageInfo(pageParams, approvalCount)

  const pending = approvals.filter((a) => a.status === "pending")
  const decided = approvals.filter((a) => a.status !== "pending")

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Approvals"
        description={`${pending.length} pending · ${decided.length} decided`}
        action={
          canRequest && (
            <Button size="sm" asChild>
              <Link href={`/w/${workspaceSlug}/projects`}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Request approval
              </Link>
            </Button>
          )
        }
      />
      {approvals.length === 0 ? (
        <EmptyState
          title="No approvals yet"
          description={
            canRequest
              ? "An approval always belongs to a record. Open a project and use Request approval there."
              : "Approvals raised by your team will appear here."
          }
          action={
            canRequest
              ? { label: "Browse projects", href: `/w/${workspaceSlug}/projects` }
              : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Pending
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {pending.map((a) => (
                  <ApprovalCard key={a.id} approval={a} workspaceSlug={workspaceSlug} />
                ))}
              </div>
            </div>
          )}
          {decided.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Decided
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {decided.map((a) => (
                  <ApprovalCard key={a.id} approval={a} workspaceSlug={workspaceSlug} />
                ))}
              </div>
            </div>
          )}
          <Pagination
            info={pageInfo}
            basePath={`/w/${workspaceSlug}/approvals`}
            searchParams={resolvedSearchParams}
            label="approvals"
            className="px-4"
          />
        </div>
      )}
    </div>
  )
}

function ApprovalCard({ approval, workspaceSlug }: { approval: any; workspaceSlug: string }) {
  const dueSoon =
    approval.dueAt &&
    new Date(approval.dueAt) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) &&
    approval.status === "pending"
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/w/${workspaceSlug}/approvals/${approval.id}`} className="min-w-0 flex-1">
          <div className="truncate font-medium hover:underline">{approval.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            v{approval.versionNumber} · {approval.entityType}
          </div>
        </Link>
        <Badge variant="outline" className={classForStatus(approval.status)}>
          {humanStatus(approval.status)}
        </Badge>
      </div>
      {approval.instructions && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{approval.instructions}</p>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Requested by {approval.requestedBy?.displayName ?? "—"}</span>
        {approval.dueAt && (
          <span className={dueSoon ? "text-danger font-medium" : ""}>
            Due {formatDate(approval.dueAt)}
          </span>
        )}
      </div>
    </Card>
  )
}
