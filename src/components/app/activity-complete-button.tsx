"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeActivityAction } from "@/lib/crm-actions";
import { toast } from "sonner";

export function ActivityCompleteButton({ workspaceSlug, id }: { workspaceSlug: string; id: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onComplete() {
    setPending(true);
    try {
      const res = await completeActivityAction(workspaceSlug, id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Marked complete");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={onComplete} disabled={pending} className="gap-1 text-xs">
      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
    </Button>
  );
}
