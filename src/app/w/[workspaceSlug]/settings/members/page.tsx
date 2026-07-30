import { db } from "@/lib/db";
import { resolveWorkspace } from "@/lib/server";
import { can } from "@/lib/auth";
import { PageHeader, Forbidden } from "@/components/app/states";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InviteMemberDialog, RevokeInvitationButton, RemoveMemberButton } from "@/components/app/invite-member";
import { UserPlus } from "lucide-react";
import { formatDate, initials, relativeTime } from "@/lib/format";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await resolveWorkspace(workspaceSlug);
  if (!can(ctx, "members.read")) return <Forbidden />;

  const [memberships, invitations, roles] = await Promise.all([
    db.workspaceMembership.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: true, roles: { include: { role: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.invitation.findMany({
      where: { workspaceId: ctx.workspaceId, acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    db.role.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Members"
        description={`${memberships.length} active · ${invitations.length} pending invitations`}
        action={
          can(ctx, "members.invite") && (
            <InviteMemberDialog
              workspaceSlug={workspaceSlug}
              roles={roles.map((r) => ({ id: r.id, name: r.name }))}
              trigger={
                <Button size="sm">
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Invite member
                </Button>
              }
            />
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Member</th>
                <th className="px-4 py-2 text-left font-medium">Roles</th>
                <th className="px-4 py-2 text-left font-medium">Joined</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                {can(ctx, "members.remove") && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">{initials(m.user.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{m.user.displayName ?? m.user.email}</div>
                        <div className="text-xs text-muted-foreground">{m.user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {m.roles.map((r) => (
                        <Badge key={r.role.id} variant="outline" className="text-xs">{r.role.name}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(m.joinedAt)}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={m.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}>
                      {m.status}
                    </Badge>
                  </td>
                  {can(ctx, "members.remove") && (
                    <td className="px-4 py-2.5 text-right">
                      {m.status === "active" && !m.roles.some((r) => r.role.name === "Owner") && (
                        <RemoveMemberButton workspaceSlug={workspaceSlug} membershipId={m.id} memberName={m.user.displayName ?? m.user.email} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {invitations.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">Pending invitations</h2>
          <Card className="divide-y divide-border/40">
            {invitations.map((i) => (
              <div key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <div className="font-medium">{i.emailNormalized}</div>
                  <div className="text-xs text-muted-foreground">Expires {relativeTime(i.expiresAt)}</div>
                </div>
                {can(ctx, "members.invite") && (
                  <RevokeInvitationButton workspaceSlug={workspaceSlug} id={i.id} email={i.emailNormalized} />
                )}
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
