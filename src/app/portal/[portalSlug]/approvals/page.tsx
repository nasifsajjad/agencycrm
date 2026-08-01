import { db } from "@/lib/db"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader, EmptyState } from "@/components/app/states"
import { classForStatus, humanStatus, formatDate, relativeTime } from "@/lib/format"
import { PortalApprovalDecision } from "@/components/portal/approval-decision"

export default async function PortalApprovalsPage({
  params,
}: {
  params: Promise<{ portalSlug: string }>
}) {
  const { portalSlug } = await params
  const portal = await db.clientPortal.findUnique({
    where: { slug: portalSlug },
    include: { client: true, workspace: true },
  })
  if (!portal) return null

  const deliverables = await db.deliverable.findMany({
    where: { workspaceId: portal.workspaceId, clientId: portal.clientId, visibility: "client" },
    select: { id: true },
  })
  const deliverableIds = deliverables.map((d) => d.id)

  const approvals = await db.approvalRequest.findMany({
    where: {
      workspaceId: portal.workspaceId,
      entityType: "deliverable",
      entityId: { in: deliverableIds },
    },
    include: { steps: true, events: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <PageHeader title="Approvals" description="Review and approve deliverables shared with you" />
      {approvals.length === 0 ? (
        <EmptyState
          title="No approvals yet"
          description="When your team requests approval on a deliverable, it will appear here."
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Version {a.versionNumber} · Requested {relativeTime(a.createdAt)}
                  </div>
                  {a.instructions && (
                    <p className="mt-2 text-sm text-muted-foreground">{a.instructions}</p>
                  )}
                  {a.dueAt && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Due {formatDate(a.dueAt)}
                    </div>
                  )}
                </div>
                <Badge variant="outline" className={classForStatus(a.status)}>
                  {humanStatus(a.status)}
                </Badge>
              </div>
              {a.status === "pending" && (
                <div className="mt-4 border-t border-border/40 pt-3">
                  <PortalApprovalDecision
                    workspaceSlug={portal.workspace.slug}
                    approvalId={a.id}
                    portalSlug={portalSlug}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
