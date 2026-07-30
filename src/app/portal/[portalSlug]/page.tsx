import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, FolderKanban, FileCheck2, FileText } from "lucide-react";
import { humanStatus, classForStatus, formatDate, relativeTime } from "@/lib/format";

export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ portalSlug: string }>;
}) {
  const { portalSlug } = await params;
  const portal = await db.clientPortal.findUnique({
    where: { slug: portalSlug },
    include: { client: true, workspace: true },
  });
  if (!portal) return null;

  const [projects, pendingApprovals, recentRequests] = await Promise.all([
    db.project.findMany({
      where: { workspaceId: portal.workspaceId, clientId: portal.clientId, visibility: "client" },
      include: { status: true, owner: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.approvalRequest.findMany({
      where: {
        workspaceId: portal.workspaceId,
        status: "pending",
        // approvals linked to deliverables on this client
        // (simplified: show all pending approvals for this workspace/client via deliverable join)
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.clientRequest.findMany({
      where: { workspaceId: portal.workspaceId, clientId: portal.clientId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Filter approvals to those whose deliverable belongs to this client
  const deliverableIds = (await db.deliverable.findMany({
    where: { workspaceId: portal.workspaceId, clientId: portal.clientId },
    select: { id: true },
  })).map((d) => d.id);
  const clientApprovals = pendingApprovals.filter((a) => a.entityType === "deliverable" && deliverableIds.includes(a.entityId));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {portal.client.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A shared view of your work with {portal.workspace.name}. You only see records explicitly shared with you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <div className="mt-2 text-2xl font-semibold">{projects.length}</div>
            <div className="text-xs text-muted-foreground">Active projects</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <FileCheck2 className="h-4 w-4 text-muted-foreground" />
            <div className="mt-2 text-2xl font-semibold">{clientApprovals.length}</div>
            <div className="text-xs text-muted-foreground">Pending approvals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div className="mt-2 text-2xl font-semibold">{recentRequests.length}</div>
            <div className="text-xs text-muted-foreground">Requests</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Your projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects shared yet.</p>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/portal/${portalSlug}/projects`}
                className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 hover:bg-muted/50"
              >
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.owner?.displayName ?? "—"}</div>
                </div>
                {p.status && <Badge variant="outline" className={classForStatus(p.status.category)}>{p.status.name}</Badge>}
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Approvals awaiting your decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {clientApprovals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending right now.</p>
          ) : (
            clientApprovals.map((a) => (
              <Link
                key={a.id}
                href={`/portal/${portalSlug}/approvals`}
                className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 hover:bg-muted/50"
              >
                <div>
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">Requested {relativeTime(a.createdAt)}{a.dueAt && ` · Due ${formatDate(a.dueAt)}`}</div>
                </div>
                <Button size="sm" variant="outline">Review <ArrowRight className="ml-1 h-3 w-3" /></Button>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
