/**
 * AgencyOS — Server-side Supabase client.
 *
 * Production: creates a request-scoped server client using @supabase/ssr and
 * Next.js cookies. Never shared globally — cookies are per-request.
 *
 * When credentials are absent, callers fail closed rather than switching to a
 * second authentication or database implementation.
 */

import { cookies } from "next/headers"
import { createServerClient as supabaseServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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
 * Service-role client. SERVER-ONLY. Importable only from server modules.
 * Bypasses RLS — use only for trusted jobs that cannot operate under a user token.
 */
export function createServiceClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
