import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { pageHref, type PageInfo } from "@agencyos/domain"
import { cn } from "@/lib/utils"

type SearchParamValue = string | string[] | undefined

/**
 * List pagination control.
 *
 * A server component built from links rather than a client component with
 * handlers: the page is a URL, so it is shareable, back-button friendly, and
 * costs no JavaScript. Filters survive navigation because pageHref carries
 * every other query parameter through.
 */
export function Pagination({
  info,
  basePath,
  searchParams,
  label = "results",
  className,
}: {
  info: PageInfo
  basePath: string
  searchParams: Record<string, SearchParamValue>
  /** Plural noun for the summary line, e.g. "contacts". */
  label?: string
  className?: string
}) {
  // One page and nothing truncated: a control here would be noise. The summary
  // still renders below when there is anything at all to describe.
  if (!info.hasPrevious && !info.hasNext && info.total <= info.pageSize) {
    if (info.total === 0) return null
    return (
      <p className={cn("px-1 py-3 text-xs text-muted-foreground", className)}>
        {info.total} {label}
      </p>
    )
  }

  return (
    <nav
      className={cn(
        "flex flex-col gap-3 border-t border-border/60 px-1 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      aria-label="Pagination"
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {info.total === 0 ? (
          <>No {label}</>
        ) : info.from === 0 ? (
          // The requested page is past the end of the data — a stale link, or
          // rows removed since it was made.
          <>
            Page {info.page} is empty — {info.total} {label} in total
          </>
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{info.from}</span>–
            <span className="font-medium text-foreground">{info.to}</span> of{" "}
            <span className="font-medium text-foreground">{info.total}</span> {label}
          </>
        )}
      </p>

      <div className="flex items-center gap-1">
        <PageLink
          href={pageHref(basePath, searchParams, info.page - 1)}
          disabled={!info.hasPrevious}
          rel="prev"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>Previous</span>
        </PageLink>

        <span className="px-2 text-xs text-muted-foreground tabular-nums">
          {info.page} / {info.totalPages}
        </span>

        <PageLink
          href={pageHref(basePath, searchParams, info.page + 1)}
          disabled={!info.hasNext}
          rel="next"
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </PageLink>
      </div>
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  rel,
  children,
}: {
  href: string
  disabled: boolean
  rel: "prev" | "next"
  children: React.ReactNode
}) {
  const classes =
    "inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2.5 text-xs font-medium transition-colors"

  // Render the unavailable direction as a span, not a disabled link. An anchor
  // with aria-disabled is still focusable and still navigable by keyboard.
  if (disabled) {
    return (
      <span
        className={cn(classes, "cursor-not-allowed text-muted-foreground/50")}
        aria-hidden="true"
      >
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      rel={rel}
      className={cn(classes, "hover:bg-accent hover:text-accent-foreground")}
    >
      {children}
    </Link>
  )
}
