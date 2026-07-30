"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createDealAction } from "@/lib/crm-actions";
import { toast } from "sonner";

export function DealFormDialog({
  workspaceSlug,
  stages,
  companies,
  contacts,
  trigger,
  defaultOpen,
}: {
  workspaceSlug: string;
  stages: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  contacts: { id: string; firstName: string | null; lastName: string | null; email: string | null }[];
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
      const res = await createDealAction(workspaceSlug, new FormData(e.currentTarget));
      if (res?.error) {
        setError(res.error);
        return;
      }
      toast.success("Deal created");
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
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Deal name *</Label>
            <Input id="name" name="name" placeholder="Acme — Q4 campaign" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input id="amount" name="amount" type="number" min="0" step="0.01" defaultValue="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stageId">Stage</Label>
              <select id="stageId" name="stageId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                {stages.map((s, i) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="companyId">Company</Label>
              <select id="companyId" name="companyId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">— None —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="primaryContactId">Primary contact</Label>
              <select id="primaryContactId" name="primaryContactId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">— None —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName} {c.email ? `(${c.email})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expectedCloseDate">Expected close date</Label>
            <Input id="expectedCloseDate" name="expectedCloseDate" type="date" />
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
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create deal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
