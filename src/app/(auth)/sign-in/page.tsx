import { AuthCard, AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in to AgencyOS"
      subtitle="Welcome back. Pick up where you left off."
      footerText="Don't have an account?"
      footerHref="/sign-up"
      footerLabel="Sign up"
    >
      <AuthForm mode="sign-in" />
    </AuthCard>
  );
}
