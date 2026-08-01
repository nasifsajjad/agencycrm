import { Plus } from "lucide-react"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Button } from "@/components/ui/button"
import { DealFormDialog } from "@/components/app/deal-form"
import { DealsBoard } from "@/components/app/deals-board"
import { formatMoney } from "@/lib/format"

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
  const [deals, companies, contacts] = await Promise.all([
    db.deal.findMany({
      where: { workspaceId: ctx.workspaceId, pipelineId: pipeline.id },
      include: { stage: true, company: true, primaryContact: true, owner: true },
      orderBy: { amountMinor: "desc" },
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

  const totalValue = deals.reduce((s, d) => s + d.amountMinor, 0n)
  const weightedValue = deals.reduce(
    (s, d) => s + (d.amountMinor * BigInt(d.probability)) / 100n,
    0n
  )

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Deals"
        description={`${deals.length} deals · ${formatMoney(totalValue)} pipeline · ${formatMoney(weightedValue)} weighted`}
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
        <DealsBoard
          workspaceSlug={workspaceSlug}
          stages={pipeline.stages}
          deals={deals.map((d) => ({
            id: d.id,
            name: d.name,
            amountMinor: d.amountMinor.toString(),
            currency: d.currency,
            probability: d.probability,
            company: d.company?.name ?? null,
            ownerName: d.owner?.displayName ?? null,
            stageId: d.stageId ?? "",
            stageName: d.stage?.name ?? "",
            stageColor: d.stage?.color ?? null,
            isClosed: d.stage?.isClosed ?? false,
          }))}
          canEdit={can(ctx, "crm.update")}
        />
      )}
    </div>
  )
}
