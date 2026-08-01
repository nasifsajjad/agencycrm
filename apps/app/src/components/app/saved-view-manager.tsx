"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { createSavedViewAction, deleteSavedViewAction } from "@/lib/customization-actions"
import { toast } from "sonner"
import { Trash2, Plus } from "lucide-react"

export function SavedViewManager({
  workspaceSlug,
  existing,
}: {
  workspaceSlug: string
  existing: { id: string; name: string; entityType: string; visibility: string }[]
}) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await createSavedViewAction(workspaceSlug, new FormData(e.currentTarget))
      if ((res as any)?.error) {
        setError((res as any).error)
        return
      }
      toast.success("Saved view created")
      router.refresh()
      ;(e.target as HTMLFormElement).reset()
    } catch (e: any) {
      setError(e?.message ?? "Failed")
    } finally {
      setPending(false)
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteSavedViewAction(workspaceSlug, id)
      toast.success("Deleted")
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed")
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border/60 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">View name *</Label>
            <Input id="name" name="name" placeholder="My open deals" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entityType">Entity *</Label>
            <select
              id="entityType"
              name="entityType"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="contact">Contacts</option>
              <option value="company">Companies</option>
              <option value="lead">Leads</option>
              <option value="deal">Deals</option>
              <option value="client">Clients</option>
              <option value="project">Projects</option>
              <option value="task">Tasks</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              name="visibility"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue="private"
            >
              <option value="private">Private (just me)</option>
              <option value="workspace">Workspace (all members)</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="queryJson">Query (JSON)</Label>
          <Textarea
            id="queryJson"
            name="queryJson"
            rows={2}
            placeholder='{"status":"open"}'
            defaultValue="{}"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={pending} size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" /> {pending ? "Creating…" : "Save view"}
        </Button>
      </form>

      <div className="space-y-2">
        {existing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved views yet.</p>
        ) : (
          existing.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{v.name}</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">
                  {v.entityType}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">·</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">
                  {v.visibility}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onDelete(v.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
