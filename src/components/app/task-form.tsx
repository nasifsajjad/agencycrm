"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createTaskAction } from "@/lib/crm-actions";
import { toast } from "sonner";

export function TaskFormDialog({
  workspaceSlug,
  projects,
  statuses,
  members,
  defaultProjectId,
  trigger,
  defaultOpen,
}: {
  workspaceSlug: string;
  projects: { id: string; name: string }[];
  statuses: { id: string; name: string; category: string }[];
  members: { id: string; name: string }[];
  defaultProjectId?: string;
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
      const res = await createTaskAction(workspaceSlug, new FormData(e.currentTarget));
      if (res?.error) {
        setError(res.error);
        return;
      }
      toast.success("Task created");
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
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Task name *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="projectId">Project</Label>
            <select id="projectId" name="projectId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" defaultValue={defaultProjectId}>
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="statusId">Status</Label>
              <select id="statusId" name="statusId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" name="priority" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="normal">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="assigneeId">Assignee</Label>
              <select id="assigneeId" name="assigneeId" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">— Unassigned —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueAt">Due date</Label>
              <Input id="dueAt" name="dueAt" type="date" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estimateMinutes">Estimate (minutes)</Label>
            <Input id="estimateMinutes" name="estimateMinutes" type="number" min="0" defaultValue="0" />
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
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
