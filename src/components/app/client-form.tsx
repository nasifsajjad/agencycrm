"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClientAction } from "@/lib/crm-actions";
import { toast } from "sonner";

export function ClientFormDialog({
  workspaceSlug,
  companies,
  trigger,
  defaultOpen,
}: {
  workspaceSlug: string;
  companies: { id: string; name: string }[];
  trigger: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen ?? false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await createClientAction(workspaceSlug, new FormData(e.currentTarget));
      if (res?.error) {
        setError(res.error);
        return;
      }
      toast.success("Client created");
      setOpen(false);
      router.refresh();
      (e.target as HTMLFormElement).reset();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Client name *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="ACME" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="prospect">Prospect</option>
                <option value="active">Active</option>
                <option value="at_risk">At risk</option>
                <option value="churned">Churned</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="companyId">Linked company</Label>
            <select id="companyId" name="companyId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">— None —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create client"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
