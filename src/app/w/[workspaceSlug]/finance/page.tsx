import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, humanStatus, classForStatus, formatDate } from "@/lib/format";
import { DollarSign, TrendingUp, FileText, Receipt } from "lucide-react";

export default async function FinancePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "finance.read")) return <Forbidden />;

  const [invoices, expenses, retainers, timeEntries] = await Promise.all([
    db.invoice.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { client: true, lines: true },
      orderBy: { issuedOn: "desc" },
      take: 50,
    }),
    db.expense.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { client: true, project: true },
      orderBy: { incurredOn: "desc" },
      take: 50,
    }),
    db.retainer.findMany({
      where: { status: "active" },
      include: { client: true },
    }),
    db.timeEntry.findMany({
      where: { workspaceId: ctx.workspaceId, billable: true, status: "approved" },
      select: { minutes: true, rateMinor: true },
    }),
  ]);

  const totalInvoiced = invoices.reduce((s, i) => s + i.totalMinor, 0n);
  const totalPaid = invoices.reduce((s, i) => s + i.paidMinor, 0n);
  const outstanding = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + (i.totalMinor - i.paidMinor), 0n);
  const totalExpenses = expenses.reduce((s, e) => s + e.amountMinor, 0n);
  const recognizedRevenue = timeEntries.reduce((s, t) => s + t.rateMinor * BigInt(t.minutes) / 60n, 0n);
  const grossProfit = recognizedRevenue - totalExpenses;
  const grossMargin = recognizedRevenue > 0n ? Number((grossProfit * 100n) / recognizedRevenue) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Finance" description="Invoices, expenses, retainers, and profitability" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={DollarSign} label="Invoiced" value={formatMoney(totalInvoiced)} />
        <Metric icon={DollarSign} label="Collected" value={formatMoney(totalPaid)} />
        <Metric icon={TrendingUp} label="Outstanding" value={formatMoney(outstanding)} />
        <Metric icon={Receipt} label="Expenses" value={formatMoney(totalExpenses)} />
        <Metric icon={TrendingUp} label="Recognized" value={formatMoney(recognizedRevenue)} />
        <Metric icon={TrendingUp} label="Gross profit" value={formatMoney(grossProfit)} />
        <Metric icon={TrendingUp} label="Gross margin" value={`${grossMargin}%`} />
        <Metric icon={FileText} label="Active retainers" value={String(retainers.length)} />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="retainers">Retainers</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Invoices are created from approved time entries and retainers." />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Number</th>
                      <th className="px-4 py-2 text-left font-medium">Client</th>
                      <th className="px-4 py-2 text-left font-medium">Issued</th>
                      <th className="px-4 py-2 text-left font-medium">Due</th>
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                      <th className="px-4 py-2 text-right font-medium">Paid</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{i.number}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{i.client?.name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(i.issuedOn)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{i.dueOn ? formatDate(i.dueOn) : "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(i.totalMinor)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(i.paidMinor)}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={classForStatus(i.status)}>{humanStatus(i.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          {expenses.length === 0 ? (
            <EmptyState title="No expenses yet" description="Track billable and non-billable project expenses." />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Category</th>
                      <th className="px-4 py-2 text-left font-medium">Client</th>
                      <th className="px-4 py-2 text-left font-medium">Project</th>
                      <th className="px-4 py-2 text-left font-medium">Incurred</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                      <th className="px-4 py-2 text-left font-medium">Billable</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{e.category}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{e.client?.name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{e.project?.name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(e.incurredOn)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(e.amountMinor)}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline">{e.billable ? "Billable" : "Non-billable"}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={classForStatus(e.status)}>{humanStatus(e.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="retainers" className="mt-4">
          {retainers.length === 0 ? (
            <EmptyState title="No active retainers" description="Set up monthly retainers for recurring clients." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {retainers.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.client?.name}</div>
                    </div>
                    <Badge variant="outline" className={classForStatus(r.status)}>{humanStatus(r.status)}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly</span>
                      <span className="tabular-nums">{formatMoney(r.amountMinor)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Included</span>
                      <span className="tabular-nums">{Math.floor(r.includedMinutes / 60)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ends</span>
                      <span>{r.endDate ? formatDate(r.endDate) : "—"}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
