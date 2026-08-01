import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader, EmptyState } from "@/components/app/states"
import { formatMoney, formatDate, classForStatus, humanStatus } from "@/lib/format"

export default async function PortalReportsPage({
  params,
}: {
  params: Promise<{ portalSlug: string }>
}) {
  const { portalSlug } = await params
  const portal = await db.clientPortal.findUnique({
    where: { slug: portalSlug },
    include: { client: true, workspace: true },
  })
  if (!portal) return null

  const [invoices, retainers, projects] = await Promise.all([
    db.invoice.findMany({
      where: { workspaceId: portal.workspaceId, clientId: portal.clientId },
      orderBy: { issuedOn: "desc" },
      take: 12,
    }),
    db.retainer.findMany({ where: { clientId: portal.clientId, status: "active" } }),
    db.project.findMany({
      where: { workspaceId: portal.workspaceId, clientId: portal.clientId, visibility: "client" },
      include: { status: true },
    }),
  ])

  const totalInvoiced = invoices.reduce((s, i) => s + i.totalMinor, 0n)
  const totalPaid = invoices.reduce((s, i) => s + i.paidMinor, 0n)

  return (
    <div>
      <PageHeader title="Reports" description="Published reports and summaries" />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total invoiced</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(totalInvoiced)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total paid</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active projects</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{projects.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices published yet.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {invoices.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between border-b border-border/30 py-1.5 last:border-0"
                  >
                    <div>
                      <div className="font-medium">{i.number}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(i.issuedOn)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{formatMoney(i.totalMinor)}</span>
                      <Badge variant="outline" className={classForStatus(i.status)}>
                        {humanStatus(i.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active retainers</CardTitle>
          </CardHeader>
          <CardContent>
            {retainers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No retainers.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {retainers.map((r) => (
                  <div key={r.id} className="border-b border-border/30 py-1.5 last:border-0">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMoney(r.amountMinor)}/mo · {Math.floor(r.includedMinutes / 60)}h
                      included
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
