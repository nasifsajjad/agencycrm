"use server"

import { redirect } from "next/navigation"
import { applicationUrl } from "@agencyos/config"
import { createServerClient } from "@/lib/supabase/server"
import { normalizeEmail, isSafeRedirect } from "@/lib/auth"

/**
 * Every emailed auth link must land on this app's callback route, which
 * performs the PKCE code exchange and then forwards to a validated relative
 * path. Setting it explicitly here — rather than leaving it to the Supabase
 * dashboard's Site URL — keeps the destination under the control of the same
 * code that validates redirects everywhere else.
 */
const CALLBACK_URL = () => applicationUrl("/auth/callback")
const RECOVERY_CALLBACK_URL = () => applicationUrl("/auth/callback?type=recovery")

export async function signInAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const password = String(formData.get("password") ?? "")
  const next = isSafeRedirect(String(formData.get("next") ?? ""))
  if (!email || !password) return { error: "Email and password are required." }
  const supabase = await createServerClient()
  if (!supabase) return { error: "Supabase is not configured." }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect(next === "/" ? "/app" : next)
}

export async function signUpAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const password = String(formData.get("password") ?? "")
  const displayName = String(formData.get("name") ?? "").trim()
  const workspaceName = String(formData.get("workspace") ?? "").trim()
  if (!email || !password) return { error: "Email and password are required." }
  if (password.length < 8) return { error: "Password must be at least 8 characters." }
  const supabase = await createServerClient()
  if (!supabase) return { error: "Supabase is not configured." }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split("@")[0] },
      emailRedirectTo: CALLBACK_URL(),
    },
  })
  if (error) return { error: error.message }
  if (!data.user) return { error: "Unable to create your account." }
  if (!data.session) return { ok: true, needsEmailConfirmation: true }

  if (workspaceName) {
    const slug = await uniqueSlug(workspaceName)
    const { error: workspaceError } = await supabase.rpc("create_workspace", {
      p_name: workspaceName,
      p_slug: slug,
      p_currency: "USD",
      p_timezone: "UTC",
    })
    if (workspaceError) return { error: workspaceError.message }
    redirect(`/w/${slug}`)
  }
  redirect("/onboarding")
}

export async function signOutAction() {
  const supabase = await createServerClient()
  await supabase?.auth.signOut()
  redirect("/sign-in")
}

export async function forgotPasswordAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  if (!email) return { error: "Email is required." }
  const supabase = await createServerClient()
  if (supabase) {
    // Without an explicit redirectTo the recovery link goes wherever the
    // Supabase project's Site URL points, which may not be this app at all.
    // The callback route reads type=recovery and forwards to /reset-password.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RECOVERY_CALLBACK_URL(),
    })
  }
  // Always the same response, so this cannot be used to enumerate accounts.
  return { ok: true }
}

/**
 * Magic-link sign-in. The link lands on /auth/callback, which exchanges the
 * code for a session and forwards to a validated relative path.
 */
export async function signInWithMagicLinkAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const next = isSafeRedirect(String(formData.get("next") ?? ""))
  if (!email) return { error: "Email is required." }
  const supabase = await createServerClient()
  if (!supabase) return { error: "Supabase is not configured." }

  const target = next === "/" ? "/app" : next
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // `next` has already been validated as an app-local path by
      // isSafeRedirect; the callback route validates it again on the way back.
      emailRedirectTo: applicationUrl(`/auth/callback?next=${encodeURIComponent(target)}`),
    },
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function resetPasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "")
  if (password.length < 8) return { error: "Password must be at least 8 characters." }
  const supabase = await createServerClient()
  if (!supabase) return { error: "Supabase is not configured." }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: "Unable to reset password. Request a new link and try again." }
  redirect("/app")
}

async function uniqueSlug(name: string) {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  const supabase = await createServerClient()
  if (!supabase) return base
  let slug = base
  let suffix = 1
  while (true) {
    const { data } = await supabase.from("workspaces").select("id").eq("slug", slug).maybeSingle()
    if (!data) return slug
    suffix += 1
    slug = `${base}-${suffix}`
  }
}
