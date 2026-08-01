import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, MessageSquare, Calendar, Building2 } from "lucide-react"
import { MarketingBadge } from "@/components/marketing/shell"
import { appHref } from "@/lib/app-links"
import { ContactForm } from "@/components/marketing/contact-form"

export const metadata = { title: "Contact" }

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <MarketingBadge>Contact</MarketingBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Get in touch</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          We&apos;re here to help. Reach out however works best for you.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Mail className="h-5 w-5 text-foreground/70" />
            <CardTitle className="mt-2 text-sm">Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Questions about plans, pricing, or demos? Our team is happy to help.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/book-demo">Book a demo</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <MessageSquare className="h-5 w-5 text-foreground/70" />
            <CardTitle className="mt-2 text-sm">Support</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Existing customer? Sign in and use the in-app help widget for fastest response.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={appHref("/sign-in")}>Sign in</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Building2 className="h-5 w-5 text-foreground/70" />
            <CardTitle className="mt-2 text-sm">Partnerships</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Interested in integrating with AgencyOS or becoming a partner? We&apos;d love to talk.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/book-demo">Reach out</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-12">
        <CardHeader>
          <CardTitle>Send us a message</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  )
}
