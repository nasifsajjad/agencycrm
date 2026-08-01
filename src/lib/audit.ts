import { db } from "@/lib/db"
import { createServerClient } from "@/lib/supabase/server"
import type { WorkspaceContext } from "@/lib/auth"

export interface AuditInput {
  ctx: WorkspaceContext
  action: string
  entityType: string
  entityId?: string
  before?: unknown
  after?: unknown
  ipHash?: string
  userAgentSummary?: string
}

export async function audit(input: AuditInput) {
  const supabase = await createServerClient()
  if (!supabase) throw new Error("Supabase is not configured")
  const { error } = await supabase.rpc("record_audit", {
    p_workspace_id: input.ctx.workspaceId,
    p_action: input.action,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId ?? null,
    p_before: input.before ?? null,
    p_after: input.after ?? null,
    p_ip_hash: input.ipHash ?? null,
    p_user_agent_summary: input.userAgentSummary ?? null,
  })
  if (error) throw error
}

export async function listAuditEvents(
  workspaceId: string,
  opts?: { limit?: number; offset?: number; entityType?: string }
) {
  return db.auditEvent.findMany({
    where: { workspaceId, entityType: opts?.entityType },
    orderBy: { occurredAt: "desc" },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
    include: { actorUser: { select: { id: true, email: true, displayName: true } } },
  })
}
