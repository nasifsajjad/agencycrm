import { redirect } from "next/navigation"
import { getCurrentUser, getUserMemberships } from "@/lib/auth"

/**
 * Entry point after sign-in: send the user wherever they should actually be.
 *
 * This previously read `memberships[0].workspace.slug` against a row shape
 * that exposed the join as `workspaces`, so it threw a TypeError and returned
 * a 500 to every user who had a workspace. getUserMemberships now normalises
 * the shape; this guards the remaining case where the workspace row could not
 * be read at all, so a bad join degrades to onboarding rather than a crash.
 */
export default async function AppEntry() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const memberships = await getUserMemberships(user.id)
  const slug = memberships.find((membership) => membership.workspace?.slug)?.workspace?.slug

  if (!slug) redirect("/onboarding")
  redirect(`/w/${slug}`)
}
