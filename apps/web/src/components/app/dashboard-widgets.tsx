import Link from "next/link"
import { appHref } from "@/lib/app-links"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowUpRight,
  DollarSign,
  Briefcase,
  Clock,
  FileCheck2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react"
import {
  formatMoney,
  formatMoneyShort,
  formatMinutes,
  humanStatus,
  classForStatus,
  relativeTime,
} from "@/lib/format"
import type { WorkspaceContext } from "@/lib/auth"

export async function DashboardWidgetRenderer({
  ctx,
  widget,
}: {
  ctx: WorkspaceContext
  widget: { id: string; widgetType: string; queryJson: any; displayJson: any; positionJson: any }
}) {
  // Resolve widget content into a renderable element without try/catch around JSX.
  let content: React.ReactNode
  try {
    content = await resolveWidgetContent(ctx, widget.widgetType)
  } catch (e: any) {
    content = (
      <Card className="border-destructive/30">
        <CardContent className="py-6 text-center text-xs text-destructive">
          Widget error: {e?.message ?? "unknown"}
        </CardContent>
      </Card>
    )
  }
  return <>{content}</>
}

async function resolveWidgetContent(
  ctx: WorkspaceContext,
  widgetType: string
): Promise<React.ReactNode> {
  switch (widgetType) {
    case "pipeline_value":
      return <PipelineValueWidget ctx={ctx} />
    case "active_clients":
      return <ActiveClientsWidget ctx={ctx} />
    case "approvals_pending":
      return <PendingApprovalsWidget ctx={ctx} />
    case "utilization":
      return <UtilizationWidget ctx={ctx} />
    case "at_risk_clients":
      return <AtRiskClientsWidget ctx={ctx} />
    case "my_open_tasks":
      return <MyOpenTasksWidget ctx={ctx} />
    case "recent_activity":
      return <RecentActivityWidget ctx={ctx} />
    case "invoices_outstanding":
      return <OutstandingInvoicesWidget ctx={ctx} />
    default:
      return (
        <Card>
          <CardContent className="py-6 text-center text-xs text-muted-foreground">
            Unknown widget type: {widgetType}
          </CardContent>
        </Card>
      )
  }
}

async function PipelineValueWidget({ ctx }: { ctx: WorkspaceContext }) {
  const deals = await db.deal.findMany({
    where: { workspaceId: ctx.workspaceId, stage: { isClosed: false } },
    include: { stage: true },
  })
  const total = deals.reduce((s, d) => s + d.amountMinor, 0n)
  const weighted = deals.reduce((s, d) => s + (d.amountMinor * BigInt(d.probability)) / 100n, 0n)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4" /> Pipeline value
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{formatMoney(total)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatMoney(weighted)} weighted · {deals.length} open deals
        </div>
      </CardContent>
    </Card>
  )
}

async function ActiveClientsWidget({ ctx }: { ctx: WorkspaceContext }) {
  const clients = await db.client.findMany({
    where: { workspaceId: ctx.workspaceId, status: { in: ["active", "at_risk"] } },
    include: { owner: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Briefcase className="h-4 w-4" /> Active clients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active clients.</p>
        ) : (
          clients.map((c) => (
            <Link
              key={c.id}
              href={appHref(`/w/${ctx.workspaceSlug}/clients/${c.id}`)}
              className="block rounded-md border border-border/40 px-2 py-1.5 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <Badge variant="outline" className={classForStatus(c.status)}>
                  {humanStatus(c.status)}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

async function PendingApprovalsWidget({ ctx }: { ctx: WorkspaceContext }) {
  const approvals = await db.approvalRequest.findMany({
    where: { workspaceId: ctx.workspaceId, status: "pending" },
    orderBy: { dueAt: "asc" },
    take: 5,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileCheck2 className="h-4 w-4" /> Pending approvals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing pending.</p>
        ) : (
          approvals.map((a) => (
            <Link
              key={a.id}
              href={appHref(`/w/${ctx.workspaceSlug}/approvals/${a.id}`)}
              className="block rounded-md border border-border/40 px-2 py-1.5 hover:bg-muted/40"
            >
              <div className="truncate text-sm font-medium">{a.title}</div>
              <div className="text-xs text-muted-foreground">
                {a.dueAt ? `Due ${relativeTime(a.dueAt)}` : "No due date"}
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

async function UtilizationWidget({ ctx }: { ctx: WorkspaceContext }) {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const entries = await db.timeEntry.findMany({
    where: { workspaceId: ctx.workspaceId, startedAt: { gte: weekStart } },
    select: { minutes: true, billable: true },
  })
  const total = entries.reduce((s, e) => s + e.minutes, 0)
  const billable = entries.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0)
  const util = total > 0 ? Math.round((billable / total) * 100) : 0
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" /> Utilization (7d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{util}%</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatMinutes(billable)} billable of {formatMinutes(total)} total
        </div>
      </CardContent>
    </Card>
  )
}

async function AtRiskClientsWidget({ ctx }: { ctx: WorkspaceContext }) {
  const clients = await db.client.findMany({
    where: { workspaceId: ctx.workspaceId, status: "at_risk" },
    orderBy: { healthScore: "asc" },
    take: 5,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4" /> At-risk clients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">None at risk. 🎉</p>
        ) : (
          clients.map((c) => (
            <Link
              key={c.id}
              href={appHref(`/w/${ctx.workspaceSlug}/clients/${c.id}`)}
              className="block rounded-md border border-border/40 px-2 py-1.5 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <Badge
                  variant="outline"
                  className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                  {c.healthScore}
                </Badge>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

async function MyOpenTasksWidget({ ctx }: { ctx: WorkspaceContext }) {
  const tasks = await db.task.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      assigneeId: ctx.userId,
      status: { category: { not: "done" } },
    },
    include: { project: true, status: true },
    orderBy: { dueAt: "asc" },
    take: 5,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">My open tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">All caught up.</p>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="rounded-md border border-border/40 px-2 py-1.5">
              <div className="truncate text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {t.project?.name ?? "—"} ·{" "}
                {t.dueAt ? `Due ${relativeTime(t.dueAt)}` : "No due date"}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

async function RecentActivityWidget({ ctx }: { ctx: WorkspaceContext }) {
  const events = await db.activityEvent.findMany({
    where: { workspaceId: ctx.workspaceId, visibility: { in: ["internal", "client"] } },
    include: { actorUser: true },
    orderBy: { occurredAt: "desc" },
    take: 6,
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {events.length === 0 ? (
          <p className="text-muted-foreground">No activity.</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-start gap-2">
              <span className="font-medium">{e.actorUser?.displayName ?? "Someone"}</span>
              <span className="text-muted-foreground">{e.verb.replace(/[._]/g, " ")}</span>
              <span className="ml-auto text-muted-foreground">{relativeTime(e.occurredAt)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

async function OutstandingInvoicesWidget({ ctx }: { ctx: WorkspaceContext }) {
  const invoices = await db.invoice.findMany({
    where: { workspaceId: ctx.workspaceId, status: "sent" },
    include: { client: true },
    orderBy: { dueOn: "asc" },
    take: 5,
  })
  const total = invoices.reduce((s, i) => s + (i.totalMinor - i.paidMinor), 0n)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4" /> Outstanding invoices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{formatMoney(total)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {invoices.length} unpaid invoice(s)
        </div>
      </CardContent>
    </Card>
  )
}
