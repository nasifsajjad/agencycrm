import Link from "next/link"
import {
  Sparkles,
  Bell,
  FileText,
  FolderKanban,
  FileCheck2,
  Megaphone,
  BarChart3,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function PortalShell({
  portal,
  children,
}: {
  portal: { slug: string; brandColor: string; clientName: string; workspaceName: string }
  children: React.ReactNode
}) {
  const nav = [
    { href: `/portal/${portal.slug}`, label: "Home", icon: Sparkles },
    { href: `/portal/${portal.slug}/projects`, label: "Projects", icon: FolderKanban },
    { href: `/portal/${portal.slug}/requests`, label: "Requests", icon: FileText },
    { href: `/portal/${portal.slug}/approvals`, label: "Approvals", icon: FileCheck2 },
    { href: `/portal/${portal.slug}/files`, label: "Files", icon: Megaphone },
    { href: `/portal/${portal.slug}/reports`, label: "Reports", icon: BarChart3 },
  ]
  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="border-b border-border/60 bg-background"
        style={{ borderTop: `3px solid ${portal.brandColor}` }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="grid h-8 w-8 place-items-center rounded-md text-white"
              style={{ backgroundColor: portal.brandColor }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium">{portal.workspaceName}</div>
              <div className="text-[10px] text-muted-foreground">
                Client portal · {portal.clientName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <aside className="hidden w-56 shrink-0 border-r border-border/60 pr-4 md:block">
          <nav className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 md:pl-6">{children}</main>
      </div>
    </div>
  )
}
