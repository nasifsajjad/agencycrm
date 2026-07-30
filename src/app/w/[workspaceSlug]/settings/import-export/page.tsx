import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, Forbidden } from "@/components/app/states";
import { SettingsNav } from "@/components/app/settings-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet } from "lucide-react";

export default async function ImportExportPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "settings.read")) return <Forbidden />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Import / Export" description="Bring data in or take it out, with permission-aware safeguards." />
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <SettingsNav workspaceSlug={workspaceSlug} />
        </aside>
        <div className="space-y-3 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><Upload className="h-4 w-4" /> Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a CSV, preview the mapping, validate, and execute idempotently. Errors are reported per-row with a downloadable error file.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {["Contacts", "Companies", "Leads", "Deals", "Clients", "Time entries"].map((t) => (
                  <div key={t} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm">
                    <span>{t}</span>
                    <Badge variant="outline" className="text-xs">CSV</Badge>
                  </div>
                ))}
              </div>
              <Button disabled className="w-full sm:w-auto">
                <Upload className="mr-1 h-3.5 w-3.5" /> Upload file
              </Button>
              <p className="text-xs text-muted-foreground">
                Import is permission-gated. Every import is recorded in the audit log with totals and error count.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><Download className="h-4 w-4" /> Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Permission-aware CSV export respects current filters, selected columns, and field-level sensitivity.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { label: "Contacts", perm: "crm.export" },
                  { label: "Deals", perm: "crm.export" },
                  { label: "Clients", perm: "exports.create" },
                  { label: "Time entries", perm: "exports.create" },
                  { label: "Invoices", perm: "finance.export" },
                  { label: "Audit log", perm: "audit.read" },
                ].map((t) => {
                  const allowed = can(ctx, t.perm as any) || ctx.isOwner;
                  return (
                    <div key={t.label} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm">
                      <span>{t.label}</span>
                      <Badge variant="outline" className="text-xs">{allowed ? "Allowed" : "Restricted"}</Badge>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Every export is recorded in the audit log and the resulting file expires after 7 days.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-4 w-4" /> Recent jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No import or export jobs yet.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
