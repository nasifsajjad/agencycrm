/**
 * Offset pagination for list pages.
 *
 * Kept in @agencyos/domain rather than in the app so the parsing rules are
 * unit-testable without a database or a rendered page. Every value here comes
 * from a query string, which is attacker-controlled, so the parser must be
 * total: any input produces a valid, bounded result rather than throwing or
 * passing a hostile value through to the database.
 *
 * prd.md §11 requires every unbounded collection to be paginated. The list
 * pages previously used a hard `take: 100` with no page control and no
 * indication that anything had been truncated, so a workspace with 101
 * contacts simply could not reach the 101st.
 */

export const DEFAULT_PAGE_SIZE = 25

/**
 * Upper bound on rows per request. This is a denial-of-service control as much
 * as a UX one: `?pageSize=100000` must not turn into a 100k-row scan.
 */
export const MAX_PAGE_SIZE = 100

export type PageParams = {
  /** 1-based, for display and links. */
  page: number
  pageSize: number
  /** Offset for the database query. */
  skip: number
  /** Row limit for the database query. */
  take: number
}

export type PageInfo = PageParams & {
  total: number
  totalPages: number
  hasPrevious: boolean
  hasNext: boolean
  /** 1-based index of the first row on this page; 0 when there are no rows. */
  from: number
  /** 1-based index of the last row on this page; 0 when there are no rows. */
  to: number
}

/** A Next.js searchParams value: absent, single, or repeated. */
type SearchParamValue = string | string[] | undefined

function firstValue(value: SearchParamValue): string | undefined {
  // A repeated parameter (?page=2&page=9) arrives as an array. Take the first
  // rather than letting `Number(["2","9"])` collapse to NaN.
  if (Array.isArray(value)) return value[0]
  return value
}

function toPositiveInteger(value: SearchParamValue, fallback: number): number {
  const raw = firstValue(value)
  if (raw === undefined || raw.trim() === "") return fallback
  // Number() accepts "0x10", "1e3", " 12 " and "Infinity"; require plain digits.
  if (!/^\d+$/.test(raw.trim())) return fallback
  const parsed = Number(raw.trim())
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback
  return parsed
}

/**
 * Parses `?page=` and `?pageSize=` into database-ready bounds.
 *
 * Rejects rather than clamps for malformed input, so `?page=-1` and
 * `?page=abc` both land on page 1 instead of a surprising offset. Oversized
 * page sizes are clamped to MAX_PAGE_SIZE rather than rejected, because a
 * caller asking for more than the maximum still wants the largest page
 * available.
 */
export function parsePageParams(
  searchParams: { page?: SearchParamValue; pageSize?: SearchParamValue } = {},
  options: { defaultPageSize?: number; maxPageSize?: number } = {}
): PageParams {
  const maxPageSize = Math.max(1, options.maxPageSize ?? MAX_PAGE_SIZE)
  const defaultPageSize = Math.min(
    Math.max(1, options.defaultPageSize ?? DEFAULT_PAGE_SIZE),
    maxPageSize
  )

  const page = toPositiveInteger(searchParams.page, 1)
  const requestedPageSize = toPositiveInteger(searchParams.pageSize, defaultPageSize)
  const pageSize = Math.min(requestedPageSize, maxPageSize)

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

/**
 * Combines the requested page with the total row count.
 *
 * When `page` overshoots the data — a stale link, or rows deleted since the
 * link was made — `hasNext` is false and `from`/`to` are zero, so the page
 * renders an empty state with working "previous" navigation rather than
 * claiming to show "rows 201–225 of 12".
 */
export function buildPageInfo(params: PageParams, total: number): PageInfo {
  const safeTotal = Number.isSafeInteger(total) && total > 0 ? total : 0
  const totalPages = Math.max(1, Math.ceil(safeTotal / params.pageSize))
  const rowsOnPage = Math.max(0, Math.min(params.pageSize, safeTotal - params.skip))

  return {
    ...params,
    total: safeTotal,
    totalPages,
    hasPrevious: params.page > 1,
    hasNext: params.skip + rowsOnPage < safeTotal,
    from: rowsOnPage === 0 ? 0 : params.skip + 1,
    to: rowsOnPage === 0 ? 0 : params.skip + rowsOnPage,
  }
}

/**
 * Builds the href for another page, preserving every other query parameter so
 * filters and search terms survive navigation.
 */
export function pageHref(
  basePath: string,
  currentParams: Record<string, SearchParamValue>,
  page: number
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(currentParams)) {
    if (key === "page") continue
    const single = firstValue(value)
    if (single === undefined || single === "") continue
    query.set(key, single)
  }
  if (page > 1) query.set("page", String(page))
  const queryString = query.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}
