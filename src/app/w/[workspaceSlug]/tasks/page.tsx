import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskFormDialog } from "@/components/app/task-form";
import { humanStatus, classForStatus, formatDate, initials } from "@/lib/format";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { new: isNew } = await searchParams;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "tasks.read")) return <Forbidden />;

  const [tasks, projects, statuses, members] = await Promise.all([
    db.task.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { project: true, status: true, assignee: true, owner: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.project.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true } }),
    db.taskStatus.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { position: "asc" } }),
    db.workspaceMembership.findMany({
      where: { workspaceId: ctx.workspaceId, status: "active" },
      include: { user: true },
    }),
  ]);

  const overdue = tasks.filter((t) => t.dueAt && !t.dueAt.toString().startsWith("1970") && new Date(t.dueAt) < new Date() && t.status?.category !== "done");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Tasks"
        description={`${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}${overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}`}
        action={
          can(ctx, "tasks.create") && (
            <TaskFormDialog
              workspaceSlug={workspaceSlug}
              projects={projects}
              statuses={statuses}
              members={members.map((m) => ({ id: m.user.id, name: m.user.displayName ?? m.user.email }))}
              defaultOpen={isNew === "1"}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New task
                </Button>
              }
            />
          )
        }
      />
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create a task to track work across projects."
          action={can(ctx, "tasks.create") ? { label: "New task", href: `/w/${workspaceSlug}/tasks?new=1` } : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Task</th>
                  <th className="px-4 py-2 text-left font-medium">Project</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Priority</th>
                  <th className="px-4 py-2 text-left font-medium">Assignee</th>
                  <th className="px-4 py-2 text-left font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const isOverdue = t.dueAt && new Date(t.dueAt) < new Date() && t.status?.category !== "done";
                  return (
                    <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">
                        {t.project ? (
                          <Link href={`/w/${workspaceSlug}/projects/${t.project.id}`} className="hover:underline">{t.name}</Link>
                        ) : (
                          t.name
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{t.project?.name ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {t.status && <Badge variant="outline" className={classForStatus(t.status.category)}>{t.status.name}</Badge>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={t.priority === "urgent" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : t.priority === "high" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : ""}>
                          {humanStatus(t.priority)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {t.assignee && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[9px]">{initials(t.assignee.displayName)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">{t.assignee.displayName}</span>
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 ${isOverdue ? "text-danger font-medium" : "text-muted-foreground"}`}>
                        {t.dueAt ? formatDate(t.dueAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
