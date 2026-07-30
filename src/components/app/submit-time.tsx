"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { submitTimeEntriesAction } from "@/lib/crm-actions";
import { toast } from "sonner";

export function SubmitTimeButton({
  workspaceSlug,
  ids,
  label = "Submit all",
}: {
  workspaceSlug: string;
  ids: string[];
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onSubmit() {
    if (ids.length === 0) return;
    setPending(true);
    try {
      const res = await submitTimeEntriesAction(workspaceSlug, ids);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Time submitted");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={onSubmit} disabled={pending || ids.length === 0}>
      {pending ? "Submitting…" : label}
    </Button>
  );
}
