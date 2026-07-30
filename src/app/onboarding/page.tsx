import { redirect } from "next/navigation";
import { getCurrentUser, getUserMemberships } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/onboarding");
  const memberships = await getUserMemberships(user.id);
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute inset-0 grid-pattern opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/60 to-background" />
      <div className="relative w-full max-w-xl rounded-xl border border-border/60 bg-card p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to AgencyOS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let&apos;s set up your first workspace. You can change everything later.
          </p>
        </div>
        <OnboardingForm
          defaultName={user.displayName ?? ""}
          hasWorkspaces={memberships.length > 0}
        />
      </div>
    </div>
  );
}
