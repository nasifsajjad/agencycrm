import { redirect } from "next/navigation"
import { getCurrentUser, getUserMemberships } from "@/lib/auth"

export default async function AppEntry() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  const memberships = await getUserMemberships(user.id)
  if (memberships.length === 0) redirect("/onboarding")
  const first = memberships[0]
  redirect(`/w/${first.workspace.slug}`)
}
