/**
 * AgencyOS — Server-side Supabase client.
 *
 * Production: creates a request-scoped server client using @supabase/ssr and
 * Next.js cookies. Never shared globally — cookies are per-request.
 *
 * When credentials are absent, callers fail closed rather than switching to a
 * second authentication or database implementation.
 */

import "server-only"

import { cookies } from "next/headers"
import { createServerClient as supabaseServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)

/**
 * Request-scoped server client. Cookies are read and written through Next.js.
 */
export async function createServerClient(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured) return null
  const cookieStore = await cookies()
  return supabaseServerClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component where cookies can't be set. Safe to ignore.
        }
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * There is deliberately no service-role client here.
 *
 * This is the public marketing site. Its only database work is inserting a
 * marketing inquiry, which goes through an RLS-governed anonymous insert
 * policy. A service-role client would bypass RLS entirely, and it had no
 * callers — it was left behind when the CRM code was removed from this app.
 *
 * Consequence worth keeping: apps/web does not need SUPABASE_SERVICE_ROLE_KEY
 * in its environment at all. Do not add it to this project's Vercel settings.
 * The key belongs only to apps/app, where the outbox worker uses it.
 */
