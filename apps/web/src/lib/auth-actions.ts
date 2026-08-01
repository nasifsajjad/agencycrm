"use server"

import { redirect } from "next/navigation"
import { appHref } from "@/lib/app-links"
import { createServerClient } from "@/lib/supabase/server"
import { normalizeEmail, isSafeRedirect } from "@/lib/auth"

export async function signInAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const password = String(formData.get("password") ?? "")
  const next = isSafeRedirect(String(formData.get("next") ?? ""))
  if (!email || !password) return { error: "Email and password are required." }
  const supabase = await createServerClient()
  if (!supabase) return { error: "Supabase is not configured." }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect(appHref(next === "/" ? "/app" : next))
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
    options: { data: { display_name: displayName || email.split("@")[0] } },
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
    redirect(appHref(`/w/${slug}`))
  }
  redirect(appHref("/onboarding"))
}

export async function signOutAction() {
  const supabase = await createServerClient()
  await supabase?.auth.signOut()
  redirect(appHref("/sign-in"))
}

export async function forgotPasswordAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  if (!email) return { error: "Email is required." }
  const supabase = await createServerClient()
  if (supabase) await supabase.auth.resetPasswordForEmail(email)
  return { ok: true }
}

async function uniqueSlug(name: string) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace"
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
