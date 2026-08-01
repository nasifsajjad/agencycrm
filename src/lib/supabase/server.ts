/**
 * AgencyOS — Server-side Supabase client.
 *
 * Production: creates a request-scoped server client using @supabase/ssr and
 * Next.js cookies. Never shared globally — cookies are per-request.
 *
 * Local fallback: returns null when Supabase env vars are missing; callers
 * fall back to the Prisma-backed local adapter.
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

/**
 * Resolve the current authenticated user. Tries Supabase first, falls back
 * to the local session cookie.
 */
export async function getCurrentUser() {
  const supabase = await createServerClient()
  if (supabase) {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      emailNormalized: (data.user.email ?? "").toLowerCase().trim(),
      displayName:
        (data.user.user_metadata as any)?.display_name ?? data.user.email?.split("@")[0] ?? "User",
    }
  }
  // Fallback: local adapter
  const { getCurrentUser: getLocalUser } = await import("@/lib/local/auth")
  return getLocalUser()
}
