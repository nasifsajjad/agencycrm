import Link from "next/link"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, Forbidden } from "@/components/app/states"
import { SettingsNav } from "@/components/app/settings-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ImportDialog, ExportButton } from "@/components/app/import-export"
import { Upload, Download, FileSpreadsheet } from "lucide-react"

export default async function ImportExportPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "settings.read")) return <Forbidden />

  const importTargets = [
    { label: "Contacts", target: "contacts", perm: "crm.create" as const },
    { label: "Companies", target: "companies", perm: "crm.create" as const },
    { label: "Leads", target: "leads", perm: "crm.create" as const },
    { label: "Deals", target: "deals", perm: "crm.create" as const },
    { label: "Clients", target: "clients", perm: "clients.create" as const },
    { label: "Time entries", target: "time_entries", perm: "time.manage_own" as const },
  ]

  const exportTargets = [
    { label: "Contacts", endpoint: "contacts", perm: "crm.export" as const },
    { label: "Deals", endpoint: "deals", perm: "crm.export" as const },
    { label: "Clients", endpoint: "clients", perm: "exports.create" as const },
    { label: "Time entries", endpoint: "time-entries", perm: "exports.create" as const },
    { label: "Invoices", endpoint: "invoices", perm: "finance.export" as const },
    { label: "Audit log", endpoint: "audit", perm: "audit.read" as const },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Import / Export"
        description="Bring data in or take it out, with permission-aware safeguards."
      />
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <SettingsNav workspaceSlug={workspaceSlug} />
        </aside>
        <div className="space-y-3 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4" /> Import
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a CSV, preview the mapping, validate, then execute idempotently. Errors are
                reported per-row.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {importTargets.map((t) => {
                  const allowed = can(ctx, t.perm) || ctx.isOwner
                  return (
                    <div
                      key={t.target}
                      className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm"
                    >
                      <span>{t.label}</span>
                      {allowed ? (
                        <ImportDialog
                          workspaceSlug={workspaceSlug}
                          target={t.target}
                          label={t.label}
                        />
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Restricted
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Every import is recorded in the audit log with totals.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Download className="h-4 w-4" /> Export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Permission-aware CSV export. Files expire after 7 days.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {exportTargets.map((t) => {
                  const allowed = can(ctx, t.perm) || ctx.isOwner
                  return (
                    <div
                      key={t.endpoint}
                      className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm"
                    >
                      <span>{t.label}</span>
                      {allowed ? (
                        <ExportButton
                          workspaceSlug={workspaceSlug}
                          endpoint={t.endpoint}
                          label={t.label}
                        />
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Restricted
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4" /> CSV format reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div>
                  <code className="text-foreground">contacts.csv</code>: firstName, lastName, email,
                  phone, jobTitle, company, lifecycleStage
                </div>
                <div>
                  <code className="text-foreground">companies.csv</code>: name, domain, industry,
                  website, sizeBand
                </div>
                <div>
                  <code className="text-foreground">leads.csv</code>: firstName, lastName, email,
                  company, source, score, status
                </div>
                <div>
                  <code className="text-foreground">deals.csv</code>: name, amount, stage, company,
                  contact, expectedCloseDate
                </div>
                <div>
                  <code className="text-foreground">clients.csv</code>: name, code, status, company
                </div>
                <div>
                  <code className="text-foreground">time_entries.csv</code>: description, minutes,
                  project, billable, rate
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
