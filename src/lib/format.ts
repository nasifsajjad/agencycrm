/**
 * Money utilities. Always operate on integer minor units (cents).
 * No floating-point arithmetic on monetary values.
 */

export function formatMoney(minor: bigint | number, currency = "USD"): string {
  const value = typeof minor === "bigint" ? Number(minor) : minor;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatMoneyShort(minor: bigint | number, currency = "USD"): string {
  const value = typeof minor === "bigint" ? Number(minor) : minor;
  if (Math.abs(value) >= 1_000_000) {
    return `${currency === "USD" ? "$" : ""}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${currency === "USD" ? "$" : ""}${(value / 1_000).toFixed(1)}K`;
  }
  return formatMoney(minor, currency);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDateTime(date: Date | string, timezone = "UTC"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(d);
}

export function formatDate(date: Date | string, timezone = "UTC"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: timezone,
  }).format(d);
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function classForStatus(status: string): string {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    prospect: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    at_risk: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    churned: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    new: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    qualified: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    converted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    disqualified: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    changes_requested: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    open: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    submitted: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    planning: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    on_hold: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    in_review: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  };
  return map[status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export function humanStatus(status: string): string {
  return status.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}
