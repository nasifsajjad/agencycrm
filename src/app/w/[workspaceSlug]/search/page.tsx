import Link from "next/link";
import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { PageHeader, EmptyState } from "@/components/app/states";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Briefcase, FolderKanban, UserCircle, KanbanSquare, FileCheck2 } from "lucide-react";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { q } = await searchParams;
  const ctx = await resolveWorkspace(workspaceSlug);

  const query = (q ?? "").trim();
  const filter = query ? {
    workspaceId: ctx.workspaceId,
    OR: [
      { name: { contains: query } },
      { firstName: { contains: query } },
      { lastName: { contains: query } },
      { email: { contains: query } },
      { domain: { contains: query } },
      { title: { contains: query } },
      { subject: { contains: query } },
    ].slice(0, 2),
  } : undefined;

  let results: { type: string; id: string; label: string; sub?: string; href: string; icon: any }[] = [];

  if (query) {
    const [contacts, companies, clients, projects, deals, approvals] = await Promise.all([
      db.contact.findMany({
        where: { workspaceId: ctx.workspaceId, OR: [{ firstName: { contains: query } }, { lastName: { contains: query } }, { email: { contains: query } }] },
        take: 10,
      }),
      db.company.findMany({
        where: { workspaceId: ctx.workspaceId, OR: [{ name: { contains: query } }, { domain: { contains: query } }] },
        take: 10,
      }),
      db.client.findMany({
        where: { workspaceId: ctx.workspaceId, OR: [{ name: { contains: query } }, { code: { contains: query } }] },
        take: 10,
      }),
      db.project.findMany({
        where: { workspaceId: ctx.workspaceId, OR: [{ name: { contains: query } }, { code: { contains: query } }, { description: { contains: query } }] },
        take: 10,
      }),
      db.deal.findMany({
        where: { workspaceId: ctx.workspaceId, name: { contains: query } },
        take: 10,
      }),
      db.approvalRequest.findMany({
        where: { workspaceId: ctx.workspaceId, title: { contains: query } },
        take: 10,
      }),
    ]);

    results = [
      ...contacts.map((c) => ({ type: "Contact", id: c.id, label: `${c.firstName} ${c.lastName}`.trim(), sub: c.email ?? undefined, href: `/w/${workspaceSlug}/crm/contacts`, icon: UserCircle })),
      ...companies.map((c) => ({ type: "Company", id: c.id, label: c.name, sub: c.domain ?? undefined, href: `/w/${workspaceSlug}/crm/companies`, icon: Building2 })),
      ...clients.map((c) => ({ type: "Client", id: c.id, label: c.name, sub: c.code ?? undefined, href: `/w/${workspaceSlug}/clients/${c.id}`, icon: Briefcase })),
      ...projects.map((p) => ({ type: "Project", id: p.id, label: p.name, sub: p.code ?? undefined, href: `/w/${workspaceSlug}/projects/${p.id}`, icon: FolderKanban })),
      ...deals.map((d) => ({ type: "Deal", id: d.id, label: d.name, href: `/w/${workspaceSlug}/crm/deals`, icon: KanbanSquare })),
      ...approvals.map((a) => ({ type: "Approval", id: a.id, label: a.title, href: `/w/${workspaceSlug}/approvals/${a.id}`, icon: FileCheck2 })),
    ];
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Search" description="Search across contacts, companies, clients, projects, deals, and approvals." />
      <form className="mb-6">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search…" className="pl-9 h-11 text-base" autoFocus />
        </div>
        <button type="submit" className="sr-only">Search</button>
      </form>
      {!query ? (
        <EmptyState title="Start typing to search" description="Search is permission-aware — you'll only see records you can access." />
      ) : results.length === 0 ? (
        <EmptyState title={`No results for "${query}"`} description="Try a different query." />
      ) : (
        <Card className="divide-y divide-border/40">
          {results.map((r) => (
            <Link key={`${r.type}-${r.id}`} href={r.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
              <r.icon className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.label}</div>
                {r.sub && <div className="truncate text-xs text-muted-foreground">{r.sub}</div>}
              </div>
              <span className="text-xs text-muted-foreground">{r.type}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
