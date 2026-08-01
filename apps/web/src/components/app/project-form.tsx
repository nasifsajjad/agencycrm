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
import { createProjectAction } from "@/lib/crm-actions"
import { toast } from "sonner"

export function ProjectFormDialog({
  workspaceSlug,
  clients,
  statuses,
  trigger,
  defaultOpen,
}: {
  workspaceSlug: string
  clients: { id: string; name: string }[]
  statuses: { id: string; name: string; category: string }[]
  trigger: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen ?? false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await createProjectAction(workspaceSlug, new FormData(e.currentTarget))
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Project created")
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="PRJ-001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientId">Client</Label>
              <select
                id="clientId"
                name="clientId"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">— None —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget">Budget (USD)</Label>
              <Input id="budget" name="budget" type="number" min="0" step="0.01" defaultValue="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
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
              {pending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
