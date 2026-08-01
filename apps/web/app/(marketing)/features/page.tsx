import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MarketingBadge } from "@/components/marketing/shell"
import { appHref } from "@/lib/app-links"
import { features } from "@/lib/feature-catalogue"

export const metadata = { title: "Features" }

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <MarketingBadge>Features</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Deep, not wide</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Every feature is built to be useful on day one — and configurable enough to grow with your
          agency.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle className="text-sm">{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {f.category}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-12 text-center">
        <Button asChild size="lg">
          <Link href={appHref("/sign-up")}>Start free</Link>
        </Button>
      </div>
    </div>
  )
}
