/**
 * AgencyOS — Supabase client factories.
 *
 * Production: uses @supabase/supabase-js + @supabase/ssr with NEXT_PUBLIC_SUPABASE_URL
 * and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 *
 * When those env vars are missing, browser auth actions fail closed. There is
 * no alternate session implementation in the production bundle.
 */

import { createBrowserClient as supabaseBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)

/**
 * Browser-side Supabase client. Used by client components for auth state,
 * realtime subscriptions, and direct storage uploads (subject to RLS).
 */
export function createBrowserClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null
  return supabaseBrowserClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!)
}

/**
 * Password sign-in through Supabase Auth.
 */
export async function signInWithPassword(email: string, password: string) {
  const client = createBrowserClient()
  if (!client) {
    return { error: { message: "Supabase not configured; use the local sign-in form." } }
  }
  return client.auth.signInWithPassword({ email, password })
}

export async function signInWithOtp(email: string) {
  const client = createBrowserClient()
  if (!client) {
    return { error: { message: "Supabase not configured." } }
  }
  return client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  })
}

export async function signUpWithPassword(email: string, password: string, displayName?: string) {
  const client = createBrowserClient()
  if (!client) {
    return { error: { message: "Supabase not configured; use the local sign-up form." } }
  }
  return client.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName ?? email.split("@")[0] },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}

export async function signOut() {
  const client = createBrowserClient()
  if (!client) return
  await client.auth.signOut()
}
