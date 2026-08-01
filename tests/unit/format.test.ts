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

  it("short format collapses thousands and millions using minor-unit thresholds", () => {
    // Input is minor units. 1_500_000 minor units is $15,000, so it must
    // abbreviate to K, not M. The previous assertion only checked that the
    // output contained "M", which let a 100x overstatement pass.
    expect(formatMoneyShort(1_500_000n)).toBe("$15.0K")
    expect(formatMoneyShort(150_000_000n)).toBe("$1.5M")
    expect(formatMoneyShort(100_000n)).toBe("$1.0K")
    expect(formatMoneyShort(-150_000_000n)).toBe("-$1.5M")
  })

  it("short format falls back to full currency below one thousand", () => {
    expect(formatMoneyShort(1_500n)).toBe("$15.00")
    expect(formatMoneyShort(0n)).toBe("$0.00")
  })

  it("does not lose precision on values beyond Number.MAX_SAFE_INTEGER", () => {
    // The previous version of this test divided two local bigint literals and
    // asserted the result was a bigint. It never called formatMoney, so it
    // proved nothing about this module. Exercise the real boundary instead:
    // a float-backed implementation cannot represent these cents exactly.
    const beyondFloatPrecision = 9_007_199_254_740_993n // 2^53 + 1
    expect(formatMoney(beyondFloatPrecision)).toBe("$90,071,992,547,409.93")

    // Adjacent values must not collapse onto the same output.
    expect(formatMoney(beyondFloatPrecision)).not.toBe(formatMoney(beyondFloatPrecision + 1n))
  })

  it("rounds half-cent inputs without floating-point drift", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point. In integer minor units the
    // equivalent addition must be exact.
    expect(formatMoney(10n + 20n)).toBe(formatMoney(30n))
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
