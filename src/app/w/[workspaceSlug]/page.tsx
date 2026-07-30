import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock, Briefcase, DollarSign, FileCheck2, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDashboardMetrics } from "@/lib/queries";
import { formatMoney, formatMoneyShort, formatMinutes, humanStatus, classForStatus, relativeTime, initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { WorkspaceContext } from "@/lib/auth";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { getWorkspaceContext, requireUser } = await import("@/lib/auth");
  const user = await requireUser();
  const ctx = await getWorkspaceContext(workspaceSlug, user);
  if (!ctx) return null;

  const m = await getDashboardMetrics(ctx);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back. Here&apos;s what&apos;s happening at {ctx.workspaceName}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/w/${ctx.workspaceSlug}/reports`}>
              Reports <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Pipeline value"
          value={formatMoneyShort(m.pipelineValue)}
          sub={`${formatMoneyShort(m.weightedPipeline)} weighted`}
          icon={DollarSign}
          trend="+12.4%"
          trendUp
        />
        <MetricCard
          label="Active clients"
          value={String(m.activeClients)}
          sub={`${m.atRiskClients} at risk`}
          icon={Briefcase}
          trend="+2"
          trendUp
        />
        <MetricCard
          label="Pending approvals"
          value={String(m.pendingApprovals)}
          sub="Awaiting decision"
          icon={FileCheck2}
        />
        <MetricCard
          label="Billable hours (30d)"
          value={formatMinutes(m.billableMinutes)}
          sub={`${formatMoney(m.recognizedRevenue)} recognized`}
          icon={Clock}
          trend="+4pts"
          trendUp
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Pipeline by stage */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pipeline by stage</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/w/${ctx.workspaceSlug}/crm/deals`}>
                Open board <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <PipelineByStage deals={m.deals} />
          </CardContent>
        </Card>

        {/* Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pending approvals</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/w/${ctx.workspaceSlug}/approvals`}>
                All <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {m.approvals.length === 0 ? (
              <EmptyState text="No pending approvals." />
            ) : (
              m.approvals.map((a) => (
                <Link
                  key={a.id}
                  href={`/w/${ctx.workspaceSlug}/approvals/${a.id}`}
                  className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">Due {a.dueAt ? relativeTime(a.dueAt) : "—"}</div>
                  </div>
                  <Badge variant="outline" className={classForStatus(a.status)}>{humanStatus(a.status)}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Active projects */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active projects</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/w/${ctx.workspaceSlug}/projects`}>
                All projects <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {m.projects.length === 0 ? (
              <EmptyState text="No projects yet." />
            ) : (
              <div className="space-y-2">
                {m.projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/w/${ctx.workspaceSlug}/projects/${p.id}`}
                    className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{p.name}</span>
                        {p.client && <span className="text-xs text-muted-foreground">· {p.client.name}</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {p.status && <Badge variant="outline" className={classForStatus(p.status.category)}>{p.status.name}</Badge>}
                        {p.dueDate && <span>Due {relativeTime(p.dueDate)}</span>}
                      </div>
                    </div>
                    {p.owner && (
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">{initials(p.owner.displayName)}</AvatarFallback>
                      </Avatar>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {m.clients.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/w/${ctx.workspaceSlug}/clients/${c.id}`}
                className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.healthReason ?? "—"}</div>
                </div>
                <Badge variant="outline" className={healthBadgeClass(c.healthScore)}>
                  {c.healthScore}
                </Badge>
              </Link>
            ))}
            {m.clients.length === 0 && <EmptyState text="No clients yet." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  trendUp,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </CardTitle>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {trend && (
            <span className={trendUp ? "text-success" : "text-muted-foreground"}>
              <TrendingUp className="inline h-3 w-3" /> {trend}
            </span>
          )}
          {sub && <span className="text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineByStage({ deals }: { deals: any[] }) {
  const stageMap = new Map<string, { name: string; color: string | null; total: bigint; count: number }>();
  for (const d of deals) {
    const key = d.stageId ?? "none";
    const entry = stageMap.get(key) ?? { name: d.stage?.name ?? "Unassigned", color: d.stage?.color ?? null, total: 0n, count: 0 };
    entry.total += d.amountMinor;
    entry.count += 1;
    stageMap.set(key, entry);
  }
  const stages = Array.from(stageMap.values());
  const max = stages.reduce((m, s) => (s.total > m ? s.total : m), 0n);
  if (stages.length === 0) return <EmptyState text="No open deals in your pipeline." />;
  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color ?? "var(--muted-foreground)" }} />
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.count} deals</span>
            </div>
            <span className="tabular-nums text-sm">{formatMoney(s.total)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full"
              style={{
                width: `${max === 0n ? 0 : Number((s.total * 100n) / max)}%`,
                backgroundColor: s.color ?? "var(--muted-foreground)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid place-items-center py-6 text-center">
      <AlertTriangle className="mb-2 h-5 w-5 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function healthBadgeClass(score: number): string {
  if (score >= 75) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (score >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
}
