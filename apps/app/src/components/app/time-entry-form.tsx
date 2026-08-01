"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createTimeEntryAction } from "@/lib/crm-actions"
import { toast } from "sonner"

export function TimeEntryFormDialog({
  workspaceSlug,
  projects,
  trigger,
}: {
  workspaceSlug: string
  projects: {
    id: string
    name: string
    clientId?: string | null
    client?: { name: string } | null
  }[]
  trigger: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await createTimeEntryAction(workspaceSlug, new FormData(e.currentTarget))
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Time entry created")
      setOpen(false)
      router.refresh()
      ;(e.target as HTMLFormElement).reset()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="What did you work on?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="projectId">Project</Label>
              <select
                id="projectId"
                name="projectId"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">— None —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minutes">Minutes *</Label>
              <Input id="minutes" name="minutes" type="number" min="1" required defaultValue="60" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rateMinor">Rate (cents/hour)</Label>
              <Input id="rateMinor" name="rateMinor" type="number" min="0" defaultValue="15000" />
              <p className="text-xs text-muted-foreground">15000 = $150/hour</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startedAt">Started at</Label>
              <Input id="startedAt" name="startedAt" type="datetime-local" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="billable"
              name="billable"
              type="checkbox"
              defaultChecked
              className="rounded"
            />
            <Label htmlFor="billable">Billable</Label>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Log time"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
