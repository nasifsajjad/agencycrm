import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-lg">AgencyOS</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="/product" className="hover:text-foreground transition-colors">Product</Link>
          <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="/solutions/agencies" className="hover:text-foreground transition-colors">Solutions</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
          <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">
              Start free
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-5 lg:px-8">
        <div className="col-span-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-lg">AgencyOS</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            The operating system for modern marketing agencies. Configurable, secure, and built for the
            full lead-to-renewal lifecycle.
          </p>
          <p className="mt-4 text-xs text-muted-foreground/70">
            © {new Date().getFullYear()} AgencyOS. Fictional brand for product demonstration.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            { label: "Overview", href: "/product" },
            { label: "Features", href: "/features" },
            { label: "Pricing", href: "/pricing" },
            { label: "Security", href: "/security" },
          ]}
        />
        <FooterCol
          title="Solutions"
          links={[
            { label: "Agencies", href: "/solutions/agencies" },
            { label: "Creative teams", href: "/solutions/creative" },
            { label: "Performance marketing", href: "/solutions/performance-marketing" },
            { label: "Book a demo", href: "/book-demo" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { label: "About", href: "/about" },
            { label: "Contact", href: "/contact" },
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
          ]}
        />
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-foreground transition-colors">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarketingBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </Badge>
  );
}
