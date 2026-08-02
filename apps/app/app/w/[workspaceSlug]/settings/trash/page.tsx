import { buildPageInfo, parsePageParams } from "@agencyos/domain"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { SettingsNav } from "@/components/app/settings-nav"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Pagination } from "@/components/app/pagination"
import { RestoreButton } from "@/components/app/restore-button"
import { formatDateTime } from "@/lib/format"

/**
 * Trash — archived records and how to get them back.
 *
 * Deletes are soft (migration 0026), so this is where a mis-click is undone.
 * Records are purged permanently by public.purge_archived_records, which is a
 * maintenance routine restricted to service_role rather than anything a user
 * can trigger from here.
 */
export default async function TrashPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const { workspaceSlug } = await params
  const resolvedSearchParams = await searchParams
  const ctx = await resolveWorkspace(workspaceSlug)

  // Reading the trash means reading records the workspace has archived, so it
  // is gated on the same permission that archived them.
  if (!can(ctx, "crm.delete")) return <Forbidden />

  const pageParams = parsePageParams(resolvedSearchParams)

  const contactsWhere = { workspaceId: ctx.workspaceId, archivedAt: { not: null } }
  const companiesWhere = { workspaceId: ctx.workspaceId, archivedAt: { not: null } }

  const [contacts, contactCount, companies, companyCount] = await Promise.all([
    db.contact.findMany({
      where: contactsWhere,
      include: { company: true },
      orderBy: { archivedAt: "desc" },
      skip: pageParams.skip,
      take: pageParams.take,
    }),
    db.contact.count({ where: contactsWhere }),
    db.company.findMany({
      where: companiesWhere,
      orderBy: { archivedAt: "desc" },
      take: pageParams.take,
    }),
    db.company.count({ where: companiesWhere }),
  ])

  const pageInfo = buildPageInfo(pageParams, contactCount)
  const isEmpty = contactCount === 0 && companyCount === 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Trash"
        description="Archived records are recoverable here. They are permanently removed 90 days after archiving."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <SettingsNav workspaceSlug={workspaceSlug} />

        <div className="space-y-6">
          {isEmpty ? (
            <EmptyState
              title="Nothing in the trash"
              description="Archived contacts and companies appear here so you can restore them."
            />
          ) : (
            <>
              {contactCount > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                    <h2 className="text-sm font-medium">Contacts</h2>
                    <Badge variant="secondary">{contactCount}</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Company</th>
                          <th className="px-4 py-2 text-left font-medium">Archived</th>
                          <th className="px-4 py-2 text-right font-medium">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((contact) => (
                          <tr key={contact.id} className="border-t border-border/60">
                            <td className="px-4 py-2.5 font-medium">
                              {contact.firstName} {contact.lastName}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {contact.company?.name ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {contact.archivedAt ? formatDateTime(contact.archivedAt) : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <RestoreButton
                                workspaceSlug={workspaceSlug}
                                entity="contact"
                                id={contact.id}
                                label={`${contact.firstName} ${contact.lastName}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    info={pageInfo}
                    basePath={`/w/${workspaceSlug}/settings/trash`}
                    searchParams={resolvedSearchParams}
                    label="archived contacts"
                    className="px-4"
                  />
                </Card>
              )}

              {companyCount > 0 && (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                    <h2 className="text-sm font-medium">Companies</h2>
                    <Badge variant="secondary">{companyCount}</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Name</th>
                          <th className="px-4 py-2 text-left font-medium">Archived</th>
                          <th className="px-4 py-2 text-right font-medium">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((company) => (
                          <tr key={company.id} className="border-t border-border/60">
                            <td className="px-4 py-2.5 font-medium">{company.name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {company.archivedAt ? formatDateTime(company.archivedAt) : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <RestoreButton
                                workspaceSlug={workspaceSlug}
                                entity="company"
                                id={company.id}
                                label={company.name}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
