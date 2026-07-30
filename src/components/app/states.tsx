import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, Lock, Inbox, SearchX } from "lucide-react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <Card className="grid place-items-center border-dashed py-12 text-center">
      <Inbox className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && (
        action.href ? (
          <Button asChild size="sm" className="mt-4">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button size="sm" className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </Card>
  );
}

export function Forbidden({ message }: { message?: string }) {
  return (
    <Card className="grid place-items-center border-destructive/30 py-16 text-center">
      <Lock className="mb-3 h-8 w-8 text-destructive/60" />
      <p className="text-base font-semibold">Access denied</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {message ?? "You don't have permission to view this page. Contact a workspace admin if you believe this is an error."}
      </p>
    </Card>
  );
}

export function NotFound({ message }: { message?: string }) {
  return (
    <Card className="grid place-items-center py-16 text-center">
      <SearchX className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <p className="text-base font-semibold">Not found</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message ?? "We couldn't find what you were looking for."}</p>
    </Card>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <Card className="grid place-items-center border-destructive/30 py-12 text-center">
      <AlertCircle className="mb-3 h-8 w-8 text-destructive/60" />
      <p className="text-sm font-semibold">Something went wrong</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{message ?? "Please try again or contact support."}</p>
    </Card>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted/60" />
      ))}
    </div>
  );
}
