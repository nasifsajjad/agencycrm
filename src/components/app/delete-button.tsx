"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DeleteActionButton({
  actionName,
  args,
  label,
}: {
  actionName: string;
  args: any[];
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function onConfirm() {
    setPending(true);
    try {
      // Dynamically import the action by name
      const mod = await import("@/lib/crm-actions");
      const fn = (mod as any)[actionName];
      if (!fn) throw new Error(`Unknown action: ${actionName}`);
      const res = await fn(...args);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Deleted");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="h-7 w-7">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {label}. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
