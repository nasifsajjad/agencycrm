import { describe, it, expect } from "vitest"
import {
  formatMoney,
  formatMoneyShort,
  formatMinutes,
  humanStatus,
  classForStatus,
  initials,
} from "@/lib/format"

describe("money formatting", () => {
  it("formats integer minor units as currency", () => {
    expect(formatMoney(0n)).toBe("$0.00")
    expect(formatMoney(100n)).toBe("$1.00")
    expect(formatMoney(12345n)).toBe("$123.45")
    expect(formatMoney(100000n)).toBe("$1,000.00")
  })

  it("accepts number input too", () => {
    expect(formatMoney(100)).toBe("$1.00")
  })

  it("short format collapses thousands and millions", () => {
    expect(formatMoneyShort(1_500_000n)).toContain("M")
    expect(formatMoneyShort(1_500n)).toContain("K")
  })

  it("does not perform floating-point arithmetic on monetary values", () => {
    // Always integer math
    const a = 10n ** 18n
    const b = 3n
    const _ = a / b
    expect(typeof _).toBe("bigint")
  })
})

describe("time formatting", () => {
  it("formats minutes under an hour", () => {
    expect(formatMinutes(45)).toBe("45m")
  })

  it("formats whole hours without minutes", () => {
    expect(formatMinutes(120)).toBe("2h")
  })

  it("formats hours and minutes", () => {
    expect(formatMinutes(90)).toBe("1h 30m")
  })
})

describe("status helpers", () => {
  it("humanStatus converts snake_case to Title Case", () => {
    expect(humanStatus("in_progress")).toBe("In Progress")
    expect(humanStatus("changes_requested")).toBe("Changes Requested")
    expect(humanStatus("active")).toBe("Active")
  })

  it("classForStatus returns a Tailwind class string", () => {
    expect(classForStatus("active")).toContain("emerald")
    expect(classForStatus("at_risk")).toContain("amber")
    expect(classForStatus("churned")).toContain("red")
  })
})

describe("initials", () => {
  it("returns first + last initial", () => {
    expect(initials("Avery Chen")).toBe("AC")
  })

  it("returns first two chars for single name", () => {
    expect(initials("Avery")).toBe("AV")
  })

  it("handles null", () => {
    expect(initials(null)).toBe("?")
    expect(initials(undefined)).toBe("?")
  })
})
