import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TimeEntryFormDialog } from "@/components/app/time-entry-form"
import { SubmitTimeButton } from "@/components/app/submit-time"
import { Plus, Clock } from "lucide-react"
import {
  humanStatus,
  classForStatus,
  formatDateTime,
  formatMoney,
  formatMinutes,
  relativeTime,
} from "@/lib/format"

export default async function TimePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "time.read_own")) return <Forbidden />

  const [entries, projects, allEntries] = await Promise.all([
    db.timeEntry.findMany({
      where: { workspaceId: ctx.workspaceId, userId: ctx.userId },
      include: { project: true, client: true },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    db.project.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true, clientId: true, client: { select: { name: true } } },
    }),
    can(ctx, "time.read_all")
      ? db.timeEntry.findMany({
          where: { workspaceId: ctx.workspaceId },
          include: { user: true, project: true },
          orderBy: { startedAt: "desc" },
          take: 100,
        })
      : [],
  ])

  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0)
  const billableMinutes = entries.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0)
  const revenue = entries
    .filter((e) => e.billable)
    .reduce((s, e) => s + (e.rateMinor * BigInt(e.minutes)) / 60n, 0n)
  const openEntries = entries.filter((e) => e.status === "open")

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Time"
        description="Your time entries"
        action={
          can(ctx, "time.manage_own") && (
            <TimeEntryFormDialog
              workspaceSlug={workspaceSlug}
              projects={projects}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Log time
                </Button>
              }
            />
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Total (recent)" value={formatMinutes(totalMinutes)} />
        <Metric label="Billable" value={formatMinutes(billableMinutes)} />
        <Metric label="Recognized" value={formatMoney(revenue)} />
        <Metric label="Open entries" value={String(openEntries.length)} />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No time logged yet"
          description="Track billable and non-billable time against projects and tasks."
          action={can(ctx, "time.manage_own") ? { label: "Log time", href: "#" } : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-left font-medium">Project</th>
                  <th className="px-4 py-2 text-left font-medium">Started</th>
                  <th className="px-4 py-2 text-right font-medium">Minutes</th>
                  <th className="px-4 py-2 text-right font-medium">Billable</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  {can(ctx, "time.manage_own") && <th className="px-4 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium">{e.description ?? "Untitled"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {e.project?.name ?? e.client?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {relativeTime(e.startedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatMinutes(e.minutes)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {e.billable ? formatMoney((e.rateMinor * BigInt(e.minutes)) / 60n) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={classForStatus(e.status)}>
                        {humanStatus(e.status)}
                      </Badge>
                    </td>
                    {can(ctx, "time.manage_own") && (
                      <td className="px-4 py-2.5 text-right">
                        {e.status === "open" && (
                          <SubmitTimeButton
                            workspaceSlug={workspaceSlug}
                            ids={[e.id]}
                            label="Submit"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {can(ctx, "time.read_all") && allEntries.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            All team time
          </h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">User</th>
                    <th className="px-4 py-2 text-left font-medium">Description</th>
                    <th className="px-4 py-2 text-left font-medium">Project</th>
                    <th className="px-4 py-2 text-right font-medium">Minutes</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allEntries.slice(0, 20).map((e) => (
                    <tr key={e.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2.5">{e.user?.displayName ?? "—"}</td>
                      <td className="px-4 py-2.5">{e.description ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {e.project?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatMinutes(e.minutes)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={classForStatus(e.status)}>
                          {humanStatus(e.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}
