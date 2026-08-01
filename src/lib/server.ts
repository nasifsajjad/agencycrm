import { redirect } from "next/navigation"
import { getCurrentUser, getWorkspaceContext, type WorkspaceContext } from "@/lib/auth"

export async function resolveWorkspace(workspaceSlug: string): Promise<WorkspaceContext> {
  const user = await getCurrentUser()
  if (!user) redirect(`/sign-in?next=/w/${workspaceSlug}`)
  const ctx = await getWorkspaceContext(workspaceSlug, user)
  if (!ctx) redirect("/app")
  return ctx
}
