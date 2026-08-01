import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import { MarketingBadge } from "@/components/marketing/shell"
import { appHref } from "@/lib/app-links"

export const metadata = { title: "Pricing" }

const PLANS = [
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
      "2-week audit log",
      "Community support",
    ],
    cta: "Start free",
    href: appHref("/sign-up"),
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
      "90-day audit log",
      "Priority support",
    ],
    cta: "Start free",
    href: appHref("/sign-up"),
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
      "Unlimited audit log",
      "Sandbox & config promotion",
      "Dedicated CSM",
      "99.9% uptime SLA",
    ],
    cta: "Talk to us",
    href: "/contact",
    highlight: false,
  },
]

const FAQ = [
  {
    q: "Is there a free plan?",
    a: "Yes — Starter is free for the first 5 seats, including CRM, projects, time tracking, and a 1-brand client portal.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes, you can upgrade or downgrade at any time. Changes are prorated automatically.",
  },
  {
    q: "Do you offer discounts?",
    a: "Annual billing gets a 20% discount. Non-profits and early-stage agencies may qualify for additional discounts — contact us.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit cards. Scale plan customers can pay by ACH or wire.",
  },
  {
    q: "Is my data locked in?",
    a: "No. You can export your data at any time as CSV. Every export is recorded in the audit log.",
  },
]

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <MarketingBadge>Pricing</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Pricing that scales with you
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Start free. Upgrade when you&apos;re ready. No hidden fees.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.name} className={p.highlight ? "border-foreground/20 shadow-md" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{p.name}</CardTitle>
                {p.highlight && (
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                    Most popular
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
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
              <Button asChild className="mt-6 w-full" variant={p.highlight ? "default" : "outline"}>
                <Link href={p.href}>{p.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Prices are illustrative for product demonstration. All plans include the security model
        described in the{" "}
        <Link href="/security" className="underline">
          security overview
        </Link>
        .
      </p>

      <div className="mx-auto mt-16 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Pricing FAQ</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((f) => (
            <Card key={f.q}>
              <CardHeader>
                <CardTitle className="text-sm">{f.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
