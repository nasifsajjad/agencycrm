import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getDashboardMetrics } from "@/lib/queries"
import { DashboardWidgetRenderer } from "@/components/app/dashboard-widgets"
import { DashboardWidgetEditor } from "@/components/app/dashboard-widget-editor"
import { db } from "@/lib/db"
import { can } from "@/lib/auth"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const { getWorkspaceContext, requireUser } = await import("@/lib/auth")
  const user = await requireUser()
  const ctx = await getWorkspaceContext(workspaceSlug, user)
  if (!ctx) return null

  // Find or create the user's primary dashboard
  let dashboard = await db.dashboard.findFirst({
    where: { workspaceId: ctx.workspaceId, visibility: "workspace" },
    include: { widgets: true },
  })
  if (!dashboard) {
    dashboard = await db.dashboard.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: "Overview",
        visibility: "workspace",
      },
      include: { widgets: true },
    })
  }

  const m = await getDashboardMetrics(ctx)
  const canEditDashboard = can(ctx, "settings.manage") || can(ctx, "reports.create")

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back. Here&apos;s what&apos;s happening at {ctx.workspaceName}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/w/${ctx.workspaceSlug}/reports`}>
              Reports <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {dashboard.widgets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No widgets yet. Add some to customize your dashboard.
            </p>
            {canEditDashboard && (
              <div className="mt-4 max-w-md mx-auto">
                <DashboardWidgetEditor
                  workspaceSlug={workspaceSlug}
                  dashboardId={dashboard.id}
                  existing={[]}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dashboard.widgets.map((w) => (
            <DashboardWidgetRenderer
              key={w.id}
              ctx={ctx}
              widget={{
                id: w.id,
                widgetType: w.widgetType,
                queryJson: w.queryJson as any,
                displayJson: w.displayJson as any,
                positionJson: w.positionJson as any,
              }}
            />
          ))}
        </div>
      )}

      {canEditDashboard && dashboard.widgets.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Manage widgets</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardWidgetEditor
              workspaceSlug={workspaceSlug}
              dashboardId={dashboard.id}
              existing={dashboard.widgets.map((w) => ({ id: w.id, widgetType: w.widgetType }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
