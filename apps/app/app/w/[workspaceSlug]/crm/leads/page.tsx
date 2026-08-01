import Link from "next/link"
import { Plus } from "lucide-react"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LeadFormDialog } from "@/components/app/lead-form"
import { LeadStatusSelect } from "@/components/app/lead-status-select"
import { humanStatus, classForStatus, initials } from "@/lib/format"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ new?: string }>
}) {
  const { workspaceSlug } = await params
  const { new: isNew } = await searchParams
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "crm.read")) return <Forbidden />

  const leads = await db.lead.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { contact: true, company: true, owner: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const byStatus = (status: string) => leads.filter((l) => l.status === status)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Leads"
        description={`${leads.length} ${leads.length === 1 ? "lead" : "leads"} in your inbox`}
        action={
          can(ctx, "crm.create") && (
            <LeadFormDialog
              workspaceSlug={workspaceSlug}
              defaultOpen={isNew === "1"}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New lead
                </Button>
              }
            />
          )
        }
      />
      {leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Capture your first lead to start the qualification flow."
          action={
            can(ctx, "crm.create")
              ? { label: "New lead", href: `/w/${workspaceSlug}/crm/leads?new=1` }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { status: "new", title: "New" },
            { status: "qualified", title: "Qualified" },
            { status: "disqualified", title: "Disqualified" },
            { status: "converted", title: "Converted" },
          ].map((col) => (
            <div key={col.status} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-medium">{col.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {byStatus(col.status).length}
                </Badge>
              </div>
              <div className="space-y-2">
                {byStatus(col.status).map((l) => (
                  <Card key={l.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {l.contact
                            ? `${l.contact.firstName} ${l.contact.lastName}`
                            : (l.company?.name ?? "Unnamed")}
                        </div>
                        {l.contact?.email && (
                          <div className="truncate text-xs text-muted-foreground">
                            {l.contact.email}
                          </div>
                        )}
                        {l.company && (
                          <Link
                            href={`/w/${workspaceSlug}/crm/companies/${l.company.id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {l.company.name}
                          </Link>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          l.score >= 70
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "text-muted-foreground"
                        }
                      >
                        {l.score}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{l.source ?? "—"}</span>
                      {l.owner && (
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px]">
                            {initials(l.owner.displayName)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    {can(ctx, "crm.update") && (
                      <div className="mt-2">
                        <LeadStatusSelect
                          workspaceSlug={workspaceSlug}
                          leadId={l.id}
                          currentStatus={l.status}
                        />
                      </div>
                    )}
                  </Card>
                ))}
                {byStatus(col.status).length === 0 && (
                  <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
