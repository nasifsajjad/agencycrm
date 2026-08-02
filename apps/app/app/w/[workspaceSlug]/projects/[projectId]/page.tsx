import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, Forbidden } from "@/components/app/states"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, CheckCircle2, Paperclip, Plus, Upload } from "lucide-react"
import { ApprovalRequestDialog } from "@/components/app/approval-request-form"
import { FileUploadDialog } from "@/components/app/file-upload"
import {
  humanStatus,
  classForStatus,
  formatDate,
  formatMoney,
  initials,
  relativeTime,
} from "@/lib/format"
import { TaskFormDialog } from "@/components/app/task-form"
import { TasksBoard } from "@/components/app/tasks-board"

/** Human-readable byte size for the files list. */
function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>
}) {
  const { workspaceSlug, projectId } = await params
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "projects.read")) return <Forbidden />

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: ctx.workspaceId },
    include: {
      client: true,
      status: true,
      owner: true,
      members: { include: { membership: { include: { user: true } } } },
      milestones: { include: { tasks: true }, orderBy: { dueDate: "asc" } },
      tasks: {
        include: { assignee: true, status: true, owner: true },
        orderBy: { position: "asc" },
      },
      timeEntries: { include: { user: true }, orderBy: { startedAt: "desc" }, take: 10 },
      _count: { select: { deliverables: true, campaigns: true } },
    },
  })
  if (!project) notFound()

  const [statuses, members, otherProjects] = await Promise.all([
    db.taskStatus.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { position: "asc" },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId: ctx.workspaceId, status: "active" },
      include: { user: true },
    }),
    db.project.findMany({
      where: { workspaceId: ctx.workspaceId, id: { not: project.id }, clientId: project.clientId },
      select: { id: true, name: true, code: true },
      take: 5,
    }),
  ])

  // Files reach a project through file_links, so resolve the links first and
  // then the file rows. RLS on both tables still applies.
  const fileLinks = can(ctx, "files.read")
    ? await db.fileLink.findMany({
        where: { entityType: "project", entityId: project.id },
        select: { fileId: true },
        take: 100,
      })
    : []
  const projectFiles = fileLinks.length
    ? await db.fileRecord.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          id: { in: fileLinks.map((link) => link.fileId) },
        },
        include: { uploader: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : []

  const loggedMinutes = project.timeEntries.reduce((s, t) => s + t.minutes, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href={`/w/${workspaceSlug}/projects`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All projects
      </Link>

      <div className="mb-6 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            {project.code && <Badge variant="outline">{project.code}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {project.client && (
              <Link
                href={`/w/${workspaceSlug}/clients/${project.client.id}`}
                className="hover:underline"
              >
                {project.client.name}
              </Link>
            )}
            <span>·</span>
            <span>Owner: {project.owner?.displayName ?? "—"}</span>
            {project.dueDate && (
              <>
                <span>·</span>
                <span>Due {formatDate(project.dueDate)}</span>
              </>
            )}
          </div>
          {project.description && (
            <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {can(ctx, "tasks.create") && (
            <TaskFormDialog
              workspaceSlug={workspaceSlug}
              projects={[{ id: project.id, name: project.name }]}
              statuses={statuses}
              members={members.map((m) => ({
                id: m.user.id,
                name: m.user.displayName ?? m.user.email,
              }))}
              defaultProjectId={project.id}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New task
                </Button>
              }
            />
          )}
          {can(ctx, "approvals.request") && (
            <ApprovalRequestDialog
              workspaceSlug={workspaceSlug}
              entityType="project"
              entityId={project.id}
              defaultTitle={project.name}
              approvers={members
                .map((m) => ({
                  id: m.user.id,
                  name: m.user.displayName ?? m.user.email,
                  email: m.user.email,
                }))
                .filter((approver) => approver.id)}
              trigger={
                <Button size="sm" variant="outline">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Request approval
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Status" value={project.status?.name ?? "—"} />
        <Metric
          label="Budget"
          value={project.budgetMinor > 0 ? formatMoney(project.budgetMinor) : "—"}
        />
        <Metric
          label="Logged"
          value={`${Math.floor(loggedMinutes / 60)}h ${loggedMinutes % 60}m`}
        />
        <Metric label="Tasks" value={String(project.tasks.length)} />
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <TasksBoard
            workspaceSlug={workspaceSlug}
            statuses={statuses}
            tasks={project.tasks.map((t) => ({
              id: t.id,
              name: t.name,
              priority: t.priority,
              statusId: t.statusId ?? "",
              statusName: t.status?.name ?? "",
              statusColor: t.status?.color ?? null,
              statusCategory: t.status?.category ?? "todo",
              assigneeName: t.assignee?.displayName ?? null,
              dueAt: t.dueAt?.toISOString() ?? null,
              estimateMinutes: t.estimateMinutes,
            }))}
            canEdit={can(ctx, "tasks.update")}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Task</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Priority</th>
                    <th className="px-4 py-2 text-left font-medium">Assignee</th>
                    <th className="px-4 py-2 text-left font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tasks.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-2.5 font-medium">{t.name}</td>
                      <td className="px-4 py-2.5">
                        {t.status && (
                          <Badge variant="outline" className={classForStatus(t.status.category)}>
                            {t.status.name}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={
                            t.priority === "urgent"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : t.priority === "high"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : ""
                          }
                        >
                          {humanStatus(t.priority)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {t.assignee && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[9px]">
                                {initials(t.assignee.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {t.assignee.displayName}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {t.dueAt ? formatDate(t.dueAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              {project.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones defined.</p>
              ) : (
                <div className="space-y-3">
                  {project.milestones.map((m) => (
                    <div key={m.id} className="rounded-md border border-border/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{m.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={classForStatus(m.status)}>
                            {humanStatus(m.status)}
                          </Badge>
                          {m.dueDate && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(m.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      {m.tasks.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {m.tasks.length} task(s)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent time entries</CardTitle>
            </CardHeader>
            <CardContent>
              {project.timeEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No time logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.timeEntries.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{t.description ?? "Untitled entry"}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.user.displayName} · {relativeTime(t.startedAt)}
                        </div>
                      </div>
                      <Badge variant="outline" className={classForStatus(t.status)}>
                        {humanStatus(t.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Files</CardTitle>
              {can(ctx, "files.upload") && (
                <FileUploadDialog
                  workspaceSlug={workspaceSlug}
                  entityType="project"
                  entityId={project.id}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Upload className="mr-1 h-3.5 w-3.5" /> Upload
                    </Button>
                  }
                />
              )}
            </CardHeader>
            <CardContent>
              {projectFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No files yet. Upload deliverables, briefs or assets here.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {projectFiles.map((file) => (
                    <li key={file.id} className="flex items-center gap-3 py-2.5">
                      <Paperclip
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{file.originalName}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(Number(file.sizeBytes))} ·{" "}
                          {file.uploader?.displayName ?? "Unknown"} · {relativeTime(file.createdAt)}
                        </div>
                      </div>
                      {file.visibility === "client" && (
                        <Badge variant="outline" className="text-[10px]">
                          Client visible
                        </Badge>
                      )}
                      {can(ctx, "files.read") && (
                        <Button size="sm" variant="ghost" asChild>
                          <a
                            href={`/api/files/${file.id}/download?ws=${encodeURIComponent(workspaceSlug)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Project team</CardTitle>
            </CardHeader>
            <CardContent>
              {project.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members assigned.</p>
              ) : (
                <div className="space-y-2">
                  {project.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {initials(m.membership.user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{m.membership.user.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.membership.user.email}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {m.accessLevel}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}
