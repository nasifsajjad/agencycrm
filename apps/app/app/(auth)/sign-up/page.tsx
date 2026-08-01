import { Suspense } from "react"
import { AuthCard, AuthForm } from "@/components/auth/auth-form"

export const metadata = { title: "Start free" }

export default function SignUpPage() {
  return (
    <AuthCard
      title="Start your agency workspace"
      subtitle="Free for the first 5 seats. No credit card required."
      footerText="Already have an account?"
      footerHref="/sign-in"
      footerLabel="Sign in"
    >
      <Suspense
        fallback={<div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>}
      >
        <AuthForm mode="sign-up" />
      </Suspense>
    </AuthCard>
  )
}
