import Link from "next/link";
import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { humanStatus, classForStatus, formatDate, formatMoney } from "@/lib/format";

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "campaigns.read")) return <Forbidden />;

  const campaigns = await db.campaign.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { client: true, project: true, owner: true, _count: { select: { deliverables: true, contentItems: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Campaigns" description={`${campaigns.length} campaigns`} />
      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" description="Campaigns group deliverables and content across a channel." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.client?.name ?? "—"} · {c.channel ?? "—"}
                  </div>
                </div>
                <Badge variant="outline" className={classForStatus(c.status)}>{humanStatus(c.status)}</Badge>
              </div>
              {c.objective && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.objective}</p>}
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Budget</div>
                  <div className="tabular-nums font-medium">{c.budgetMinor > 0 ? formatMoney(c.budgetMinor) : "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Deliverables</div>
                  <div className="tabular-nums font-medium">{c._count.deliverables}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Content</div>
                  <div className="tabular-nums font-medium">{c._count.contentItems}</div>
                </div>
              </div>
              {(c.startDate || c.endDate) && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {c.startDate && formatDate(c.startDate)}
                  {c.startDate && c.endDate && " → "}
                  {c.endDate && formatDate(c.endDate)}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
