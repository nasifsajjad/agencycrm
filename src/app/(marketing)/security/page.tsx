import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ShieldCheck,
  Lock,
  FileCheck2,
  Globe,
  Eye,
  KeyRound,
  Database,
  ScrollText,
} from "lucide-react"
import { MarketingBadge } from "@/components/marketing/shell"

export const metadata = { title: "Security" }

const PILLARS = [
  {
    icon: Database,
    title: "Database-enforced tenant isolation",
    desc: "Every tenant-owned record carries a workspace identifier. Cross-workspace relationships are rejected by the database, not just by application convention. Composite foreign keys and same-workspace guards prevent data leakage even when IDs are guessed.",
  },
  {
    icon: Lock,
    title: "Least privilege & explicit visibility",
    desc: "60+ granular permission keys, system + custom roles, and explicit internal / client / restricted visibility on every comment, file, and approval. Permissions are re-checked server-side on every mutation — UI gating is presentation only.",
  },
  {
    icon: ScrollText,
    title: "Append-only audit log",
    desc: "Every permission change, approval, export, and financial mutation is captured in an append-only audit log with before/after state, actor, and timestamp. The log is read-only to ordinary users.",
  },
  {
    icon: Eye,
    title: "Safe client collaboration",
    desc: "Portal users see only explicitly shared records — never inherited from workspace membership. Direct URL guessing, search, and other clients are blocked at the data layer.",
  },
  {
    icon: KeyRound,
    title: "Secrets management",
    desc: "Service-role and provider credentials live only in server-only modules with import guards. They never reach the browser bundle, logs, or test snapshots. Webhook secrets are encrypted at rest.",
  },
  {
    icon: FileCheck2,
    title: "Verifiable security tests",
    desc: "Two-workspace, client, contractor, suspended-member, and unauthenticated negative tests are required to pass. Cross-tenant leakage, replay attacks, and privilege escalation are covered.",
  },
  {
    icon: Globe,
    title: "SSO & session controls",
    desc: "SAML / SCIM adapter boundaries for Scale plans. Cookie-based session with refresh, expiry, and rotation. Authentication callbacks are allow-listed; protocol-relative and external redirects are rejected.",
  },
  {
    icon: ShieldCheck,
    title: "Recovery & retention",
    desc: "Runbooks for migrations, stuck jobs, webhook replay, invite problems, storage incidents, tenant leakage response, and restore validation. Configurable retention and legal hold seams for enterprise.",
  },
]

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <MarketingBadge>Security & trust</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Built like infrastructure
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          AgencyOS treats security as a first-class concern — not a checklist. Tenant isolation is
          enforced at the database layer, permissions are checked server-side on every mutation, and
          audit events are append-only.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Start free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact">Talk to security</Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
        {PILLARS.map((p) => (
          <Card key={p.title}>
            <CardHeader>
              <p.icon className="h-5 w-5 text-foreground/70" />
              <CardTitle className="mt-2 text-base">{p.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-16 rounded-lg border border-border/60 bg-muted/20 p-8">
        <h2 className="text-xl font-semibold tracking-tight">
          Negative security tests, required to pass
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The following negative tests must pass before any release is accepted:
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {[
            "No table leaks rows across workspaces",
            "Guessed UUIDs and modified slugs fail",
            "Inserts cannot claim another workspace",
            "Updates cannot move rows between workspaces",
            "Cross-workspace foreign keys fail",
            "Unauthorized role/member changes fail",
            "Users cannot grant permissions they don't manage",
            "Client users cannot read internal comments/files/finance",
            "Contractor access is restricted as configured",
            "Invitation tokens cannot be replayed or accepted by another email",
            "Signed URLs cannot be issued without entity access",
            "Search, exports, notifications, and reports do not leak",
            "Service-role modules cannot enter the client bundle",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
