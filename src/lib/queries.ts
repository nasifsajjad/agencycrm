import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/auth";
import { formatMoney, formatMinutes, humanStatus, classForStatus } from "@/lib/format";

export async function getDashboardMetrics(ctx: WorkspaceContext) {
  const [deals, clients, approvals, timeEntries, projects] = await Promise.all([
    db.deal.findMany({
      where: { workspaceId: ctx.workspaceId, stage: { isClosed: false } },
      include: { stage: true, owner: true },
    }),
    db.client.findMany({
      where: { workspaceId: ctx.workspaceId, status: { in: ["active", "at_risk"] } },
    }),
    db.approvalRequest.findMany({
      where: { workspaceId: ctx.workspaceId, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.timeEntry.findMany({
      where: { workspaceId: ctx.workspaceId, status: "approved", billable: true },
      select: { minutes: true, rateMinor: true },
    }),
    db.project.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { client: true, status: true, owner: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const pipelineValue = deals.reduce((sum, d) => sum + d.amountMinor, 0n);
  const weightedPipeline = deals.reduce((sum, d) => sum + (d.amountMinor * BigInt(d.probability)) / 100n, 0n);
  const activeClients = clients.length;
  const atRiskClients = clients.filter((c) => c.status === "at_risk").length;
  const pendingApprovals = approvals.length;
  const billableMinutes = timeEntries.reduce((sum, t) => sum + t.minutes, 0);
  const recognizedRevenue = timeEntries.reduce((sum, t) => sum + t.rateMinor * BigInt(t.minutes) / 60n, 0n);

  return {
    pipelineValue,
    weightedPipeline,
    activeClients,
    atRiskClients,
    pendingApprovals,
    billableMinutes,
    recognizedRevenue,
    deals,
    clients,
    approvals,
    projects,
  };
}

export async function getNotifications(ctx: WorkspaceContext, limit = 20) {
  return db.notification.findMany({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export { formatMoney, formatMinutes, humanStatus, classForStatus };
