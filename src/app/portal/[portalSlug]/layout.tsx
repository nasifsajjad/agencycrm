import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { PortalShell } from "@/components/portal/shell"

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ portalSlug: string }>
}) {
  const { portalSlug } = await params
  const portal = await db.clientPortal.findUnique({
    where: { slug: portalSlug },
    include: { client: true, contact: true, workspace: true },
  })
  if (!portal) redirect("/")

  return (
    <PortalShell
      portal={{
        slug: portal.slug,
        brandColor: portal.brandColor ?? "#4f46e5",
        clientName: portal.client.name,
        workspaceName: portal.workspace.name,
      }}
    >
      {children}
    </PortalShell>
  )
}
