import Link from "next/link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MarketingBadge } from "@/components/marketing/shell"

const SOLUTIONS: Record<
  string,
  { title: string; subtitle: string; pains: string[]; wins: string[] }
> = {
  agencies: {
    title: "Full-service agencies",
    subtitle: "Run every client engagement — from lead to renewal — in one workspace.",
    pains: [
      "Patchwork of CRM, project, time, and finance tools",
      "Profitability numbers that never reconcile",
      "Clients chasing three people for an update",
      "Onboarding that reinvents itself every time",
    ],
    wins: [
      "Pipeline + delivery + finance in one graph",
      "Real margin per client, project, and team",
      "Client portal that closes approvals in hours",
      "Templated onboarding for new clients",
    ],
  },
  creative: {
    title: "Creative teams",
    subtitle: "Proof, approve, and deliver without the email tennis match.",
    pains: [
      "Version chaos across feedback rounds",
      "Internal notes leaking to clients",
      "Approvals stuck in inboxes",
      "No clear audit trail of decisions",
    ],
    wins: [
      "Versioned deliverables with immutable approvals",
      "Internal vs client-visible comments",
      "Multi-step approval workflows",
      "Complete audit trail of every decision",
    ],
  },
  "performance-marketing": {
    title: "Performance marketing teams",
    subtitle: "Pull performance, track spend, and report on outcomes — without spreadsheets.",
    pains: [
      "Performance data locked in ad platforms",
      "Manual reporting every Monday morning",
      "No link between spend and outcomes",
      "Clients asking 'what did I get for my money?'",
    ],
    wins: [
      "Normalized performance metrics across channels",
      "Automated weekly report delivery",
      "Spend tied to projects and budgets",
      "Branded client portal with live reporting",
    ],
  },
}

export function generateStaticParams() {
  return Object.keys(SOLUTIONS).map((solution) => ({ solution }))
}

export async function generateMetadata({ params }: { params: Promise<{ solution: string }> }) {
  const { solution } = await params
  const data = SOLUTIONS[solution]
  return { title: data?.title ?? "Solutions" }
}

export default async function SolutionPage({ params }: { params: Promise<{ solution: string }> }) {
  const { solution } = await params
  const data = SOLUTIONS[solution]
  if (!data) notFound()
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <MarketingBadge>Solutions</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Solutions for {data.title.toLowerCase()}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{data.subtitle}</p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/sign-up">Start free</Link>
          </Button>
        </div>
      </div>

      <div className="mt-16 grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Without AgencyOS</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.pains.map((p) => (
                <li key={p} className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" /> {p}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-foreground/20">
          <CardHeader>
            <CardTitle className="text-base">With AgencyOS</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.wins.map((w) => (
                <li key={w} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success" /> {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
