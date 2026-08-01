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
 * Sign-in, sign-up, magic link, password reset and sign-out all run as server
 * actions in `@/lib/auth-actions`, so the session cookie is written by the
 * server and the redirect target is validated there.
 *
 * This module previously also exported browser-side signInWithPassword,
 * signInWithOtp, signUpWithPassword and signOut helpers. They had no importers
 * and derived their email redirect from `window.location.origin`, which is
 * attacker-influencable in a way the server actions' applicationUrl() is not.
 * They were removed rather than left as a second, weaker path to the same
 * operations.
 */

export async function signOut() {
  const client = createBrowserClient()
  if (!client) return
  await client.auth.signOut()
}
