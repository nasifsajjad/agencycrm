import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { MarketingBadge } from "@/components/marketing/shell"
import { appHref } from "@/lib/app-links"

export const metadata = { title: "Product" }

export default function ProductPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <MarketingBadge>Product</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          One workspace, the whole agency
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          AgencyOS replaces the patchwork of CRM, project, time, and finance tools with a single,
          configurable workspace — purpose-built for agencies.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href={appHref("/sign-up")}>
              Start free <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/book-demo">Book a demo</Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Card key={m.title}>
            <CardHeader>
              <CardTitle className="text-base">{m.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{m.desc}</p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {m.points.map((p) => (
                  <li key={p} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" /> {p}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

const MODULES = [
  {
    title: "CRM & pipelines",
    desc: "Contacts, companies, leads, deals, activities, notes, and tags — with configurable pipelines and saved views.",
    points: ["Drag-and-drop board", "Weighted forecast", "CSV import/export", "Duplicate merge"],
  },
  {
    title: "Client 360",
    desc: "Every client in one place: stakeholders, projects, requests, retainers, invoices, health, and activity timeline.",
    points: ["Health score", "Renewal tracking", "Onboarding checklist", "Activity feed"],
  },
  {
    title: "Project delivery",
    desc: "Projects from templates, tasks with dependencies, milestones, campaigns, deliverables, and content calendars.",
    points: ["Board / list / calendar", "Time tracking", "Subtasks & watchers", "Milestones"],
  },
  {
    title: "Approvals & proofing",
    desc: "Sequential approval steps, immutable decision events, version control, and client-visible comments.",
    points: ["Multi-step approvals", "Version history", "Audit trail", "Client portal"],
  },
  {
    title: "Time & capacity",
    desc: "Timer and manual entries, weekly timesheets, capacity allocation, and budget burn against projects.",
    points: ["One-click timer", "Timesheet approval", "Utilization", "Budget tracking"],
  },
  {
    title: "Finance & retainers",
    desc: "Retainers, rate cards, expenses, estimates, invoices, and profitability by client, project, or team.",
    points: ["Retainer management", "Invoice builder", "Expense tracking", "Margin reporting"],
  },
  {
    title: "Client portal",
    desc: "Branded portal with explicit sharing for requests, files, approvals, and reports — never inherited.",
    points: ["Custom branding", "Explicit sharing", "Approval workflow", "Report publishing"],
  },
  {
    title: "Customization",
    desc: "Custom fields, statuses, terminology, saved views, dashboards, and role-aware navigation.",
    points: ["Custom fields", "Configurable statuses", "Saved views", "Role-aware nav"],
  },
  {
    title: "Automations",
    desc: "Trigger-based workflows with conditions, actions, run logs, retries, and idempotency.",
    points: ["Trigger library", "Condition trees", "Run history", "Webhook delivery"],
  },
]
