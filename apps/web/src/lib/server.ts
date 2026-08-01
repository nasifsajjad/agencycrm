import { redirect } from "next/navigation"
import { appHref } from "@/lib/app-links"
import { getCurrentUser, getWorkspaceContext, type WorkspaceContext } from "@/lib/auth"

export async function resolveWorkspace(workspaceSlug: string): Promise<WorkspaceContext> {
  const user = await getCurrentUser()
  if (!user) redirect(appHref(`/sign-in?next=/w/${workspaceSlug}`))
  const ctx = await getWorkspaceContext(workspaceSlug, user)
  if (!ctx) redirect(appHref("/app"))
  return ctx
}
