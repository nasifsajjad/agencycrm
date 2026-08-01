import Link from "next/link"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, Forbidden } from "@/components/app/states"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Users,
  Briefcase,
  DollarSign,
  Clock,
  FileCheck2,
  TrendingUp,
} from "lucide-react"
import {
  formatMoney,
  formatMoneyShort,
  formatMinutes,
  humanStatus,
  classForStatus,
} from "@/lib/format"

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const asMinor = (value: unknown): bigint => BigInt(value as bigint | number | string)
  const { workspaceSlug } = await params
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "reports.read")) return <Forbidden />

  const [deals, clients, timeEntries, approvals, invoices] = await Promise.all([
    db.deal.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { stage: true, owner: true },
    }),
    db.client.findMany({ where: { workspaceId: ctx.workspaceId } }),
    db.timeEntry.findMany({
      where: { workspaceId: ctx.workspaceId, billable: true },
      select: {
        minutes: true,
        rateMinor: true,
        status: true,
        userId: true,
        user: { select: { displayName: true } },
      },
    }),
    db.approvalRequest.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { status: true, createdAt: true, decidedAt: true },
    }),
    db.invoice.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { totalMinor: true, paidMinor: true, status: true },
    }),
  ])

  const openDeals = deals.filter((d) => !d.stage?.isClosed)
  const wonDeals = deals.filter((d) => d.stage?.isWon)
  const closedDeals = deals.filter((d) => d.stage?.isClosed)
  const pipelineValue: bigint = openDeals.reduce((s: bigint, d: any) => s + asMinor(d.amountMinor), 0n)
  const weightedPipeline: bigint = openDeals.reduce(
    (s: bigint, d: any) => s + (asMinor(d.amountMinor) * BigInt(d.probability)) / 100n,
    0n
  )
  const winRate =
    closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0
  const billableMinutes = timeEntries
    .filter((t) => t.status === "approved")
    .reduce((s, t) => s + t.minutes, 0)
  const recognizedRevenue: bigint = timeEntries
    .filter((t) => t.status === "approved")
    .reduce((s: bigint, t: any) => s + (asMinor(t.rateMinor) * BigInt(t.minutes)) / 60n, 0n)
  const pendingApprovals = approvals.filter((a) => a.status === "pending").length
  const avgApprovalAge =
    pendingApprovals > 0
      ? Math.round(
          approvals
            .filter((a) => a.status === "pending")
            .reduce((s, a) => s + (Date.now() - a.createdAt.getTime()), 0) /
            pendingApprovals /
            (1000 * 60 * 60 * 24)
        )
      : 0
  const totalInvoiced: bigint = invoices.reduce((s: bigint, i: any) => s + asMinor(i.totalMinor), 0n)
  const totalCollected: bigint = invoices.reduce((s: bigint, i: any) => s + asMinor(i.paidMinor), 0n)

  // Pipeline by stage
  const stages = new Map<
    string,
    { name: string; color: string | null; total: bigint; count: number }
  >()
  for (const d of openDeals) {
    const key = d.stageId ?? "none"
    const e = stages.get(key) ?? {
      name: d.stage?.name ?? "Unassigned",
      color: d.stage?.color ?? null,
      total: 0n,
      count: 0,
    }
    e.total += d.amountMinor
    e.count += 1
    stages.set(key, e)
  }

  // Top owners by pipeline
  const byOwner = new Map<string, { name: string; total: bigint; count: number }>()
  for (const d of openDeals) {
    const key = d.ownerId ?? "none"
    const e = byOwner.get(key) ?? {
      name: d.owner?.displayName ?? "Unassigned",
      total: 0n,
      count: 0,
    }
    e.total += d.amountMinor
    e.count += 1
    byOwner.set(key, e)
  }
  const topOwners = Array.from(byOwner.values())
    .sort((a, b) => Number(b.total - a.total))
    .slice(0, 5)

  // Client health distribution
  const healthBuckets = { green: 0, amber: 0, red: 0 }
  for (const c of clients) {
    if (c.healthScore >= 75) healthBuckets.green += 1
    else if (c.healthScore >= 50) healthBuckets.amber += 1
    else healthBuckets.red += 1
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Reports" description="Role-aware dashboards and metrics" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Pipeline value" value={formatMoneyShort(pipelineValue)} icon={DollarSign} />
        <Metric label="Weighted" value={formatMoneyShort(weightedPipeline)} icon={TrendingUp} />
        <Metric label="Win rate" value={`${winRate}%`} icon={TrendingUp} />
        <Metric label="Billable hrs" value={formatMinutes(billableMinutes)} icon={Clock} />
        <Metric label="Recognized" value={formatMoneyShort(recognizedRevenue)} icon={DollarSign} />
        <Metric label="Collected" value={formatMoneyShort(totalCollected)} icon={DollarSign} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pipeline by stage</CardTitle>
          </CardHeader>
          <CardContent>
            {stages.size === 0 ? (
              <p className="text-sm text-muted-foreground">No open deals.</p>
            ) : (
              <div className="space-y-2">
                {Array.from(stages.values()).map((s, i) => {
                  const max = Math.max(...Array.from(stages.values()).map((x) => Number(x.total)))
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: s.color ?? "var(--muted-foreground)" }}
                          />
                          {s.name} <span className="text-muted-foreground">({s.count})</span>
                        </span>
                        <span className="tabular-nums">{formatMoney(s.total)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full"
                          style={{
                            width: `${(Number(s.total) / max) * 100}%`,
                            backgroundColor: s.color ?? "var(--muted-foreground)",
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top owners by pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {topOwners.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals.</p>
            ) : (
              <div className="space-y-2">
                {topOwners.map((o, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span>
                      {o.name} <span className="text-muted-foreground">({o.count})</span>
                    </span>
                    <span className="tabular-nums">{formatMoney(o.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Client health distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <HealthRow
                label="Healthy (75-100)"
                count={healthBuckets.green}
                total={clients.length}
                color="bg-emerald-500"
              />
              <HealthRow
                label="At risk (50-74)"
                count={healthBuckets.amber}
                total={clients.length}
                color="bg-amber-500"
              />
              <HealthRow
                label="Critical (0-49)"
                count={healthBuckets.red}
                total={clients.length}
                color="bg-red-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Approval cycle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="tabular-nums">{pendingApprovals}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg age (pending)</span>
                <span className="tabular-nums">{avgApprovalAge}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total decided</span>
                <span className="tabular-nums">
                  {approvals.filter((a) => a.status !== "pending").length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Definitions
        </h2>
        <Card>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div>
              <code className="text-foreground">weighted pipeline</code> = Σ(open deal amount ×
              stage probability)
            </div>
            <div>
              <code className="text-foreground">win rate</code> = won deals / closed deals
            </div>
            <div>
              <code className="text-foreground">utilization</code> = billable approved minutes /
              available minutes
            </div>
            <div>
              <code className="text-foreground">budget burn</code> = actual approved cost or time /
              approved budget
            </div>
            <div>
              <code className="text-foreground">approval age</code> = now − approval requested
              timestamp
            </div>
            <div>
              <code className="text-foreground">gross margin</code> = (recognized revenue − labor
              cost − expenses) / recognized revenue
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </div>
        <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}

function HealthRow({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
