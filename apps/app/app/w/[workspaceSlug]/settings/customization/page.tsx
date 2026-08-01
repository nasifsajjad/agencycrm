import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, Forbidden } from "@/components/app/states"
import { SettingsNav } from "@/components/app/settings-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomFieldEditor } from "@/components/app/custom-field-editor"
import { SavedViewManager } from "@/components/app/saved-view-manager"
import { Badge } from "@/components/ui/badge"

export default async function CustomizationPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "settings.read")) return <Forbidden />

  const [customFields, savedViews, pipelines, projectStatuses, taskStatuses] = await Promise.all([
    db.customFieldDefinition.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ entityType: "asc" }, { position: "asc" }],
    }),
    db.savedView.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    db.pipeline.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { _count: { select: { stages: true } } },
    }),
    db.projectStatus.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { position: "asc" },
    }),
    db.taskStatus.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { position: "asc" },
    }),
  ])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Customization"
        description="Custom fields, saved views, statuses, and pipelines"
      />
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <SettingsNav workspaceSlug={workspaceSlug} />
        </aside>
        <div className="space-y-3 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Custom fields ({customFields.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomFieldEditor
                workspaceSlug={workspaceSlug}
                existing={customFields.map((f) => ({
                  id: f.id,
                  key: f.key,
                  label: f.label,
                  dataType: f.dataType,
                  entityType: f.entityType,
                  required: f.required,
                  optionsJson: f.optionsJson,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Saved views ({savedViews.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <SavedViewManager
                workspaceSlug={workspaceSlug}
                existing={savedViews.map((v) => ({
                  id: v.id,
                  name: v.name,
                  entityType: v.entityType,
                  visibility: v.visibility,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pipelines ({pipelines.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pipelines.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {p._count.stages} stages
                      </Badge>
                      {p.isDefault && (
                        <Badge variant="outline" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Project statuses ({projectStatuses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {projectStatuses.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color ?? "var(--muted-foreground)" }}
                        />
                        <span>{s.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {s.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Task statuses ({taskStatuses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {taskStatuses.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color ?? "var(--muted-foreground)" }}
                        />
                        <span>{s.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {s.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
