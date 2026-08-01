import { Suspense } from "react"
import { AuthCard, AuthForm } from "@/components/auth/auth-form"

export const metadata = { title: "Sign in" }

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in to AgencyOS"
      subtitle="Welcome back. Pick up where you left off."
      footerText="Don't have an account?"
      footerHref="/sign-up"
      footerLabel="Sign up"
    >
      <Suspense
        fallback={<div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>}
      >
        <AuthForm mode="sign-in" />
      </Suspense>
    </AuthCard>
  )
}
