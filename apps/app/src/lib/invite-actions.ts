"use server"

import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"

export async function acceptInviteAction(input: {
  invitationId: string
  workspaceSlug: string
  email: string
  password: string
  displayName?: string
}) {
  if (!input.password || input.password.length < 8)
    return { error: "Password must be at least 8 characters." }
  const supabase = await createServerClient()
  if (!supabase) return { error: "Supabase is not configured." }
  const email = input.email.trim().toLowerCase()
  const { data: existingUser } = await supabase.auth.getUser()
  if (!existingUser.user) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: { data: { display_name: input.displayName || email.split("@")[0] } },
    })
    if (error) return { error: error.message }
    if (!data.session) return { error: "Confirm your email before accepting this invitation." }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password: input.password })
    if (error) return { error: error.message }
  }

  const { data: workspaceId, error } = await supabase.rpc("accept_invitation", {
    p_invitation_id: input.invitationId,
  })
  if (error || !workspaceId) return { error: error?.message ?? "Invitation is no longer valid." }
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single()
  if (!workspace || workspace.slug !== input.workspaceSlug)
    return { error: "Invalid invitation workspace." }
  redirect(`/w/${workspace.slug}`)
}
