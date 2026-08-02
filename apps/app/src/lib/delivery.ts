import { createHmac } from "node:crypto"
import dns from "node:dns/promises"
import net from "node:net"

export type EmailMessage = { to: string; subject: string; text: string; html?: string }

function validEmail(value: string) {
  return value.length <= 320 && !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function sendEmail(message: EmailMessage): Promise<{ providerMessageId: string }> {
  if (!validEmail(message.to)) throw new Error("Invalid email recipient")
  if (!message.subject || /[\r\n]/.test(message.subject)) throw new Error("Invalid email subject")
  const provider = process.env.EMAIL_PROVIDER
  const apiKey = process.env.EMAIL_API_KEY
  const from = process.env.EMAIL_FROM
  if (provider !== "resend" || !apiKey || !from || !validEmail(from)) {
    throw new Error("Email delivery is not configured")
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: controller.signal,
    })
    const body = await response.text()
    if (!response.ok) throw new Error(`Email provider rejected delivery (${response.status})`)
    const parsed = JSON.parse(body) as { id?: unknown }
    if (typeof parsed.id !== "string" || !parsed.id)
      throw new Error("Email provider returned no message id")
    return { providerMessageId: parsed.id }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Sends a workspace invitation.
 *
 * Supabase is the default and needs no third-party provider: Auth already
 * sends confirmation, recovery and magic-link mail, and `inviteUserByEmail`
 * reuses that same mailer. The invite link authenticates the recipient and
 * lands them on our own /accept-invite page, where the single-use token in the
 * URL is exchanged by the accept_invitation RPC — so Supabase handles delivery
 * and identity while the workspace membership decision stays ours.
 *
 * Set EMAIL_PROVIDER=resend to route through Resend instead.
 *
 * Two limits worth knowing about Supabase's built-in SMTP:
 *   - It is rate limited to a handful of messages per hour and is documented
 *     as development-only. For production, set Custom SMTP in the Supabase
 *     dashboard; this code path does not change.
 *   - inviteUserByEmail only works for addresses with no account yet. An
 *     existing user is handled below by falling back to a magic link to the
 *     same destination.
 */
export async function sendInvitationEmail(input: {
  email: string
  inviteUrl: string
  workspaceName?: string
  admin: {
    inviteUserByEmail: (
      email: string,
      options?: { redirectTo?: string; data?: Record<string, unknown> }
    ) => Promise<{ error: { message: string; status?: number } | null }>
    generateLink: (params: {
      type: "magiclink"
      email: string
      options?: { redirectTo?: string }
    }) => Promise<{ error: { message: string } | null }>
  }
}): Promise<{ providerMessageId: string }> {
  if (!validEmail(input.email)) throw new Error("Invalid email recipient")

  if (process.env.EMAIL_PROVIDER === "resend") {
    return sendEmail({
      to: input.email,
      subject: `You have been invited to ${input.workspaceName ?? "AgencyOS"}`,
      text: `You have been invited to join a workspace. Open this link to accept: ${input.inviteUrl}`,
    })
  }

  const { error } = await input.admin.inviteUserByEmail(input.email, {
    redirectTo: input.inviteUrl,
    data: { invited_to: input.workspaceName ?? null },
  })

  if (!error) return { providerMessageId: `supabase-invite:${input.email}` }

  // Already registered: invite is not available, but a magic link reaches the
  // same page with the same token, and they are already able to sign in.
  const alreadyRegistered =
    error.status === 422 || /already been registered|already exists/i.test(error.message)

  if (!alreadyRegistered) {
    throw new Error(`Supabase could not send the invitation: ${error.message}`)
  }

  const { error: linkError } = await input.admin.generateLink({
    type: "magiclink",
    email: input.email,
    options: { redirectTo: input.inviteUrl },
  })
  if (linkError) {
    throw new Error(`Supabase could not send the invitation: ${linkError.message}`)
  }
  return { providerMessageId: `supabase-magiclink:${input.email}` }
}

function privateAddress(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number)
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }
  const normalized = address.toLowerCase()
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  )
}

export async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
  secret: string
): Promise<number> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("Webhook URL is invalid")
  }
  if (
    parsed.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && process.env.ALLOW_INSECURE_WEBHOOKS === "true")
  ) {
    throw new Error("Webhook URL must use HTTPS")
  }
  if (parsed.username || parsed.password) throw new Error("Webhook URL cannot contain credentials")
  const addresses = await dns.lookup(parsed.hostname, { all: true })
  if (addresses.some(({ address }) => privateAddress(address)))
    throw new Error("Webhook URL resolves to a private address")
  const body = JSON.stringify(payload)
  const signature = createHmac("sha256", secret).update(body).digest("hex")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(parsed, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgencyOS-Signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    })
    const responseBody = await response.text()
    if (responseBody.length > 64 * 1024) throw new Error("Webhook response exceeded limit")
    if (!response.ok) throw new Error(`Webhook delivery failed (${response.status})`)
    return response.status
  } finally {
    clearTimeout(timeout)
  }
}
