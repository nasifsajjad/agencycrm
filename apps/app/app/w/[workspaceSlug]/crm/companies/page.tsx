import Link from "next/link"
import { Plus, Search, Globe } from "lucide-react"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CompanyFormDialog } from "@/components/app/company-form"
import { humanStatus, classForStatus } from "@/lib/format"
import { buildPageInfo, parsePageParams } from "@agencyos/domain"
import { Pagination } from "@/components/app/pagination"

export default async function CompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ q?: string; new?: string; page?: string; pageSize?: string }>
}) {
  const { workspaceSlug } = await params
  const resolvedSearchParams = await searchParams
  const { q, new: isNew } = resolvedSearchParams
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "crm.read")) return <Forbidden />

  const pageParams = parsePageParams(resolvedSearchParams)

  const where = {
    workspaceId: ctx.workspaceId,
    archivedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { domain: { contains: q } },
            { industry: { contains: q } },
          ],
        }
      : {}),
  }
  const [companies, companyCount] = await Promise.all([
    db.company.findMany({
      where,
      include: { _count: { select: { contacts: true, deals: true } } },
      orderBy: { updatedAt: "desc" },
      skip: pageParams.skip,
      take: pageParams.take,
    }),
    db.company.count({ where }),
  ])

  const pageInfo = buildPageInfo(pageParams, companyCount)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Companies"
        description={`${pageInfo.total} ${pageInfo.total === 1 ? "company" : "companies"}`}
        action={
          can(ctx, "crm.create") && (
            <CompanyFormDialog
              workspaceSlug={workspaceSlug}
              defaultOpen={isNew === "1"}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New company
                </Button>
              }
            />
          )
        }
      />
      <div className="mb-4">
        <form className="max-w-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search companies…" className="pl-8" />
          </div>
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
      </div>
      {companies.length === 0 ? (
        <EmptyState
          title={q ? "No companies match your search" : "No companies yet"}
          description={
            q ? "Try a different query." : "Add your first company to organize contacts and deals."
          }
          action={
            !q && can(ctx, "crm.create")
              ? { label: "New company", href: `/w/${workspaceSlug}/crm/companies?new=1` }
              : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/w/${workspaceSlug}/crm/companies/${c.id}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="font-medium hover:underline">{c.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {c.industry ?? "—"}
                    </div>
                  </Link>
                  <Badge variant="outline" className={classForStatus(c.lifecycleStage)}>
                    {humanStatus(c.lifecycleStage)}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  {c.website && (
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      <Globe className="h-3 w-3" /> Website
                    </a>
                  )}
                  <span>{c._count.contacts} contacts</span>
                  <span>{c._count.deals} deals</span>
                </div>
              </Card>
            ))}
          </div>
          <Pagination
            info={pageInfo}
            basePath={`/w/${workspaceSlug}/crm/companies`}
            searchParams={resolvedSearchParams}
            label="companies"
            className="px-4"
          />
        </>
      )}
    </div>
  )
}
