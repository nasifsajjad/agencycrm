import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, Forbidden } from "@/components/app/states";
import { SettingsNav } from "@/components/app/settings-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const INTEGRATIONS = [
  { name: "Stripe", description: "Accept payments and sync invoices.", category: "Payments", status: "available" },
  { name: "QuickBooks", description: "Sync invoices, expenses, and chart of accounts.", category: "Accounting", status: "available" },
  { name: "Google Calendar", description: "Two-way calendar sync for activities and meetings.", category: "Calendar", status: "available" },
  { name: "Slack", description: "Notifications and approvals routed to Slack channels.", category: "Communication", status: "available" },
  { name: "Meta Ads", description: "Pull paid social performance into client reports.", category: "Advertising", status: "available" },
  { name: "Google Ads", description: "Sync campaign performance and budgets.", category: "Advertising", status: "available" },
  { name: "Mailchimp", description: "Sync contacts and email campaign metrics.", category: "Email", status: "available" },
  { name: "HubSpot", description: "Two-way contact and deal sync.", category: "CRM", status: "available" },
];

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "integrations.read")) return <Forbidden />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Integrations" description="Connect external providers (adapters; local mode requires no real credentials)" />
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <SettingsNav workspaceSlug={workspaceSlug} />
        </aside>
        <div className="space-y-3 lg:col-span-3">
          <Card>
            <CardContent className="py-3 text-sm text-muted-foreground">
              All integrations use a provider-neutral adapter pattern. Credentials are never returned to the browser. Local mode substitutes deterministic mocks — no real provider account is required to use core CRM features.
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INTEGRATIONS.map((i) => (
              <Card key={i.name} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{i.category}</div>
                  </div>
                  <Badge variant="outline" className="capitalize">{i.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{i.description}</p>
                <button
                  disabled
                  className="mt-3 text-xs text-muted-foreground cursor-not-allowed"
                  title="Connect requires server-side credentials not available in local mode"
                >
                  Connect →
                </button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
