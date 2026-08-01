"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { convertDealToClientAction, moveDealAction } from "@/lib/crm-actions"
import { formatMoney, initials } from "@/lib/format"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Deal {
  id: string
  name: string
  amountMinor: string
  currency: string
  probability: number
  company: string | null
  ownerName: string | null
  stageId: string
  stageName: string
  stageColor: string | null
  isClosed: boolean
  isWon: boolean
  converted: boolean
}

export function DealsBoard({
  workspaceSlug,
  stages,
  deals,
  canEdit,
}: {
  workspaceSlug: string
  stages: {
    id: string
    name: string
    color?: string | null
    isClosed?: boolean
    isWon?: boolean
    probability?: number
  }[]
  deals: Deal[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  async function onDragEnd(result: DragEndEvent) {
    if (!result.over || result.over.id === result.active.id) return
    const dealId = String(result.active.id)
    const newStageId = String(result.over.id)
    setPendingId(dealId)
    try {
      const res = await moveDealAction(workspaceSlug, dealId, newStageId)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Deal moved")
      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  async function convert(dealId: string) {
    setPendingId(dealId)
    try {
      const res = await convertDealToClientAction(workspaceSlug, dealId)
      if (res?.error) toast.error(res.error)
      else {
        toast.success("Deal converted to client")
        router.refresh()
      }
    } finally {
      setPendingId(null)
    }
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stageId === stage.id)
          const total = stageDeals.reduce((s, d) => s + BigInt(d.amountMinor), 0n)
          return (
            <div
              key={stage.id}
              className="flex w-72 shrink-0 flex-col rounded-lg border border-border/60 bg-muted/20"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: stage.color ?? "var(--muted-foreground)" }}
                  />
                  <span className="text-sm font-medium">{stage.name}</span>
                  <span className="text-xs text-muted-foreground">{stageDeals.length}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatMoney(total)}
                </span>
              </div>
              <DroppableContainer id={stage.id}>
                <div className="flex-1 space-y-2 p-2 min-h-[200px]">
                  {stageDeals.map((d) => (
                    <DraggableDealCard
                      key={d.id}
                      deal={d}
                      pending={pendingId === d.id}
                      disabled={!canEdit || d.isClosed}
                      onConvert={() => convert(d.id)}
                    />
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                      Drop deals here
                    </div>
                  )}
                </div>
              </DroppableContainer>
            </div>
          )
        })}
      </div>
    </DndContext>
  )
}

function DroppableContainer({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={isOver ? "bg-muted/40" : ""}>
      {children}
    </div>
  )
}

function DraggableDealCard({
  deal,
  pending,
  disabled,
  onConvert,
}: {
  deal: Deal
  pending: boolean
  disabled: boolean
  onConvert: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled,
  })
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: pending ? 0.5 : isDragging ? 0.7 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-md border border-border/60 bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{deal.name}</div>
          {deal.company && (
            <div className="truncate text-xs text-muted-foreground">{deal.company}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-medium tabular-nums">
            {formatMoney(BigInt(deal.amountMinor))}
          </div>
          <div className="text-[10px] text-muted-foreground">{deal.probability}%</div>
        </div>
      </div>
      {deal.ownerName && (
        <div className="mt-2 flex items-center justify-end">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px]">{initials(deal.ownerName)}</AvatarFallback>
          </Avatar>
        </div>
      )}
      {deal.isWon && !deal.converted && (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onConvert() }}
          className="mt-2 w-full rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          Convert to client
        </button>
      )}
    </div>
  )
}
