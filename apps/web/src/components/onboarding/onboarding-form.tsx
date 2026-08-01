"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { appHref } from "@/lib/app-links"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createWorkspaceAction, loadDemoDataAction } from "@/lib/onboarding-actions"

export function OnboardingForm({
  defaultName,
  hasWorkspaces,
}: {
  defaultName: string
  hasWorkspaces: boolean
}) {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [currency, setCurrency] = React.useState("USD")
  const [timezone, setTimezone] = React.useState("UTC")
  const [loadingDemo, setLoadingDemo] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    if (name && !slugTouched) {
      setSlug(
        name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40)
      )
    }
  }, [name])

  const [slugTouched, setSlugTouched] = React.useState(false)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await createWorkspaceAction({ name, slug, currency, timezone })
      if (res?.error) {
        setError(res.error)
        return
      }
      if (res?.slug) router.push(appHref(`/w/${res.slug}`))
    } catch (e: any) {
      if (e?.digest?.startsWith("NEXT_REDIRECT")) return
      setError(e?.message ?? "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  async function onLoadDemo() {
    setError(null)
    setLoadingDemo(true)
    try {
      const res = await loadDemoDataAction({
        name: name || "Northstar Growth Studio",
        slug: slug || "northstar",
        currency,
        timezone,
      })
      if (res?.error) {
        setError(res.error)
        return
      }
      if (res?.slug) router.push(appHref(`/w/${res.slug}`))
    } catch (e: any) {
      if (e?.digest?.startsWith("NEXT_REDIRECT")) return
      setError(e?.message ?? "Something went wrong.")
    } finally {
      setLoadingDemo(false)
    }
  }

  return (
    <form onSubmit={onCreate} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Northstar Growth Studio"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value)
            setSlugTouched(true)
          }}
          placeholder="northstar"
          required
        />
        <p className="text-xs text-muted-foreground">Used in your URL: /w/{slug || "your-slug"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
            <option>AUD</option>
            <option>CAD</option>
            <option>SGD</option>
            <option>INR</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option>UTC</option>
            <option>America/New_York</option>
            <option>America/Chicago</option>
            <option>America/Los_Angeles</option>
            <option>Europe/London</option>
            <option>Europe/Berlin</option>
            <option>Asia/Dubai</option>
            <option>Asia/Singapore</option>
            <option>Asia/Kolkata</option>
            <option>Australia/Sydney</option>
          </select>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Creating…" : "Create workspace"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loadingDemo || pending}
          onClick={onLoadDemo}
          className="flex-1"
        >
          {loadingDemo ? "Loading demo…" : "Load demo agency"}
        </Button>
      </div>
      {hasWorkspaces && (
        <p className="text-center text-xs text-muted-foreground">
          You already have a workspace. Creating a new one will switch you into it.
        </p>
      )}
    </form>
  )
}
