"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Calendar } from "lucide-react"

export function BookDemoForm() {
  const [pending, setPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      const fd = new FormData(e.currentTarget)
      const response = await fetch("/api/marketing-inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "demo",
          name: fd.get("name"),
          email: fd.get("email"),
          agency: fd.get("agency"),
          teamSize: fd.get("teamSize"),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? "Unable to request a demo.")
      }
      toast.success("Demo request sent. We’ll be in touch.")
      ;(e.target as HTMLFormElement).reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request a demo.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="agency">Agency name</Label>
        <Input id="agency" name="agency" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="teamSize">Team size</Label>
        <select
          id="teamSize"
          name="teamSize"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          defaultValue="6-20"
        >
          <option>1-5</option>
          <option>6-20</option>
          <option>21-50</option>
          <option>51-200</option>
          <option>200+</option>
        </select>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        <Calendar className="mr-1 h-4 w-4" /> {pending ? "Submitting…" : "Request demo"}
      </Button>
      <p className="text-xs text-muted-foreground">
        We’ll follow up to schedule a tailored walkthrough.
      </p>
    </form>
  )
}
