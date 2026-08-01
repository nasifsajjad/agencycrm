"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, X } from "lucide-react"
import { decideApprovalAction } from "@/lib/crm-actions"
import { toast } from "sonner"

export function PortalApprovalDecision({
  workspaceSlug,
  approvalId,
  portalSlug,
}: {
  workspaceSlug: string
  approvalId: string
  portalSlug: string
}) {
  const [pending, setPending] = React.useState(false)
  const [note, setNote] = React.useState("")
  const router = useRouter()

  async function decide(decision: "approved" | "changes_requested") {
    setPending(true)
    try {
      const res = await decideApprovalAction(workspaceSlug, approvalId, decision, note)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(decision === "approved" ? "Approved — thank you" : "Changes requested")
      setNote("")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor="note" className="text-xs">
          Your feedback (optional)
        </Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Add a comment for the team…"
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => decide("approved")}
          disabled={pending}
          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
          size="sm"
        >
          <Check className="mr-1 h-3.5 w-3.5" /> Approve
        </Button>
        <Button
          onClick={() => decide("changes_requested")}
          disabled={pending}
          variant="outline"
          size="sm"
          className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300"
        >
          <X className="mr-1 h-3.5 w-3.5" /> Request changes
        </Button>
      </div>
    </div>
  )
}
