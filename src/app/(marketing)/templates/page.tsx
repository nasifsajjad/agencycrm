import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MarketingBadge } from "@/components/marketing/shell"

export const metadata = { title: "Templates" }

const TEMPLATES = [
  {
    name: "Brand refresh",
    desc: "Visual identity, brand guidelines, and asset handoff. 6 weeks, 4 milestones.",
    category: "Creative",
    est: "$25-50K",
  },
  {
    name: "Q4 holiday campaign",
    desc: "Full-funnel paid social, email, and landing pages. 8 weeks.",
    category: "Campaign",
    est: "$30-80K",
  },
  {
    name: "Lifecycle email automation",
    desc: "5-step onboarding + retention sequence. 4 weeks.",
    category: "Email",
    est: "$10-25K",
  },
  {
    name: "SEO content sprint",
    desc: "Topic cluster + 12 optimized articles. 6 weeks.",
    category: "SEO",
    est: "$15-35K",
  },
  {
    name: "Paid media audit & restructure",
    desc: "Account audit, restructure, and 30-day optimization. 3 weeks.",
    category: "Paid Media",
    est: "$8-15K",
  },
  {
    name: "New product launch",
    desc: "Positioning, narrative, launch assets, and PR coordination. 10 weeks.",
    category: "Launch",
    est: "$40-90K",
  },
]

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <MarketingBadge>Templates</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Start from a template, not a blank page
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Pre-built project templates for the most common agency engagements. Customize or create
          your own.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Card key={t.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t.name}</CardTitle>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.category}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Typical range</span>
                <span className="text-sm font-medium">{t.est}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-12 text-center">
        <Button asChild size="lg">
          <Link href="/sign-up">Start free with a template</Link>
        </Button>
      </div>
    </div>
  )
}
