import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/app/states";
import { formatDate } from "@/lib/format";
import { FileText } from "lucide-react";

export default async function PortalFilesPage({ params }: { params: Promise<{ portalSlug: string }> }) {
  const { portalSlug } = await params;
  const portal = await db.clientPortal.findUnique({
    where: { slug: portalSlug },
    include: { client: true, workspace: true },
  });
  if (!portal) return null;

  const deliverables = await db.deliverable.findMany({
    where: { workspaceId: portal.workspaceId, clientId: portal.clientId, visibility: "client" },
    include: { versions: true, owner: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Files & deliverables" description="Shared deliverables and versions" />
      {deliverables.length === 0 ? (
        <EmptyState title="No files shared yet" description="Your team will share deliverables here as they're ready." />
      ) : (
        <Card className="divide-y divide-border/40">
          {deliverables.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-foreground/5">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground">
                  {d.versions.length} version(s) · Updated {formatDate(d.updatedAt)}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">{d.status}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
