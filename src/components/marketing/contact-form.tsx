"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function ContactForm() {
  const [pending, setPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      // Local capture: store the message in localStorage as a stand-in for an email adapter.
      // In production this would POST to /api/contact which would enqueue an email.
      const fd = new FormData(e.currentTarget)
      const data = Object.fromEntries(fd.entries())
      try {
        const existing = JSON.parse(localStorage.getItem("agencyos:contact-submissions") ?? "[]")
        existing.push({ ...data, at: new Date().toISOString() })
        localStorage.setItem("agencyos:contact-submissions", JSON.stringify(existing))
      } catch {
        // localStorage may be unavailable
      }
      toast.success("Message captured. In production this would be emailed to the team.")
      ;(e.target as HTMLFormElement).reset()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="agency">Agency name</Label>
        <Input id="agency" name="agency" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">How can we help?</Label>
        <Textarea id="message" name="message" rows={4} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Local mode: messages are captured to your browser&apos;s localStorage. Production deployment
        delivers via the email adapter.
      </p>
    </form>
  )
}
