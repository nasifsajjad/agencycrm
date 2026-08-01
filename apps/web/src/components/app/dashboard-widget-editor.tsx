"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  createDashboardWidgetAction,
  deleteDashboardWidgetAction,
} from "@/lib/customization-actions"
import { toast } from "sonner"
import { Trash2, Plus } from "lucide-react"

const WIDGET_TYPES = [
  { value: "pipeline_value", label: "Pipeline value" },
  { value: "active_clients", label: "Active clients" },
  { value: "approvals_pending", label: "Pending approvals" },
  { value: "utilization", label: "Utilization (7d)" },
  { value: "at_risk_clients", label: "At-risk clients" },
  { value: "my_open_tasks", label: "My open tasks" },
  { value: "recent_activity", label: "Recent activity" },
  { value: "invoices_outstanding", label: "Outstanding invoices" },
]

export function DashboardWidgetEditor({
  workspaceSlug,
  dashboardId,
  existing,
}: {
  workspaceSlug: string
  dashboardId: string
  existing: { id: string; widgetType: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const router = useRouter()

  async function onAdd(widgetType: string) {
    setPending(true)
    try {
      const fd = new FormData()
      fd.set("widgetType", widgetType)
      fd.set("queryJson", "{}")
      fd.set("displayJson", "{}")
      await createDashboardWidgetAction(workspaceSlug, dashboardId, fd)
      toast.success("Widget added")
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed")
    } finally {
      setPending(false)
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteDashboardWidgetAction(workspaceSlug, id)
      toast.success("Removed")
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed")
    }
  }

  return (
    <div className="space-y-2">
      {existing.map((w) => (
        <div
          key={w.id}
          className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm"
        >
          <span className="capitalize">{w.widgetType.replace(/_/g, " ")}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(w.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {open ? (
        <div className="rounded-md border border-border/60 p-3 space-y-2">
          <Label className="text-xs">Choose widget</Label>
          <div className="grid grid-cols-2 gap-1">
            {WIDGET_TYPES.map((t) => (
              <Button
                key={t.value}
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onAdd(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add widget
        </Button>
      )}
    </div>
  )
}
