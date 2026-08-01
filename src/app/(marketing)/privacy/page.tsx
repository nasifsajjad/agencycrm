import { MarketingBadge } from "@/components/marketing/shell"

export const metadata = { title: "Privacy" }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <MarketingBadge>Legal</MarketingBadge>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().getFullYear()}</p>

      <div className="prose prose-neutral mt-8 max-w-none text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Note:</strong> AgencyOS is a fictional brand created
          for product demonstration. This privacy policy is provided for illustrative purposes only.
        </p>
        <h2 className="text-foreground">1. Data we collect</h2>
        <p>
          We collect account information (name, email), workspace data you create (contacts, deals,
          projects, time entries, invoices), and usage data (audit events, logs with sensitive
          fields redacted).
        </p>
        <h2 className="text-foreground">2. How we use data</h2>
        <p>
          We use your data to provide the AgencyOS service, communicate with you about your account,
          and improve the product. We never train AI models on your tenant data by default.
        </p>
        <h2 className="text-foreground">3. Data retention</h2>
        <p>
          You can export or delete your data at any time. After account closure, we retain data for
          30 days then permanently delete it, unless a legal hold applies.
        </p>
        <h2 className="text-foreground">4. Data sharing</h2>
        <p>
          We do not sell your data. We share data with subprocessors strictly as needed to operate
          the service (hosting, email delivery, analytics) under GDPR-compatible data processing
          agreements.
        </p>
        <h2 className="text-foreground">5. Security</h2>
        <p>
          Tenant isolation is enforced at the database layer. Permissions are checked server-side on
          every mutation. Audit events are append-only. See our{" "}
          <a href="/security" className="text-foreground underline">
            security overview
          </a>
          .
        </p>
        <h2 className="text-foreground">6. Your rights</h2>
        <p>
          You have the right to access, export, correct, and delete your data. Contact us to
          exercise these rights.
        </p>
        <h2 className="text-foreground">7. Contact</h2>
        <p>
          Questions about privacy? Reach out via the{" "}
          <a href="/contact" className="text-foreground underline">
            contact page
          </a>
          .
        </p>
      </div>
    </div>
  )
}
