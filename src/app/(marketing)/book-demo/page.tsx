import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, CheckCircle2 } from "lucide-react";
import { MarketingBadge } from "@/components/marketing/shell";

export const metadata = { title: "Book a demo" };

export default function BookDemoPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <MarketingBadge>Book a demo</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">See AgencyOS in action</h1>
        <p className="mt-4 text-lg text-muted-foreground">A 30-minute walkthrough, tailored to your agency&apos;s workflow.</p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">What you&apos;ll see</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              "Lead-to-renewal workflow in one workspace",
              "Configurable pipelines, statuses, and custom fields",
              "Client 360 with health, renewal, and finance summary",
              "Approvals with versioning and client portal",
              "Time tracking, capacity, and profitability",
              "Role-aware dashboards for every persona",
            ].map((p) => (
              <li key={p} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="mt-2 text-2xl font-semibold">30 min</div>
                <div className="text-xs text-muted-foreground">Quick and focused</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="mt-2 text-2xl font-semibold">1:1</div>
                <div className="text-xs text-muted-foreground">Tailored to you</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pick a time</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Name</label>
                <input className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Work email</label>
                <input type="email" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" placeholder="you@agency.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Agency name</label>
                <input className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" placeholder="Acme Agency" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Team size</label>
                <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                  <option>1-5</option>
                  <option>6-20</option>
                  <option>21-50</option>
                  <option>51-200</option>
                  <option>200+</option>
                </select>
              </div>
              <Button type="button" disabled className="w-full">
                <Calendar className="mr-1 h-4 w-4" /> Schedule (demo)
              </Button>
              <p className="text-xs text-muted-foreground">Demo form. In production this would open a calendar picker.</p>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Or explore on your own — <Link href="/sign-up" className="underline hover:text-foreground">start free</Link> and load demo data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
