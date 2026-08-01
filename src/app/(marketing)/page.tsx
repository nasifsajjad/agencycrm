import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Users,
  Briefcase,
  KanbanSquare,
  FileCheck2,
  Clock,
  DollarSign,
  BarChart3,
  Search,
  Settings2,
  Bell,
  ShieldCheck,
  Layers,
  Globe,
  Workflow,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MarketingBadge } from "@/components/marketing/shell"

export default function HomePage() {
  return (
    <>
      <Hero />
      <WorkflowStory />
      <CapabilityGrid />
      <RoleBenefits />
      <SecuritySection />
      <Testimonials />
      <PricingCTA />
      <FAQ />
    </>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 grid-pattern opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/40 to-background" />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <MarketingBadge>
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />
            Now with role-aware dashboards & client portal
          </MarketingBadge>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            The operating system for{" "}
            <span className="text-foreground/70">modern marketing agencies</span>
          </h1>
          <p className="mt-6 text-pretty text-lg text-muted-foreground sm:text-xl">
            AgencyOS unifies the full lead-to-renewal lifecycle — CRM, delivery, approvals, time,
            finance, and a branded client portal — in one configurable workspace.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Start free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/book-demo">
                Book a demo
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required · Free for the first 5 seats · SOC 2-aligned controls
          </p>
        </div>

        <HeroPreview />
      </div>
    </section>
  )
}

function HeroPreview() {
  return (
    <div className="relative mt-16 mx-auto max-w-6xl">
      <div className="absolute -inset-x-12 -top-6 bottom-0 rounded-3xl bg-gradient-to-b from-foreground/5 to-transparent blur-2xl" />
      <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl shadow-foreground/5">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400/70" />
            <span className="h-3 w-3 rounded-full bg-amber-400/70" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md border border-border/60 bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <span className="hidden sm:inline">app.agencyos.dev</span>
            <span className="sm:hidden">app.agencyos.dev</span>
            <span className="text-foreground/40">/w/northstar</span>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-0">
          <div className="col-span-3 hidden border-r border-border/60 bg-muted/20 p-4 md:block">
            <div className="space-y-1">
              {[
                { label: "Dashboard", icon: BarChart3, active: true },
                { label: "Leads", icon: Users },
                { label: "Deals", icon: KanbanSquare },
                { label: "Clients", icon: Briefcase },
                { label: "Projects", icon: Layers },
                { label: "Tasks", icon: CheckCircle2 },
                { label: "Approvals", icon: FileCheck2 },
                { label: "Time", icon: Clock },
                { label: "Finance", icon: DollarSign },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
                    item.active
                      ? "bg-foreground/5 font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Dashboard
                  </div>
                  <div className="text-lg font-semibold">Northstar Growth Studio</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Search className="h-3 w-3" /> Search
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Bell className="h-3 w-3" /> 3
                  </Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
              {[
                { label: "Pipeline value", value: "$482K", trend: "+12.4%", icon: DollarSign },
                { label: "Active clients", value: "12", trend: "+2", icon: Briefcase },
                { label: "Utilization", value: "78%", trend: "+4pts", icon: Clock },
              ].map((m) => (
                <Card key={m.label} className="bg-card/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {m.label}
                      </CardTitle>
                      <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums">{m.value}</div>
                    <div className="mt-1 text-xs text-success">{m.trend} vs last month</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pipeline by stage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {[
                    { stage: "Lead", pct: 22, color: "bg-slate-400" },
                    { stage: "Qualified", pct: 38, color: "bg-blue-500" },
                    { stage: "Proposal", pct: 18, color: "bg-violet-500" },
                    { stage: "Negotiation", pct: 14, color: "bg-amber-500" },
                    { stage: "Won", pct: 8, color: "bg-emerald-500" },
                  ].map((b) => (
                    <div key={b.stage} className="flex items-center gap-3 text-xs">
                      <div className="w-20 text-muted-foreground">{b.stage}</div>
                      <div className="flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={`h-2 ${b.color}`} style={{ width: `${b.pct * 2.5}%` }} />
                      </div>
                      <div className="w-8 text-right tabular-nums">{b.pct}%</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Upcoming approvals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  {[
                    {
                      name: "Q3 brand campaign — final assets",
                      client: "Aurora Skincare",
                      age: "2d",
                    },
                    { name: "Landing page redesign v2", client: "Helix Health", age: "5h" },
                    { name: "Email sequence — Series B", client: "Northpoint SaaS", age: "1d" },
                  ].map((a) => (
                    <div
                      key={a.name}
                      className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{a.name}</div>
                        <div className="text-muted-foreground">{a.client}</div>
                      </div>
                      <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                        {a.age}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkflowStory() {
  const steps = [
    { label: "Lead", desc: "Capture, qualify, and route inbound leads.", icon: Users },
    { label: "Deal", desc: "Configurable pipeline with weighted forecast.", icon: KanbanSquare },
    { label: "Client", desc: "Convert won deals into active clients.", icon: Briefcase },
    { label: "Deliver", desc: "Projects, tasks, campaigns, deliverables.", icon: Layers },
    { label: "Approve", desc: "Versioned approvals with audit trail.", icon: FileCheck2 },
    { label: "Report", desc: "Role-aware dashboards and reports.", icon: BarChart3 },
    { label: "Invoice", desc: "Recognize revenue, bill retainers, invoice.", icon: DollarSign },
    { label: "Renew", desc: "Health, renewal dates, QBR prep.", icon: ShieldCheck },
  ]
  return (
    <section className="border-b border-border/60 bg-muted/20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <MarketingBadge>The lifecycle</MarketingBadge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            One workspace, the whole arc
          </h2>
          <p className="mt-4 text-muted-foreground">
            Stop stitching together separate tools for CRM, projects, time, and finance. AgencyOS
            connects every contact, decision, hour, and dollar in one coherent data graph.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Card key={s.label} className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-foreground/5 text-foreground">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-mono text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <CardTitle className="mt-3 text-base">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function CapabilityGrid() {
  const caps = [
    {
      title: "Configurable CRM",
      desc: "Contacts, companies, leads, deals, activities, notes, and tags. Drag-and-drop pipelines, saved views, and bulk actions.",
      icon: Users,
    },
    {
      title: "Project delivery",
      desc: "Projects from templates, tasks with dependencies, milestones, campaigns, deliverables, and content calendars.",
      icon: Layers,
    },
    {
      title: "Approvals & proofing",
      desc: "Sequential approval steps, immutable decision events, version control, and client-visible comments.",
      icon: FileCheck2,
    },
    {
      title: "Time & capacity",
      desc: "Timer and manual entries, weekly timesheets, capacity allocation, and budget burn against projects.",
      icon: Clock,
    },
    {
      title: "Finance & retainers",
      desc: "Retainers, rate cards, expenses, estimates, invoices, and profitability by client, project, or team.",
      icon: DollarSign,
    },
    {
      title: "Client portal",
      desc: "Branded portal with explicit sharing for requests, files, approvals, and reports — never inherited.",
      icon: Globe,
    },
    {
      title: "Customization",
      desc: "Custom fields, statuses, terminology, saved views, dashboards, and role-aware navigation.",
      icon: Settings2,
    },
    {
      title: "Automations",
      desc: "Trigger-based workflows with conditions, actions, run logs, retries, and idempotency.",
      icon: Workflow,
    },
    {
      title: "Global search",
      desc: "Permission-aware search across every entity with a keyboard-first command palette.",
      icon: Search,
    },
  ]
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <MarketingBadge>Capabilities</MarketingBadge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for the realities of agency work
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every module is deep enough to run a real agency on, yet configurable enough to feel
            custom-built for yours.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {caps.map((c) => (
            <Card key={c.title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="grid h-9 w-9 place-items-center rounded-md bg-foreground/5 text-foreground">
                  <c.icon className="h-4 w-4" />
                </div>
                <CardTitle className="mt-3 text-base">{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function RoleBenefits() {
  const roles = [
    {
      role: "Founders & owners",
      desc: "Pipeline, revenue, margin, utilization, health, and risk — at a glance.",
      points: ["Executive dashboard", "Renewal forecast", "Profitability by client"],
    },
    {
      role: "Sales & account executives",
      desc: "Move leads to deals with configurable pipelines and activity tracking.",
      points: ["Drag-and-drop pipeline", "Activity reminders", "Weighted forecast"],
    },
    {
      role: "Account managers",
      desc: "A complete Client 360 — stakeholders, requests, files, approvals, reports.",
      points: ["Client 360 timeline", "Health events", "Renewal reminders"],
    },
    {
      role: "Project & traffic managers",
      desc: "Plan, schedule, and balance work across people and projects.",
      points: ["Capacity view", "Task dependencies", "Saved views"],
    },
    {
      role: "Creatives & specialists",
      desc: "Assigned work, briefs, files, feedback, and time — without the noise.",
      points: ["My work queue", "Inline proofing", "One-click timer"],
    },
    {
      role: "Finance & ops",
      desc: "Retainers, rates, costs, invoices, and exports — all in one place.",
      points: ["Margin reporting", "Invoice builder", "Audit-ready exports"],
    },
  ]
  return (
    <section className="border-y border-border/60 bg-muted/20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <MarketingBadge>For every role</MarketingBadge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Role-aware by design
          </h2>
          <p className="mt-4 text-muted-foreground">
            Progressive disclosure means each person sees what they need — and nothing they
            shouldn&apos;t.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <Card key={r.role}>
              <CardHeader>
                <CardTitle className="text-base">{r.role}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function SecuritySection() {
  const items = [
    {
      title: "Database-enforced tenant isolation",
      desc: "Every tenant-owned record carries a workspace. Cross-workspace relationships fail at the database.",
      icon: ShieldCheck,
    },
    {
      title: "Least privilege & explicit visibility",
      desc: "Granular permissions, role-based access, and explicit internal/client/restricted visibility on every comment, file, and approval.",
      icon: Lock,
    },
    {
      title: "Auditable changes",
      desc: "Append-only audit log captures permission changes, approvals, exports, and financial mutations.",
      icon: FileCheck2,
    },
    {
      title: "Safe client collaboration",
      desc: "Portal users see only explicitly shared records — never inherited from workspace membership.",
      icon: Globe,
    },
  ]
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <MarketingBadge>Security & trust</MarketingBadge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Built like infrastructure, not a side project
            </h2>
            <p className="mt-4 text-muted-foreground">
              AgencyOS treats security as a first-class concern. Tenant isolation is enforced at the
              database layer, permissions are checked server-side on every mutation, and audit
              events are append-only.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "SOC 2-aligned",
                "RLS-enforced",
                "SSO-ready",
                "GDPR-friendly",
                "Audit log",
                "Encrypted secrets",
              ].map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
            <Button variant="outline" className="mt-6" asChild>
              <Link href="/security">
                Read the security overview
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((s) => (
              <Card key={s.title}>
                <CardHeader>
                  <s.icon className="h-5 w-5 text-foreground/70" />
                  <CardTitle className="mt-2 text-sm">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  const items = [
    {
      quote:
        "We replaced three SaaS tools with AgencyOS. Our account managers finally have a single timeline per client — and finance stopped chasing timesheets.",
      name: "Maya R.",
      title: "COO, Northstar Growth Studio (demo)",
      tag: "Demo testimonial",
    },
    {
      quote:
        "The client portal alone is worth it. Approvals that used to take a week of email ping-pong now close in hours.",
      name: "Daniel K.",
      title: "Founder, Meridian Creative (demo)",
      tag: "Demo testimonial",
    },
    {
      quote:
        "Pipeline + delivery + finance in one workspace means our profitability numbers finally reconcile. We trust the dashboard.",
      name: "Priya S.",
      title: "Head of Ops, Lumen Performance (demo)",
      tag: "Demo testimonial",
    },
  ]
  return (
    <section className="border-y border-border/60 bg-muted/20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <MarketingBadge>What agencies say</MarketingBadge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for the way agencies actually work
          </h2>
          <p className="mt-4 text-muted-foreground">
            The following testimonials are clearly-labelled demo content — not real customers.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((t) => (
            <Card key={t.name}>
              <CardContent>
                <Badge variant="outline" className="mb-4 text-xs text-muted-foreground">
                  {t.tag}
                </Badge>
                <blockquote className="text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground/5 text-xs font-medium">
                    {t.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.title}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingCTA() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {[
            {
              name: "Starter",
              price: "$0",
              cadence: "free for 5 seats",
              desc: "For new agencies getting organized.",
              features: [
                "CRM & pipelines",
                "Projects & tasks",
                "Time tracking",
                "Client portal (1 brand)",
              ],
              cta: "Start free",
              highlight: false,
            },
            {
              name: "Growth",
              price: "$29",
              cadence: "per seat / month",
              desc: "For agencies scaling delivery.",
              features: [
                "Everything in Starter",
                "Approvals & proofing",
                "Retainers & finance",
                "Automations",
                "Custom fields & dashboards",
                "Unlimited portal brands",
              ],
              cta: "Start free",
              highlight: true,
            },
            {
              name: "Scale",
              price: "Custom",
              cadence: "annual",
              desc: "For multi-brand & enterprise.",
              features: [
                "Everything in Growth",
                "SSO / SAML",
                "SCIM provisioning",
                "Custom domains",
                "Audit log export",
                "Priority support",
              ],
              cta: "Talk to us",
              highlight: false,
            },
          ].map((p) => (
            <Card key={p.name} className={p.highlight ? "border-foreground/20 shadow-md" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {p.highlight && <Badge>Most popular</Badge>}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.cadence}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={p.highlight ? "default" : "outline"}
                  asChild
                >
                  <Link href={p.name === "Scale" ? "/contact" : "/sign-up"}>{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prices shown are illustrative for product demonstration. All plans include the security
          model described in the{" "}
          <Link href="/security" className="underline">
            security overview
          </Link>
          .
        </p>
      </div>
    </section>
  )
}

function FAQ() {
  const faqs = [
    {
      q: "Is AgencyOS multi-tenant?",
      a: "Yes. Every tenant-owned record carries a workspace identifier, and isolation is enforced at the database layer. Cross-workspace access is rejected by policy, not just by navigation.",
    },
    {
      q: "Can clients see internal comments or financial data?",
      a: "No. Portal users only see records explicitly shared with them. Internal comments, costs, other clients, and unshared files are never visible — even by guessing URLs.",
    },
    {
      q: "Does it work for contractors?",
      a: "Yes. Contractors get a restricted role with access only to assigned or shared projects. They never see other clients, financials, or workspace settings.",
    },
    {
      q: "Can I customize pipelines, statuses, and fields?",
      a: "Yes. Pipelines, stages, project/task statuses, custom fields, terminology, and saved views are all configurable per workspace — without code.",
    },
    {
      q: "How does the client portal work?",
      a: "Each client can have a branded portal at /portal/{slug}. Portal users see shared projects, requests, files, approvals, and reports. Sharing is explicit and audited.",
    },
    {
      q: "Can I export my data?",
      a: "Yes. Permission-aware CSV exports respect current filters and field-level sensitivity. Every export is recorded in the audit log.",
    },
  ]
  return (
    <section className="border-t border-border/60 bg-muted/20 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <MarketingBadge>FAQ</MarketingBadge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Common questions
          </h2>
        </div>
        <div className="mt-12 space-y-3">
          {faqs.map((f) => (
            <Card key={f.q}>
              <CardHeader>
                <CardTitle className="text-base">{f.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
