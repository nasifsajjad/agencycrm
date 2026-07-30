import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/app/states";
import { classForStatus, humanStatus, formatDate } from "@/lib/format";
import { NewRequestButton } from "@/components/portal/new-request";

export default async function PortalRequestsPage({ params }: { params: Promise<{ portalSlug: string }> }) {
  const { portalSlug } = await params;
  const portal = await db.clientPortal.findUnique({
    where: { slug: portalSlug },
    include: { client: true, workspace: true },
  });
  if (!portal) return null;

  const requests = await db.clientRequest.findMany({
    where: { workspaceId: portal.workspaceId, clientId: portal.clientId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Requests"
        description="Send new requests to your account team"
        action={<NewRequestButton workspaceSlug={portal.workspace.slug} clientId={portal.clientId} portalSlug={portalSlug} />}
      />
      {requests.length === 0 ? (
        <EmptyState title="No requests yet" description="Submit a request to your account team." />
      ) : (
        <Card className="divide-y divide-border/40">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.description ?? "—"}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">Submitted {formatDate(r.createdAt)}{r.dueAt && ` · Due ${formatDate(r.dueAt)}`}</div>
              </div>
              <Badge variant="outline" className={classForStatus(r.status)}>{humanStatus(r.status)}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
