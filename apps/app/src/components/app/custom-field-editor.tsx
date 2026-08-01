"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { createCustomFieldAction, deleteCustomFieldAction } from "@/lib/customization-actions"
import { toast } from "sonner"
import { Trash2, Plus } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function CustomFieldEditor({
  workspaceSlug,
  existing,
}: {
  workspaceSlug: string
  existing: {
    id: string
    key: string
    label: string
    dataType: string
    entityType: string
    required: boolean
    optionsJson: any
  }[]
}) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await createCustomFieldAction(workspaceSlug, new FormData(e.currentTarget))
      if ((res as any)?.error) {
        setError((res as any).error)
        return
      }
      toast.success("Custom field created")
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
      await deleteCustomFieldAction(workspaceSlug, id)
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
            <Label htmlFor="label">Label *</Label>
            <Input id="label" name="label" placeholder="Client tier" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="key">Key</Label>
            <Input id="key" name="key" placeholder="auto-derived from label" />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits, underscores. Auto-derived if blank.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entityType">Entity *</Label>
            <select
              id="entityType"
              name="entityType"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              required
            >
              <option value="contact">Contact</option>
              <option value="company">Company</option>
              <option value="lead">Lead</option>
              <option value="deal">Deal</option>
              <option value="client">Client</option>
              <option value="project">Project</option>
              <option value="task">Task</option>
              <option value="campaign">Campaign</option>
              <option value="deliverable">Deliverable</option>
              <option value="invoice">Invoice</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dataType">Type *</Label>
            <select
              id="dataType"
              name="dataType"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue="text"
            >
              <option value="text">Text</option>
              <option value="longtext">Long text</option>
              <option value="number">Number</option>
              <option value="currency">Currency</option>
              <option value="percentage">Percentage</option>
              <option value="boolean">Boolean</option>
              <option value="date">Date</option>
              <option value="datetime">Datetime</option>
              <option value="select">Single select</option>
              <option value="multiselect">Multi-select</option>
              <option value="email">Email</option>
              <option value="url">URL</option>
              <option value="phone">Phone</option>
              <option value="user">User</option>
              <option value="company">Company</option>
              <option value="contact">Contact</option>
              <option value="client">Client</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="options">Options (one per line, for select/multiselect only)</Label>
          <Textarea id="options" name="options" rows={2} placeholder={"Tier 1\nTier 2\nTier 3"} />
        </div>
        <div className="flex items-center gap-2">
          <input id="required" name="required" type="checkbox" className="rounded" />
          <Label htmlFor="required">Required</Label>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={pending} size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" /> {pending ? "Creating…" : "Add field"}
        </Button>
      </form>

      <div className="space-y-2">
        {existing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom fields yet. Add one above.</p>
        ) : (
          existing.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{f.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{f.key}</span>
                <span className="ml-2 text-xs text-muted-foreground">·</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">{f.dataType}</span>
                <span className="ml-2 text-xs text-muted-foreground">·</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">
                  {f.entityType}
                </span>
                {f.required && <span className="ml-2 text-xs text-danger">required</span>}
                {f.optionsJson?.options && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({f.optionsJson.options.length} options)
                  </span>
                )}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete custom field "{f.label}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Existing values will be archived but not destroyed. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(f.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
