"use client"

import * as React from "react"
import { resetPasswordAction } from "@/lib/auth-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function ResetPasswordForm() {
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        setError(null)
        setPending(true)
        try {
          const result = await resetPasswordAction(new FormData(event.currentTarget))
          if (result?.error) setError(result.error)
        } catch (caught) {
          if (!(caught && typeof caught === "object" && "digest" in caught && String(caught.digest).startsWith("NEXT_REDIRECT"))) {
            setError("Unable to reset password. Request a new link and try again.")
          }
        } finally {
          setPending(false)
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button className="w-full" disabled={pending}>{pending ? "Saving…" : "Save new password"}</Button>
    </form>
  )
}
