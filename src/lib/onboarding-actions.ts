"use server"

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"

function isSafeSlug(s: string): boolean {
  return /^[a-z0-9-]{2,40}$/.test(s) && !s.startsWith("-") && !s.endsWith("-")
}

export async function createWorkspaceAction(input: {
  name: string
  slug: string
  currency: string
  timezone: string
}) {
  const user = await getCurrentUser()
  if (!user) return { error: "You must be signed in." }
  if (!input.name.trim()) return { error: "Workspace name is required." }
  if (!isSafeSlug(input.slug))
    return { error: "Slug must be 2-40 lowercase letters, digits, or hyphens." }
  const supabase = await createServerClient()
  if (!supabase) return { error: "Supabase is not configured." }
  const { data: existing } = await supabase.from("workspaces").select("id").eq("slug", input.slug).maybeSingle()
  if (existing) return { error: "That slug is taken. Try another." }

  const { data: workspaceId, error } = await supabase.rpc("create_workspace", {
    p_name: input.name.trim(),
    p_slug: input.slug,
    p_currency: input.currency,
    p_timezone: input.timezone,
  })
  if (error || !workspaceId) return { error: error?.message ?? "Unable to create workspace." }

  return { slug: input.slug }
}

export async function loadDemoDataAction(input: {
  name: string
  slug: string
  currency: string
  timezone: string
}) {
  const user = await getCurrentUser()
  if (!user) return { error: "You must be signed in." }
  if (!isSafeSlug(input.slug))
    return { error: "Slug must be 2-40 lowercase letters, digits, or hyphens." }
  const supabase = await createServerClient()
  if (!supabase) return { error: "Supabase is not configured." }
  const { data: existing } = await supabase.from("workspaces").select("id").eq("slug", input.slug).maybeSingle()
  if (existing) return { error: "That slug is taken. Try another." }

  const { data: workspaceId, error } = await supabase.rpc("create_workspace", {
    p_name: input.name.trim() || "Northstar Growth Studio",
    p_slug: input.slug,
    p_currency: input.currency,
    p_timezone: input.timezone,
  })
  if (error || !workspaceId) return { error: error?.message ?? "Unable to create workspace." }
  // Demo data is intentionally separate from workspace bootstrap. The
  // production path uses seed/admin tooling so end users cannot create
  // arbitrary records outside RLS-scoped mutations.

  return { slug: input.slug }
}
