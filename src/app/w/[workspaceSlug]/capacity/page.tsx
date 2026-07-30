import Link from "next/link";
import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, Forbidden } from "@/components/app/states";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatMinutes, formatDate } from "@/lib/format";

export default async function CapacityPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "time.read_all")) return <Forbidden />;

  const members = await db.workspaceMembership.findMany({
    where: { workspaceId: ctx.workspaceId, status: "active" },
    include: {
      user: true,
      roles: { include: { role: true } },
    },
  });

  // Pull this week's time entries per user
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const entries = await db.timeEntry.findMany({
    where: { workspaceId: ctx.workspaceId, startedAt: { gte: weekStart } },
    select: { userId: true, minutes: true, billable: true },
  });

  const byUser = new Map<string, { total: number; billable: number }>();
  for (const e of entries) {
    const cur = byUser.get(e.userId) ?? { total: 0, billable: 0 };
    cur.total += e.minutes;
    if (e.billable) cur.billable += e.minutes;
    byUser.set(e.userId, cur);
  }

  // Open tasks per user
  const tasks = await db.task.findMany({
    where: { workspaceId: ctx.workspaceId, status: { category: { not: "done" } } },
    select: { assigneeId: true, estimateMinutes: true, dueAt: true, name: true, project: { select: { name: true } } },
  });

  const tasksByUser = new Map<string, { count: number; estimate: number; overdue: number }>();
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    const cur = tasksByUser.get(t.assigneeId) ?? { count: 0, estimate: 0, overdue: 0 };
    cur.count += 1;
    cur.estimate += t.estimateMinutes;
    if (t.dueAt && t.dueAt < new Date()) cur.overdue += 1;
    tasksByUser.set(t.assigneeId, cur);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Capacity" description="Team workload and utilization" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => {
          const stats = byUser.get(m.user.id) ?? { total: 0, billable: 0 };
          const taskStats = tasksByUser.get(m.user.id) ?? { count: 0, estimate: 0, overdue: 0 };
          const utilization = stats.total > 0 ? Math.round((stats.billable / stats.total) * 100) : 0;
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{initials(m.user.displayName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{m.user.displayName}</div>
                    <div className="text-xs text-muted-foreground">{m.roles.map((r) => r.role.name).join(", ") || "Member"}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">This week logged</span>
                  <span className="tabular-nums font-medium">{formatMinutes(stats.total)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Billable</span>
                  <span className="tabular-nums">{formatMinutes(stats.billable)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Utilization</span>
                  <span className="tabular-nums">{utilization}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min(utilization, 100)}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Open tasks</span>
                  <span className="tabular-nums">{taskStats.count} ({formatMinutes(taskStats.estimate)})</span>
                </div>
                {taskStats.overdue > 0 && (
                  <div className="text-xs text-danger">{taskStats.overdue} overdue</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
