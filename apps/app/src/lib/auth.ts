import { redirect } from "next/navigation"
import { safeRedirectPath } from "@agencyos/config"
import { createServerClient } from "@/lib/supabase/server"
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from "@/lib/permissions"

export const normalizeEmail = (email: string) => email.trim().toLowerCase()
export const isSafeRedirect = safeRedirectPath
export const hashPassword = async (_password: string) => {
  throw new Error("Use Supabase Admin Auth for seeded users")
}
export const verifyPassword = async () => false

export interface AuthUser {
  id: string
  email: string
  emailNormalized: string
  displayName: string
  avatarPath?: string | null
  locale?: string
  timezone?: string
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createServerClient()
  if (!supabase) return null
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", authData.user.id)
    .maybeSingle()
  const metadata = authData.user.user_metadata as Record<string, unknown> | undefined
  const email = authData.user.email ?? String(profile?.email ?? "")
  return {
    id: authData.user.id,
    email,
    emailNormalized: normalizeEmail(email),
    displayName: String(
      profile?.display_name ?? metadata?.display_name ?? email.split("@")[0] ?? "User"
    ),
    avatarPath: profile?.avatar_path ?? null,
    locale: profile?.locale ?? "en",
    timezone: profile?.timezone ?? "UTC",
  }
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  return user
}

export interface WorkspaceContext {
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
  userId: string
  membershipId: string
  roles: string[]
  permissions: Set<Permission>
  isOwner: boolean
}

export async function getUserMemberships(userId: string) {
  const supabase = await createServerClient()
  if (!supabase) return []
  const { data } = await supabase
    .from("workspace_memberships")
    .select("*, workspaces(*)")
    .eq("user_id", userId)
    .eq("status", "active")
  return data ?? []
}

export async function getWorkspaceContext(
  workspaceSlug: string,
  user: { id: string }
): Promise<WorkspaceContext | null> {
  const supabase = await createServerClient()
  if (!supabase) return null
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", workspaceSlug)
    .maybeSingle()
  if (workspaceError || !workspace) return null
  const { data: membership, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (membershipError || !membership) return null

  const { data: membershipRoles } = await supabase
    .from("membership_roles")
    .select("role_id")
    .eq("membership_id", membership.id)
  const roleIds = (membershipRoles ?? []).map((item) => item.role_id)
  const { data: roles } = roleIds.length
    ? await supabase.from("roles").select("*").in("id", roleIds)
    : { data: [] }
  const roleNames = (roles ?? []).map((role) => role.name as string)
  const permissionSet = new Set<Permission>()
  for (const role of roles ?? []) {
    const roleName = String(role.name)
    if (roleName === "Owner") PERMISSIONS.forEach((permission) => permissionSet.add(permission))
    for (const permission of ROLE_PERMISSIONS[roleName] ?? []) permissionSet.add(permission)
    const { data: links } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", role.id)
    const permissionIds = (links ?? []).map((link) => link.permission_id)
    if (permissionIds.length) {
      const { data: permissionRows } = await supabase
        .from("permissions")
        .select("key")
        .in("id", permissionIds)
      for (const permission of permissionRows ?? []) permissionSet.add(permission.key as Permission)
    }
  }

  return {
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    userId: user.id,
    membershipId: membership.id,
    roles: roleNames,
    permissions: permissionSet,
    isOwner: workspace.owner_id === user.id || roleNames.includes("Owner"),
  }
}

export function can(ctx: WorkspaceContext, permission: Permission) {
  return ctx.isOwner || ctx.permissions.has(permission)
}

export function requirePermission(ctx: WorkspaceContext, permission: Permission) {
  if (!can(ctx, permission)) throw new AuthorizationError(`Missing permission: ${permission}`)
}

export class AuthorizationError extends Error {
  status = 403
  constructor(message: string) {
    super(message)
    this.name = "AuthorizationError"
  }
}

// Compatibility exports are intentionally no-ops for code paths that are
// being removed. Supabase Auth owns the session cookie and refresh lifecycle.
export async function createSession() {
  throw new Error("Supabase Auth owns sessions")
}
export async function setSessionCookie() {
  throw new Error("Supabase Auth owns session cookies")
}
export async function destroySession() {
  const client = await createServerClient()
  await client?.auth.signOut()
}
export async function clearSessionCookie() {
  const client = await createServerClient()
  await client?.auth.signOut()
}
