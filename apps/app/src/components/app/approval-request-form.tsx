"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createApprovalRequestAction } from "@/lib/crm-actions"

export type ApproverOption = { id: string; name: string; email: string }

/**
 * Requests approval on a record.
 *
 * Approval requires every chosen approver to approve; any one of them
 * requesting changes sends the work back immediately (migration 0027). The
 * dialog says so, because "all approvers" versus "any approver" is exactly the
 * kind of routing rule people assume rather than read.
 */
export function ApprovalRequestDialog({
  workspaceSlug,
  entityType,
  entityId,
  defaultTitle,
  approvers,
  trigger,
}: {
  workspaceSlug: string
  entityType: string
  entityId: string
  defaultTitle?: string
  approvers: ApproverOption[]
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string[]>([])

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    )
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const title = String(formData.get("title") ?? "").trim()
    if (!title) {
      setError("Give the approval a title.")
      return
    }
    if (selected.length === 0) {
      setError("Choose at least one approver.")
      return
    }

    setPending(true)
    try {
      const result = await createApprovalRequestAction(workspaceSlug, {
        entityType,
        entityId,
        title,
        instructions: String(formData.get("instructions") ?? ""),
        dueAt: String(formData.get("dueAt") ?? "") || undefined,
        approverIds: selected,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      setSelected([])
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request approval.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Request approval</DialogTitle>
            <DialogDescription>
              Everyone you choose must approve. If any one of them requests changes, the work comes
              back to you straight away.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="approval-title">Title</Label>
              <Input
                id="approval-title"
                name="title"
                defaultValue={defaultTitle}
                placeholder="Homepage hero — round 2"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="approval-instructions">Instructions (optional)</Label>
              <Textarea
                id="approval-instructions"
                name="instructions"
                rows={3}
                placeholder="What should reviewers focus on?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="approval-due">Due (optional)</Label>
              <Input id="approval-due" name="dueAt" type="datetime-local" />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Approvers</legend>
              {approvers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No other active members to send this to yet. Invite a teammate first.
                </p>
              ) : (
                <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-md border border-border/60 p-2">
                  {approvers.map((approver) => (
                    <label
                      key={approver.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={selected.includes(approver.id)}
                        onCheckedChange={() => toggle(approver.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {approver.name}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {approver.email}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || approvers.length === 0}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {pending ? "Requesting…" : "Request approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
