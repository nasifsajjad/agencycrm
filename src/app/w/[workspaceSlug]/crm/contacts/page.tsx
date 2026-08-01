import Link from "next/link"
import { Plus, Search, Trash2 } from "lucide-react"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, EmptyState, Forbidden } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ContactFormDialog } from "@/components/app/contact-form"
import { DeleteActionButton } from "@/components/app/delete-button"
import { initials, classForStatus, humanStatus } from "@/lib/format"

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>
  searchParams: Promise<{ q?: string; new?: string }>
}) {
  const { workspaceSlug } = await params
  const { q, new: isNew } = await searchParams
  const ctx = await resolveWorkspace(workspaceSlug)
  if (!can(ctx, "crm.read")) return <Forbidden />

  const where = {
    workspaceId: ctx.workspaceId,
    archivedAt: null,
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  }
  const [contacts, companies, members] = await Promise.all([
    db.contact.findMany({
      where,
      include: { company: true, owner: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.company.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId: ctx.workspaceId, status: "active" },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    }),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Contacts"
        description={`${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"}${q ? ` matching "${q}"` : ""}`}
        action={
          can(ctx, "crm.create") && (
            <ContactFormDialog
              workspaceSlug={workspaceSlug}
              companies={companies}
              members={members.map((m) => ({
                id: m.user.id,
                name: m.user.displayName ?? m.user.email,
              }))}
              defaultOpen={isNew === "1"}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" /> New contact
                </Button>
              }
            />
          )
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <form className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="Search contacts…" className="pl-8" />
          </div>
          <button type="submit" className="sr-only">
            Search
          </button>
        </form>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          title={q ? "No contacts match your search" : "No contacts yet"}
          description={
            q ? "Try a different query." : "Add your first contact to start building your CRM."
          }
          action={
            !q && can(ctx, "crm.create")
              ? { label: "New contact", href: `/w/${workspaceSlug}/crm/contacts?new=1` }
              : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Email</th>
                  <th className="px-4 py-2 text-left font-medium">Company</th>
                  <th className="px-4 py-2 text-left font-medium">Stage</th>
                  <th className="px-4 py-2 text-left font-medium">Owner</th>
                  {can(ctx, "crm.delete") && <th className="px-4 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/w/${workspaceSlug}/crm/contacts/${c.id}`}
                        className="flex items-center gap-2"
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">
                            {initials(`${c.firstName} ${c.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium hover:underline">
                          {c.firstName} {c.lastName}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.company?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={classForStatus(c.lifecycleStage)}>
                        {humanStatus(c.lifecycleStage)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {c.owner?.displayName ?? "—"}
                    </td>
                    {can(ctx, "crm.delete") && (
                      <td className="px-4 py-2.5 text-right">
                        <DeleteActionButton
                          actionName="deleteContactAction"
                          args={[workspaceSlug, c.id]}
                          label={`Delete ${c.firstName} ${c.lastName}`}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
