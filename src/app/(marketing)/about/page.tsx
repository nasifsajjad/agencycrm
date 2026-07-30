import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingBadge } from "@/components/marketing/shell";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <MarketingBadge>About</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">We build the tools we wished we had</h1>
      </div>
      <div className="prose prose-neutral mt-8 max-w-none text-muted-foreground">
        <p>
          AgencyOS was born from years of frustration with the patchwork of tools agencies use to run their operations — CRM in one place, projects in another, time tracked in a spreadsheet, finance in yet another. The result was always the same: data locked in silos, profitability numbers that never reconciled, and clients who had to chase three different people for an update.
        </p>
        <p>
          We set out to build something different: a single workspace that connects the complete lead-to-renewal lifecycle, configurable enough to feel custom-built for each agency without requiring them to write code. Every contact, decision, task, hour, and dollar belongs to one coherent data graph.
        </p>
        <p>
          We believe security is not a feature you add later. Tenant isolation is enforced at the database layer. Permissions are checked server-side on every mutation. Audit events are append-only. We never train on tenant data by default, and AI features are assistive, opt-in, and reviewable.
        </p>
        <p>
          <strong className="text-foreground">Note:</strong> AgencyOS is a fictional brand created for product demonstration. All customer testimonials, logos, and case studies on this site are clearly-labelled demo content.
        </p>
      </div>
      <div className="mt-8 text-center">
        <Button asChild><Link href="/sign-up">Start free</Link></Button>
      </div>
    </div>
  );
}
