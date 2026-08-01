"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { createNoteAction } from "@/lib/crm-actions"
import { toast } from "sonner"

export function NoteComposer({
  workspaceSlug,
  entityType,
  entityId,
}: {
  workspaceSlug: string
  entityType: string
  entityId: string
}) {
  const [body, setBody] = React.useState("")
  const [visibility, setVisibility] = React.useState("internal")
  const [pending, setPending] = React.useState(false)
  const router = useRouter()

  async function onSubmit() {
    if (!body.trim()) return
    setPending(true)
    try {
      const fd = new FormData()
      fd.set("bodyRich", body)
      fd.set("entityType", entityType)
      fd.set("entityId", entityId)
      fd.set("visibility", visibility)
      const res = await createNoteAction(workspaceSlug, fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Note added")
      setBody("")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="note">Add a note</Label>
      <Textarea
        id="note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write an internal or client-visible note…"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <Select value={visibility} onValueChange={setVisibility}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="client">Client-visible</SelectItem>
            <SelectItem value="restricted">Restricted</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onSubmit} disabled={pending || !body.trim()}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </div>
  )
}
