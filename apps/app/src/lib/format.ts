/**
 * Money utilities. Always operate on integer minor units (cents).
 * No floating-point arithmetic on monetary values.
 */

/** Minor units per major unit. Two-decimal currencies only for now. */
const MINOR_PER_MAJOR = 100n

/** One thousand and one million major units, expressed in minor units. */
const THOUSAND_MINOR = 1_000n * MINOR_PER_MAJOR
const MILLION_MINOR = 1_000_000n * MINOR_PER_MAJOR

function toMinor(minor: bigint | number): bigint {
  if (typeof minor === "bigint") return minor
  if (!Number.isInteger(minor)) {
    throw new TypeError("Monetary values must be integer minor units")
  }
  return BigInt(minor)
}

/**
 * Exact decimal string for a minor-unit amount, e.g. 90071992547409093n ->
 * "900719925474090.93". Built with integer arithmetic so values beyond
 * Number.MAX_SAFE_INTEGER keep every cent.
 */
function minorToDecimalString(minor: bigint): string {
  const negative = minor < 0n
  const absolute = negative ? -minor : minor
  const major = absolute / MINOR_PER_MAJOR
  const cents = absolute % MINOR_PER_MAJOR
  return `${negative ? "-" : ""}${major}.${cents.toString().padStart(2, "0")}`
}

export function formatMoney(minor: bigint | number, currency = "USD"): string {
  // Intl.NumberFormat accepts a decimal string and formats it at arbitrary
  // precision. Passing a Number here would silently round anything above
  // 2^53 cents, which is exactly what this module promises not to do.
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorToDecimalString(toMinor(minor)) as unknown as number)
}

/**
 * Abbreviated form for dashboard tiles. Thresholds are compared in minor
 * units: 1,500,000 minor units is $15,000, so it abbreviates to "$15.0K",
 * not "$1.5M". The previous implementation compared minor units against
 * major-unit thresholds and overstated every abbreviated figure by 100x.
 */
export function formatMoneyShort(minor: bigint | number, currency = "USD"): string {
  const value = toMinor(minor)
  const absolute = value < 0n ? -value : value
  const prefix = currency === "USD" ? "$" : ""
  const sign = value < 0n ? "-" : ""

  if (absolute >= MILLION_MINOR) {
    return `${sign}${prefix}${scaleToOneDecimal(absolute, MILLION_MINOR)}M`
  }
  if (absolute >= THOUSAND_MINOR) {
    return `${sign}${prefix}${scaleToOneDecimal(absolute, THOUSAND_MINOR)}K`
  }
  return formatMoney(value, currency)
}

/** absolute / divisor to one decimal place, rounded half-up, without floats. */
function scaleToOneDecimal(absolute: bigint, divisor: bigint): string {
  const tenths = (absolute * 10n + divisor / 2n) / divisor
  return `${tenths / 10n}.${tenths % 10n}`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatDateTime(date: Date | string, timezone = "UTC"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(d)
}

export function formatDate(date: Date | string, timezone = "UTC"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: timezone,
  }).format(d)
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function initials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
  }
  return map[status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
}

export function humanStatus(status: string): string {
  return status
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")
}
