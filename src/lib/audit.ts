import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/auth";

export interface AuditInput {
  ctx: WorkspaceContext;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipHash?: string;
  userAgentSummary?: string;
}

export async function audit(input: AuditInput) {
  await db.auditEvent.create({
    data: {
      workspaceId: input.ctx.workspaceId,
      actorUserId: input.ctx.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: (input.before as any) ?? null,
      afterJson: (input.after as any) ?? null,
      ipHash: input.ipHash ?? null,
      userAgentSummary: input.userAgentSummary ?? null,
    },
  });
}

export async function listAuditEvents(workspaceId: string, opts?: { limit?: number; offset?: number; entityType?: string }) {
  return db.auditEvent.findMany({
    where: { workspaceId, entityType: opts?.entityType },
    orderBy: { occurredAt: "desc" },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
    include: { actorUser: { select: { id: true, email: true, displayName: true } } },
  });
}
