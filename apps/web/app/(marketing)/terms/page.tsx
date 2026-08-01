import { MarketingBadge } from "@/components/marketing/shell"

export const metadata = { title: "Terms" }

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <MarketingBadge>Legal</MarketingBadge>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().getFullYear()}</p>

      <div className="prose prose-neutral mt-8 max-w-none text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Note:</strong> AgencyOS is a fictional brand created
          for product demonstration. These terms are illustrative only.
        </p>
        <h2 className="text-foreground">1. Acceptance</h2>
        <p>
          By using AgencyOS, you agree to these terms. If you do not agree, do not use the service.
        </p>
        <h2 className="text-foreground">2. Accounts</h2>
        <p>
          You are responsible for safeguarding your account. You must be 16 or older. Workspace
          owners control member access and are responsible for their members&apos; activity.
        </p>
        <h2 className="text-foreground">3. Acceptable use</h2>
        <p>
          You agree not to abuse the service, attempt to access other tenants&apos; data, introduce
          malware, or violate applicable law. We may suspend accounts that violate these terms.
        </p>
        <h2 className="text-foreground">4. Data &amp; backups</h2>
        <p>
          You own your data. We provide export tools and retain backups for disaster recovery. We do
          not access tenant data except as needed to operate the service or as required by law.
        </p>
        <h2 className="text-foreground">5. Plans &amp; billing</h2>
        <p>
          Paid plans are billed in advance. You can cancel anytime; refunds are prorated where
          applicable. Prices shown on the{" "}
          <a href="/pricing" className="text-foreground underline">
            pricing page
          </a>{" "}
          are illustrative.
        </p>
        <h2 className="text-foreground">6. Service availability</h2>
        <p>
          We target 99.9% uptime for Scale plans. We are not liable for outages caused by factors
          outside our control.
        </p>
        <h2 className="text-foreground">7. Termination</h2>
        <p>
          You can close your account at any time. We may suspend or terminate accounts that violate
          these terms.
        </p>
        <h2 className="text-foreground">8. Liability</h2>
        <p>
          The service is provided &ldquo;as is.&rdquo; To the maximum extent permitted by law, our
          liability is limited to the amount you paid in the prior 12 months.
        </p>
        <h2 className="text-foreground">9. Contact</h2>
        <p>
          Questions? Reach out via the{" "}
          <a href="/contact" className="text-foreground underline">
            contact page
          </a>
          .
        </p>
      </div>
    </div>
  )
}
