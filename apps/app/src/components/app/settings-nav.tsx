import Link from "next/link"
import { db } from "@/lib/db"
import { resolveWorkspace } from "@/lib/server"
import { can } from "@/lib/auth"
import { PageHeader, Forbidden } from "@/components/app/states"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Tags,
  FileText,
  Palette,
  Plug,
  ArrowDownUp,
  Shield,
  Trash2,
  Settings as SettingsIcon,
} from "lucide-react"

const NAV = [
  {
    href: "/settings/general",
    label: "General",
    icon: SettingsIcon,
    perm: "settings.read" as const,
  },
  { href: "/settings/members", label: "Members", icon: Users, perm: "members.read" as const },
  { href: "/settings/teams", label: "Teams", icon: Tags, perm: "teams.read" as const },
  {
    href: "/settings/roles",
    label: "Roles & permissions",
    icon: Shield,
    perm: "roles.read" as const,
  },
  {
    href: "/settings/customization",
    label: "Customization",
    icon: Palette,
    perm: "settings.read" as const,
  },
  { href: "/settings/audit", label: "Audit log", icon: FileText, perm: "audit.read" as const },
  {
    href: "/settings/integrations",
    label: "Integrations",
    icon: Plug,
    perm: "integrations.read" as const,
  },
  {
    href: "/settings/import-export",
    label: "Import / Export",
    icon: ArrowDownUp,
    perm: "settings.read" as const,
  },
  { href: "/settings/trash", label: "Trash", icon: Trash2, perm: "crm.delete" as const },
]

export async function SettingsNav({ workspaceSlug }: { workspaceSlug: string }) {
  const ctx = await resolveWorkspace(workspaceSlug)
  const items = NAV.filter((n) => can(ctx, n.perm) || ctx.isOwner)
  return (
    <nav className="grid gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={`/w/${workspaceSlug}${item.href}`}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <item.icon className="h-4 w-4" /> {item.label}
        </Link>
      ))}
    </nav>
  )
}

export { PageHeader, Forbidden, Card, Badge }
