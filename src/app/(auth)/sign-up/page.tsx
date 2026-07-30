import { AuthCard, AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Start free" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Start your agency workspace"
      subtitle="Free for the first 5 seats. No credit card required."
      footerText="Already have an account?"
      footerHref="/sign-in"
      footerLabel="Sign in"
    >
      <AuthForm mode="sign-up" />
    </AuthCard>
  );
}
