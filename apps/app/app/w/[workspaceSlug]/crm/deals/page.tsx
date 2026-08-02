import { Plus } from "lucide-react"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { DealFormDialog } from "@/components/app/deal-form"
import { DealsBoard } from "@/components/app/deals-board"
import { formatMoney } from "@/lib/format"

/**
 * Most cards a Kanban column can usefully hold. Deals are ordered by value, so
 * the cap keeps the highest-value work visible, and the page says so when it
 * has hidden anything.
 */
const BOARD_DEAL_LIMIT = 200

export default async function DealsPage({
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

  const pipeline = await db.pipeline.findFirstOrThrow({
    where: { workspaceId: ctx.workspaceId, isDefault: true },
    include: { stages: { orderBy: { position: "asc" } } },
  })
  const dealsWhere = { workspaceId: ctx.workspaceId, pipelineId: pipeline.id }

  const [deals, dealTotals, companies, contacts] = await Promise.all([
    db.deal.findMany({
      where: dealsWhere,
      include: { stage: true, company: true, primaryContact: true, owner: true },
      orderBy: { amountMinor: "desc" },
      // A Kanban cannot take page controls, but this query was previously
      // unbounded — every deal in the workspace, each with four joined
      // relations, hydrated into the board on every render. Cap it, and tell
      // the user when the board is not showing everything.
      take: BOARD_DEAL_LIMIT,
    }),
    // Totals must reflect the whole pipeline, not just the capped board, so
    // they are computed from a projection of two columns rather than from the
    // hydrated rows above.
    db.deal.findMany({
      where: dealsWhere,
      select: { amountMinor: true, probability: true },
    }),
    db.company.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.contact.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { lastName: "asc" },
    }),
  ])

  const totalValue = dealTotals.reduce((s, d) => s + d.amountMinor, 0n)
  const weightedValue = dealTotals.reduce(
    (s, d) => s + (d.amountMinor * BigInt(d.probability)) / 100n,
    0n
  )
  const truncated = deals.length < dealTotals.length

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Deals"
        description={`${dealTotals.length} deals · ${formatMoney(totalValue)} pipeline · ${formatMoney(weightedValue)} weighted`}
        action={
          can(ctx, "crm.create") && (
            <DealFormDialog
              workspaceSlug={workspaceSlug}
              stages={pipeline.stages}
              companies={companies}
              contacts={contacts}
              defaultOpen={isNew === "1"}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New deal
                </Button>
              }
            />
          )
        }
      />
      {deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Add your first deal to start tracking pipeline."
          action={
            can(ctx, "crm.create")
              ? { label: "New deal", href: `/w/${workspaceSlug}/crm/deals?new=1` }
              : undefined
          }
        />
      ) : (
        <>
          {truncated && (
            <p
              role="status"
              className="mb-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            >
              Showing the {BOARD_DEAL_LIMIT} largest deals by value. The totals above cover all{" "}
              {dealTotals.length}. Narrow the pipeline or use reports to see the rest.
            </p>
          )}
          <DealsBoard
            workspaceSlug={workspaceSlug}
            stages={pipeline.stages}
            deals={deals.map((d) => ({
              id: d.id,
              name: d.name,
              amountMinor: d.amountMinor.toString(),
              currency: d.currency,
              probability: d.probability,
              isWon: d.stage?.isWon ?? false,
              converted: Boolean(d.convertedClientId),
              company: d.company?.name ?? null,
              ownerName: d.owner?.displayName ?? null,
              stageId: d.stageId ?? "",
              stageName: d.stage?.name ?? "",
              stageColor: d.stage?.color ?? null,
              isClosed: d.stage?.isClosed ?? false,
            }))}
            canEdit={can(ctx, "crm.update")}
          />
        </>
      )}
    </div>
  )
}
