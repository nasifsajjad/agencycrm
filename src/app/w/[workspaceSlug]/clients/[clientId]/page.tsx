import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, Forbidden } from "@/components/app/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Users, FolderKanban, ListChecks, FileCheck2, DollarSign,
  Clock, FileText, Calendar, HeartPulse, ArrowLeft, Globe,
} from "lucide-react";
import { humanStatus, classForStatus, formatDate, formatMoney, relativeTime, initials } from "@/lib/format";
import { NoteComposer } from "@/components/app/note-composer";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; clientId: string }>;
}) {
  const { workspaceSlug, clientId } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "clients.read")) return <Forbidden />;

  const client = await db.client.findFirst({
    where: { id: clientId, workspaceId: ctx.workspaceId },
    include: {
      owner: true,
      company: true,
      clientContacts: { include: { contact: true } },
      projects: { include: { status: true, owner: true }, orderBy: { updatedAt: "desc" } },
      clientRequests: { orderBy: { createdAt: "desc" }, take: 10 },
      retainers: true,
      invoices: { orderBy: { issuedOn: "desc" }, take: 5 },
      clientHealthEvents: { orderBy: { occurredAt: "desc" }, take: 5 },
      portals: true,
      _count: { select: { deliverables: true, expenses: true } },
    },
  });
  if (!client) notFound();

  const [timeEntries, activityEvents] = await Promise.all([
    db.timeEntry.findMany({
      where: { workspaceId: ctx.workspaceId, clientId: client.id },
      include: { user: true, project: true },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    db.activityEvent.findMany({
      where: { workspaceId: ctx.workspaceId, entityId: client.id, entityType: "client" },
      include: { actorUser: true },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
  ]);

  const totalLoggedMinutes = timeEntries.reduce((s, t) => s + t.minutes, 0);
  const totalRevenue = client.invoices.reduce((s, i) => s + i.totalMinor, 0n);
  const totalPaid = client.invoices.reduce((s, i) => s + i.paidMinor, 0n);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href={`/w/${workspaceSlug}/clients`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All clients
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-foreground/5 text-base font-medium">
            {initials(client.name)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {client.code && <span>{client.code}</span>}
              <Badge variant="outline" className={classForStatus(client.status)}>{humanStatus(client.status)}</Badge>
              <HealthBadge score={client.healthScore} />
              <span>·</span>
              <span>Owner: {client.owner?.displayName ?? "—"}</span>
              {client.renewalDate && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Renewal {formatDate(client.renewalDate)}</span>
                </>
              )}
            </div>
            {client.healthReason && (
              <p className="mt-2 text-sm text-muted-foreground">{client.healthReason}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {client.porals[0] && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal/${client.porals[0].slug}`}>
                <Globe className="mr-1 h-3.5 w-3.5" /> View portal
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={Clock} label="Logged (recent)" value={`${Math.floor(totalLoggedMinutes / 60)}h ${totalLoggedMinutes % 60}m`} />
        <Metric icon={FolderKanban} label="Projects" value={String(client.projects.length)} />
        <Metric icon={DollarSign} label="Invoiced" value={formatMoney(totalRevenue)} />
        <Metric icon={DollarSign} label="Paid" value={formatMoney(totalPaid)} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> Stakeholders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.clientContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts linked.</p>
              ) : (
                client.clientContacts.map((cc) => (
                  <div key={cc.id} className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">{initials(`${cc.contact.firstName} ${cc.contact.lastName}`)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{cc.contact.firstName} {cc.contact.lastName}</div>
                      <div className="truncate text-xs text-muted-foreground">{cc.contact.email ?? "—"}</div>
                    </div>
                    {cc.isPrimary && <Badge variant="outline" className="text-xs">Primary</Badge>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4" /> Company</CardTitle>
            </CardHeader>
            <CardContent>
              {client.company ? (
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{client.company.name}</div>
                  {client.company.industry && <div className="text-muted-foreground">{client.company.industry}</div>}
                  {client.company.domain && (
                    <a href={`https://${client.company.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                      {client.company.domain}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not linked.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><HeartPulse className="h-4 w-4" /> Health history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.clientHealthEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No health events logged.</p>
              ) : (
                client.clientHealthEvents.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-sm">
                    <HealthBadge score={e.score} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{e.reason ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{relativeTime(e.occurredAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {can(ctx, "comments.create") && (
                <NoteComposer
                  workspaceSlug={workspaceSlug}
                  entityType="client"
                  entityId={client.id}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {client.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects yet.</p>
              ) : (
                <div className="space-y-2">
                  {client.projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/w/${workspaceSlug}/projects/${p.id}`}
                      className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.code} · Due {p.dueDate ? formatDate(p.dueDate) : "—"}</div>
                      </div>
                      {p.status && <Badge variant="outline" className={classForStatus(p.status.category)}>{p.status.name}</Badge>}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Client requests</CardTitle>
            </CardHeader>
            <CardContent>
              {client.clientRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <div className="space-y-2">
                  {client.clientRequests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">Priority: {r.priority} · Due {r.dueAt ? formatDate(r.dueAt) : "—"}</div>
                      </div>
                      <Badge variant="outline" className={classForStatus(r.status)}>{humanStatus(r.status)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Retainers</CardTitle>
            </CardHeader>
            <CardContent>
              {client.retainers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No retainers.</p>
              ) : (
                <div className="space-y-2">
                  {client.retainers.map((r) => (
                    <div key={r.id} className="rounded-md border border-border/40 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.name}</span>
                        <Badge variant="outline" className={classForStatus(r.status)}>{humanStatus(r.status)}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatMoney(r.amountMinor)} / month · {Math.floor(r.includedMinutes / 60)}h included
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {client.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices.</p>
              ) : (
                <div className="space-y-2">
                  {client.invoices.map((i) => (
                    <div key={i.id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{i.number}</div>
                        <div className="text-xs text-muted-foreground">Issued {formatDate(i.issuedOn)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium tabular-nums">{formatMoney(i.totalMinor)}</div>
                        <Badge variant="outline" className={classForStatus(i.status)}>{humanStatus(i.status)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activityEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {activityEvents.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 text-sm">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-foreground/5 text-[10px] font-medium">
                        {initials(e.actorUser?.displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div>
                          <span className="font-medium">{e.actorUser?.displayName ?? "Someone"}</span>{" "}
                          <span className="text-muted-foreground">{e.verb.replace(/[._]/g, " ")}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{relativeTime(e.occurredAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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

function HealthBadge({ score }: { score: number }) {
  let cls = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (score >= 75) cls = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  else if (score >= 50) cls = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return <Badge variant="outline" className={cls}>{score}</Badge>;
}
