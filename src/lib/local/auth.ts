/**
 * Local auth adapter — re-exports the existing Prisma-backed session helpers.
 * Used as a fallback when Supabase env vars are missing.
 */

export {
  getCurrentUser,
  requireUser,
  getWorkspaceContext,
  can,
  requirePermission,
  AuthorizationError,
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  normalizeEmail,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/auth"
export type { WorkspaceContext } from "@/lib/auth"
