import { describe, expect, it } from "vitest"
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPageInfo,
  pageHref,
  parsePageParams,
} from "@agencyos/domain"

describe("parsePageParams", () => {
  it("defaults to the first page", () => {
    expect(parsePageParams()).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    })
  })

  it("converts a page number into a database offset", () => {
    const params = parsePageParams({ page: "3", pageSize: "20" })
    expect(params).toEqual({ page: 3, pageSize: 20, skip: 40, take: 20 })
  })

  it("clamps oversized page sizes rather than trusting the query string", () => {
    // A caller asking for more than the maximum still wants the largest page
    // available, so this clamps. The point is that the database never sees the
    // requested number.
    expect(parsePageParams({ pageSize: "100000" }).take).toBe(MAX_PAGE_SIZE)
    expect(parsePageParams({ pageSize: "101" }).take).toBe(MAX_PAGE_SIZE)
  })

  it("falls back to page 1 for malformed input instead of a surprising offset", () => {
    for (const page of ["0", "-1", "abc", "", " ", "1.5", "1e3", "0x10", "Infinity", "NaN"]) {
      expect(parsePageParams({ page }).page, `page=${JSON.stringify(page)}`).toBe(1)
      expect(parsePageParams({ page }).skip).toBe(0)
    }
  })

  it("falls back to the default page size for malformed sizes", () => {
    for (const pageSize of ["0", "-5", "abc", "1.5", "1e3"]) {
      expect(parsePageParams({ pageSize }).pageSize).toBe(DEFAULT_PAGE_SIZE)
    }
  })

  it("takes the first value when a parameter is repeated", () => {
    // ?page=2&page=9 arrives as an array; Number(["2","9"]) is NaN, which would
    // silently reset to page 1 and look like a bug to the user.
    expect(parsePageParams({ page: ["2", "9"] }).page).toBe(2)
    expect(parsePageParams({ page: [] }).page).toBe(1)
  })

  it("never produces a negative or unsafe offset", () => {
    for (const page of ["999999999999999999999", "9007199254740993"]) {
      const params = parsePageParams({ page })
      expect(params.skip).toBeGreaterThanOrEqual(0)
      expect(Number.isSafeInteger(params.skip)).toBe(true)
    }
  })

  it("honours a per-list default without exceeding the hard maximum", () => {
    expect(parsePageParams({}, { defaultPageSize: 10 }).pageSize).toBe(10)
    expect(parsePageParams({}, { defaultPageSize: 5000 }).pageSize).toBe(MAX_PAGE_SIZE)
  })
})

describe("buildPageInfo", () => {
  it("describes a middle page", () => {
    const info = buildPageInfo(parsePageParams({ page: "2", pageSize: "25" }), 120)
    expect(info).toMatchObject({
      total: 120,
      totalPages: 5,
      hasPrevious: true,
      hasNext: true,
      from: 26,
      to: 50,
    })
  })

  it("describes a final, partially filled page", () => {
    const info = buildPageInfo(parsePageParams({ page: "5", pageSize: "25" }), 110)
    expect(info).toMatchObject({ hasNext: false, from: 101, to: 110, totalPages: 5 })
  })

  it("reports an empty range when the page overshoots the data", () => {
    // A stale link, or rows deleted since it was made. This must not claim to
    // be showing "rows 201-225 of 12".
    const info = buildPageInfo(parsePageParams({ page: "9", pageSize: "25" }), 12)
    expect(info).toMatchObject({ from: 0, to: 0, hasNext: false, hasPrevious: true })
  })

  it("handles an empty collection", () => {
    const info = buildPageInfo(parsePageParams(), 0)
    expect(info).toMatchObject({ total: 0, totalPages: 1, hasNext: false, hasPrevious: false })
    expect(info.from).toBe(0)
  })

  it("treats a nonsensical count as zero rather than propagating it", () => {
    for (const total of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(buildPageInfo(parsePageParams(), total).total).toBe(0)
    }
  })
})

describe("pageHref", () => {
  it("preserves other query parameters so filters survive navigation", () => {
    const href = pageHref("/w/acme/crm/contacts", { q: "smith", page: "1" }, 3)
    expect(href).toBe("/w/acme/crm/contacts?q=smith&page=3")
  })

  it("omits page=1 to keep the canonical first-page URL clean", () => {
    expect(pageHref("/w/acme/crm/contacts", { q: "smith" }, 1)).toBe("/w/acme/crm/contacts?q=smith")
    expect(pageHref("/w/acme/crm/contacts", {}, 1)).toBe("/w/acme/crm/contacts")
  })

  it("drops empty parameters instead of emitting dangling keys", () => {
    expect(pageHref("/x", { q: "", tag: undefined }, 2)).toBe("/x?page=2")
  })

  it("encodes values", () => {
    expect(pageHref("/x", { q: "a&b=c" }, 2)).toBe("/x?q=a%26b%3Dc&page=2")
  })
})
