import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Book, Shield, Rocket, Code, Settings, Database } from "lucide-react";
import { MarketingBadge } from "@/components/marketing/shell";

export const metadata = { title: "Docs" };

const SECTIONS = [
  { icon: Rocket, title: "Getting started", desc: "Sign up, create your workspace, load demo data, and explore in 5 minutes.", items: ["Quick start", "Workspace setup", "Load demo data", "Invite your team"] },
  { icon: Book, title: "Product guide", desc: "Everything you need to use AgencyOS day-to-day, from CRM to finance.", items: ["CRM & pipelines", "Clients & delivery", "Approvals & portal", "Time & finance", "Reports & dashboards"] },
  { icon: Settings, title: "Configuration", desc: "Make AgencyOS your own with custom fields, statuses, terminology, and saved views.", items: ["Custom fields", "Custom statuses", "Saved views", "Role-aware dashboards"] },
  { icon: Shield, title: "Security & permissions", desc: "Understand the permission model, audit log, and tenant isolation.", items: ["Permission catalogue", "Roles & teams", "Audit log", "Tenant isolation"] },
  { icon: Code, title: "API & webhooks", desc: "Programmatic access to AgencyOS — for power users and integrations.", items: ["REST API", "Webhooks", "Rate limits", "Authentication"] },
  { icon: Database, title: "Data model", desc: "The complete schema and entity relationships.", items: ["Entity map", "Field reference", "Relationships", "Custom fields"] },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <MarketingBadge>Docs</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Documentation</h1>
        <p className="mt-4 text-lg text-muted-foreground">Everything you need to get started, configure, and operate AgencyOS.</p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <s.icon className="h-5 w-5 text-foreground/70" />
              <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {s.items.map((i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground" /> {i}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-12 text-center">
        <p className="text-sm text-muted-foreground">Want to dive in?</p>
        <Button asChild className="mt-3"><Link href="/sign-up">Start free</Link></Button>
      </div>
    </div>
  );
}
