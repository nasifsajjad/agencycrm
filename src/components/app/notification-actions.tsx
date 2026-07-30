"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, CheckCheck } from "lucide-react";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/crm-actions";
import { toast } from "sonner";

export function MarkReadButton({ workspaceSlug, id }: { workspaceSlug: string; id: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await markNotificationReadAction(workspaceSlug, id);
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <Check className="h-3 w-3" /> Mark read
    </Button>
  );
}

export function MarkAllReadButton({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await markAllNotificationsReadAction(workspaceSlug);
          toast.success("All marked read");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      <CheckCheck className="h-3 w-3" /> Mark all read
    </Button>
  );
}
