"use server"

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import {
  createSession,
  destroySession,
  hashPassword,
  normalizeEmail,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
} from "@/lib/auth"
import { bootstrapWorkspace } from "@/lib/workspace"

function isSafeRedirect(target: string | undefined | null): string {
  if (!target) return "/"
  if (typeof target !== "string") return "/"
  // Allow only same-origin relative paths
  if (!target.startsWith("/") || target.startsWith("//")) return "/"
  // Block protocol-relative URLs
  if (target.includes(":")) return "/"
  return target
}

export async function signInAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const password = String(formData.get("password") ?? "")
  const next = isSafeRedirect(String(formData.get("next") ?? ""))

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const user = await db.user.findUnique({ where: { emailNormalized: email } })
  if (!user || !user.passwordHash) {
    return { error: "No account found with that email. Try signing up." }
  }
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return { error: "Incorrect password." }

  const { token, expiresAt } = await createSession(user.id)
  await setSessionCookie(token, expiresAt)
  redirect(next || "/app")
}

export async function signUpAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const password = String(formData.get("password") ?? "")
  const displayName = String(formData.get("name") ?? "").trim()
  const workspaceName = String(formData.get("workspace") ?? "").trim()

  if (!email || !password) return { error: "Email and password are required." }
  if (password.length < 8) return { error: "Password must be at least 8 characters." }

  const existing = await db.user.findUnique({ where: { emailNormalized: email } })
  if (existing) return { error: "An account with that email already exists." }

  const passwordHash = await hashPassword(password)
  const user = await db.user.create({
    data: {
      email,
      emailNormalized: email,
      passwordHash,
      displayName: displayName || email.split("@")[0],
    },
  })

  // Bootstrap a workspace immediately if a name was provided
  if (workspaceName) {
    const slug = await uniqueSlug(workspaceName)
    await bootstrapWorkspace({
      name: workspaceName,
      slug,
      ownerId: user.id,
    })
  }

  const { token, expiresAt } = await createSession(user.id)
  await setSessionCookie(token, expiresAt)
  redirect(workspaceName ? `/w/${await uniqueSlug(workspaceName)}` : "/onboarding")
}

export async function signOutAction() {
  const cookieStore = await import("next/headers").then((m) => m.cookies())
  const jwt = (await cookieStore).get("aos_session")?.value
  // Decode token without verifying just to delete the session row
  if (jwt) {
    try {
      const { jwtVerify } = await import("jose")
      const { payload } = await jwtVerify(
        jwt,
        new TextEncoder().encode(
          process.env.SESSION_SECRET || "agencyos-local-dev-secret-change-me"
        )
      )
      const token = (payload as { t?: string }).t
      if (token) await destroySession(token)
    } catch {
      // ignore — session may already be invalid
    }
  }
  await clearSessionCookie()
  redirect("/sign-in")
}

export async function forgotPasswordAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  if (!email) return { error: "Email is required." }
  // Local mode: do not send real email. Acknowledge to prevent enumeration.
  // In production, this would enqueue a reset email through the email adapter.
  return { ok: true }
}

async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  let slug = base
  let i = 1
  while (await db.workspace.findUnique({ where: { slug } })) {
    i += 1
    slug = `${base}-${i}`
  }
  return slug
}
