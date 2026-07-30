import { AuthCard } from "@/components/auth/auth-form";
import { ForgotPasswordForm } from "@/components/auth/auth-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footerText="Remembered it?"
      footerHref="/sign-in"
      footerLabel="Back to sign in"
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
