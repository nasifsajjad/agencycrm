"use client"

import * as React from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { safeRedirectPath } from "@agencyos/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  signInAction,
  signUpAction,
  forgotPasswordAction,
  signInWithMagicLinkAction,
} from "@/lib/auth-actions"
export function AuthCard({
  title,
  subtitle,
  footerText,
  footerHref,
  footerLabel,
  children,
}: {
  title: string
  subtitle: string
  footerText: string
  footerHref: string
  footerLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute inset-0 grid-pattern opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/60 to-background" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-lg">AgencyOS</span>
        </Link>
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {footerText}{" "}
          <Link
            href={footerHref}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {footerLabel}
          </Link>
        </p>
      </div>
    </div>
  )
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const search = useSearchParams()
  const next = safeRedirectPath(search.get("next"), "/app")
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)
    try {
      const formData = new FormData(e.currentTarget)
      if (mode === "sign-in") {
        formData.set("next", next)
        const res = await signInAction(formData)
        if (res?.error) setError(res.error)
      } else {
        const res = await signUpAction(formData)
        if (res?.error) setError(res.error)
        else if (res?.needsEmailConfirmation)
          setMessage("Check your email to confirm your account before signing in.")
      }
    } catch (e: any) {
      // Next redirect throws — swallow
      if (e?.digest?.startsWith("NEXT_REDIRECT")) return
      setError(e?.message ?? "Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  async function onMagicLink(e: React.MouseEvent<HTMLButtonElement>) {
    setError(null)
    setMessage(null)
    const form = e.currentTarget.form
    if (!form) return
    const formData = new FormData(form)
    if (!String(formData.get("email") ?? "").trim()) {
      setError("Enter your email address first.")
      return
    }
    formData.set("next", next)
    setPending(true)
    try {
      const res = await signInWithMagicLinkAction(formData)
      if (res?.error) setError(res.error)
      // Same message whether or not the account exists, so this cannot be
      // used to enumerate accounts.
      else setMessage("If an account exists for that email, a sign-in link is on its way.")
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "sign-up" && (
        <Field label="Your name" name="name" type="text" placeholder="Avery Chen" />
      )}
      <Field label="Email" name="email" type="email" placeholder="you@agency.com" required />
      <Field label="Password" name="password" type="password" placeholder="••••••••" required />
      {mode === "sign-up" && (
        <Field
          label="Workspace name (optional)"
          name="workspace"
          type="text"
          placeholder="Northstar Growth Studio"
          hint="We'll provision a workspace and make you the owner."
        />
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {mode === "sign-in" && (
        <p className="text-right text-xs">
          <Link href="/forgot-password" className="underline underline-offset-4">
            Forgot password?
          </Link>
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
      {mode === "sign-in" && (
        <>
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-xs text-muted-foreground">or</span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={onMagicLink}
          >
            Email me a sign-in link
          </Button>
        </>
      )}
      <p className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-foreground">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  )
}

export function ForgotPasswordForm() {
  const [done, setDone] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    try {
      await forgotPasswordAction(new FormData(e.currentTarget))
      setDone(true)
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <Alert>
        <AlertDescription>
          If an account exists for that email, a reset link is on its way.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" name="email" type="email" placeholder="you@agency.com" required />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  )
}

function Field({
  label,
  name,
  type,
  placeholder,
  required,
  hint,
}: {
  label: string
  name: string
  type: string
  placeholder?: string
  required?: boolean
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={type === "password" ? "current-password" : undefined}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
