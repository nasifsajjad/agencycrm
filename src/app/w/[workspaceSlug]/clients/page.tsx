import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClientFormDialog } from "@/components/app/client-form";
import { humanStatus, classForStatus, formatDate } from "@/lib/format";

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { new: isNew } = await searchParams;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "clients.read")) return <Forbidden />;

  const [clients, companies] = await Promise.all([
    db.client.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        owner: true,
        _count: { select: { projects: true, clientRequests: true, retainers: true, invoices: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.company.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Clients"
        description={`${clients.length} ${clients.length === 1 ? "client" : "clients"}`}
        action={
          can(ctx, "clients.create") && (
            <ClientFormDialog
              workspaceSlug={workspaceSlug}
              companies={companies}
              defaultOpen={isNew === "1"}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New client
                </Button>
              }
            />
          )
        }
      />
      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Convert a won deal or add a client directly to start delivery."
          action={can(ctx, "clients.create") ? { label: "New client", href: `/w/${workspaceSlug}/clients?new=1` } : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Client</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Health</th>
                  <th className="px-4 py-2 text-left font-medium">Owner</th>
                  <th className="px-4 py-2 text-left font-medium">Renewal</th>
                  <th className="px-4 py-2 text-right font-medium">Projects</th>
                  <th className="px-4 py-2 text-right font-medium">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/w/${workspaceSlug}/clients/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.code && <span className="ml-2 text-xs text-muted-foreground">{c.code}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={classForStatus(c.status)}>{humanStatus(c.status)}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <HealthBadge score={c.healthScore} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.owner?.displayName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {c.renewalDate ? formatDate(c.renewalDate) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c._count.projects}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{c._count.invoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function HealthBadge({ score }: { score: number }) {
  let cls = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (score >= 75) cls = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  else if (score >= 50) cls = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return <Badge variant="outline" className={cls}>{score}</Badge>;
}
