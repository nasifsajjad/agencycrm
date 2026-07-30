"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateLeadStatusAction } from "@/lib/crm-actions";
import { toast } from "sonner";

export function LeadStatusSelect({
  workspaceSlug,
  leadId,
  currentStatus,
}: {
  workspaceSlug: string;
  leadId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onChange(value: string) {
    setPending(true);
    try {
      const res = await updateLeadStatusAction(workspaceSlug, leadId, value);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Status updated");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Select defaultValue={currentStatus} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="new">New</SelectItem>
        <SelectItem value="qualified">Qualified</SelectItem>
        <SelectItem value="disqualified">Disqualified</SelectItem>
        <SelectItem value="converted">Converted</SelectItem>
      </SelectContent>
    </Select>
  );
}
