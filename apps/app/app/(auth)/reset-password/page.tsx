import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { AuthCard } from "@/components/auth/auth-form"

export const metadata = { title: "Set a new password" }

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a new password for your AgencyOS account."
      footerText="Need another link?"
      footerHref="/forgot-password"
      footerLabel="Reset again"
    >
      <ResetPasswordForm />
    </AuthCard>
  )
}
