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

/** Columns of the qualification board, in flow order. */
const LEAD_COLUMNS = [
  { status: "new", title: "New" },
  { status: "qualified", title: "Qualified" },
  { status: "disqualified", title: "Disqualified" },
  { status: "converted", title: "Converted" },
] as const

/**
 * Cards fetched per column. A board column is only scannable to a point, and
 * each column carries its true total in its badge, so the cap bounds the query
 * without hiding the size of the pipeline.
 */
const LEADS_PER_COLUMN = 50

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

  // Fetched per column rather than as one capped list.
  //
  // The previous query took the 100 most recent leads across every status and
  // then split them client-side. Because the cap spans all statuses, a burst of
  // converted leads could fill it entirely and leave the "New" column rendering
  // empty while unworked leads existed — the board would quietly lie about the
  // state of the pipeline. Each column now gets its own query and its own true
  // count.
  const columnResults = await Promise.all(
    LEAD_COLUMNS.map(async (column) => {
      const where = { workspaceId: ctx.workspaceId, status: column.status, archivedAt: null }
      const [leads, total] = await Promise.all([
        db.lead.findMany({
          where,
          include: { contact: true, company: true, owner: true },
          orderBy: { createdAt: "desc" },
          take: LEADS_PER_COLUMN,
        }),
        db.lead.count({ where }),
      ])
      return { ...column, leads, total }
    })
  )

  const totalLeads = columnResults.reduce((sum, column) => sum + column.total, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Leads"
        description={`${totalLeads} ${totalLeads === 1 ? "lead" : "leads"} in your inbox`}
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
      {totalLeads === 0 ? (
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
          {columnResults.map((col) => (
            <div key={col.status} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-medium">{col.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {col.total}
                </Badge>
              </div>
              {col.leads.length < col.total && (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Showing the {col.leads.length} most recent of {col.total}
                </p>
              )}
              <div className="space-y-2">
                {col.leads.map((l) => (
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
                {col.leads.length === 0 && (
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
