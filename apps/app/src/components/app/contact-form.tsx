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
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createContactAction } from "@/lib/crm-actions"
import { toast } from "sonner"

export function ContactFormDialog({
  workspaceSlug,
  companies,
  members,
  trigger,
  defaultOpen,
}: {
  workspaceSlug: string
  companies: { id: string; name: string }[]
  members: { id: string; name: string }[]
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
      const res = await createContactAction(workspaceSlug, new FormData(e.currentTarget))
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Contact created")
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
          <DialogTitle>New contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" name="jobTitle" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companyId">Company</Label>
            <select
              id="companyId"
              name="companyId"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">— None —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lifecycleStage">Lifecycle stage</Label>
              <select
                id="lifecycleStage"
                name="lifecycleStage"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue="lead"
              >
                <option value="lead">Lead</option>
                <option value="engaged">Engaged</option>
                <option value="customer">Customer</option>
                <option value="churned">Churned</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerId">Owner</Label>
              <select
                id="ownerId"
                name="ownerId"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">— Unassigned —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
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
              {pending ? "Creating…" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
