"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { acceptInviteAction } from "@/lib/invite-actions";
import { toast } from "sonner";

export function AcceptInviteForm({
  invitationId,
  workspaceSlug,
  email,
  roles,
}: {
  invitationId: string;
  workspaceSlug: string;
  email: string;
  roles: { id: string; name: string }[];
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await acceptInviteAction({
        invitationId,
        workspaceSlug,
        email,
        password: String(formData.get("password") ?? ""),
        displayName: String(formData.get("displayName") ?? "").trim() || undefined,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      toast.success("Invitation accepted");
    } catch (e: any) {
      if (e?.digest?.startsWith("NEXT_REDIRECT")) return;
      setError(e?.message ?? "Failed to accept invitation");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Signing in as <strong>{email}</strong></p>
        <p className="mt-1 text-xs text-muted-foreground">Roles: {roles.map((r) => r.name).join(", ")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Display name (optional)</Label>
        <Input id="displayName" name="displayName" placeholder="Avery Chen" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Set a password *</Label>
        <Input id="password" name="password" type="password" required minLength={8} placeholder="At least 8 characters" />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Accepting…" : "Accept & continue"}
      </Button>
    </form>
  );
}
