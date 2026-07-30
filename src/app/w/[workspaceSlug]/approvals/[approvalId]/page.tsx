import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, Forbidden } from "@/components/app/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X } from "lucide-react";
import { humanStatus, classForStatus, formatDate, relativeTime, initials } from "@/lib/format";
import { ApprovalDecisionButtons } from "@/components/app/approval-decision";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; approvalId: string }>;
}) {
  const { workspaceSlug, approvalId } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "approvals.read")) return <Forbidden />;

  const approval = await db.approvalRequest.findFirst({
    where: { id: approvalId, workspaceId: ctx.workspaceId },
    include: {
      requestedBy: true,
      steps: { include: { user: true } },
      events: { include: { actorUser: true }, orderBy: { occurredAt: "asc" } },
    },
  });
  if (!approval) notFound();

  const isPending = approval.status === "pending";
  const canDecide = can(ctx, "approvals.decide");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href={`/w/${workspaceSlug}/approvals`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All approvals
      </Link>

      <div className="mb-6 border-b border-border/60 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{approval.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>v{approval.versionNumber}</span>
              <span>·</span>
              <span>{approval.entityType}</span>
              <span>·</span>
              <span>Requested by {approval.requestedBy?.displayName ?? "—"}</span>
              {approval.dueAt && (
                <>
                  <span>·</span>
                  <span>Due {formatDate(approval.dueAt)}</span>
                </>
              )}
            </div>
          </div>
          <Badge variant="outline" className={classForStatus(approval.status)}>{humanStatus(approval.status)}</Badge>
        </div>
        {approval.instructions && (
          <p className="mt-3 text-sm text-muted-foreground">{approval.instructions}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Approval steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {approval.steps.map((step, i) => (
                <div key={step.id} className="flex items-start gap-3 rounded-md border border-border/40 p-3">
                  <div className={`grid h-8 w-8 place-items-center rounded-full ${step.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : step.status === "changes_requested" ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" : step.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                    {step.status === "approved" ? <Check className="h-4 w-4" /> : step.status === "changes_requested" ? <X className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      Step {i + 1} · <span className="capitalize">{step.approverType.replace(/_/g, " ")}</span>
                    </div>
                    {step.user && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px]">{initials(step.user.displayName)}</AvatarFallback>
                        </Avatar>
                        {step.user.displayName}
                      </div>
                    )}
                    {step.decisionNote && (
                      <div className="mt-2 text-xs italic text-muted-foreground">&ldquo;{step.decisionNote}&rdquo;</div>
                    )}
                    {step.decidedAt && (
                      <div className="mt-1 text-xs text-muted-foreground">Decided {relativeTime(step.decidedAt)}</div>
                    )}
                  </div>
                  <Badge variant="outline" className={classForStatus(step.status)}>{humanStatus(step.status)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {isPending && canDecide && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Your decision</CardTitle>
              </CardHeader>
              <CardContent>
                <ApprovalDecisionButtons workspaceSlug={workspaceSlug} approvalId={approval.id} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Event log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {approval.events.map((e) => (
                <div key={e.id} className="flex items-start gap-2">
                  <span className="font-medium capitalize">{e.action.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">by {e.actorUser?.displayName ?? "system"}</span>
                  <span className="ml-auto text-muted-foreground">{relativeTime(e.occurredAt)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
