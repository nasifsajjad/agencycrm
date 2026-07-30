import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, Forbidden } from "@/components/app/states";
import { SettingsNav } from "@/components/app/settings-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "settings.read")) return <Forbidden />;

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
  const flags = await db.featureFlag.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { key: "asc" } });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Settings" description="Workspace configuration" />
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <SettingsNav workspaceSlug={workspaceSlug} />
        </aside>
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Name" value={workspace.name} />
              <Row label="Slug" value={workspace.slug} />
              <Row label="Currency" value={workspace.currency} />
              <Row label="Timezone" value={workspace.timezone} />
              <Row label="Locale" value={workspace.locale} />
              <Row label="Created" value={formatDate(workspace.createdAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Feature flags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {flags.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm">
                    <span className="font-mono text-xs">{f.key}</span>
                    <Badge variant="outline" className={f.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}>
                      {f.enabled ? "on" : "off"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
