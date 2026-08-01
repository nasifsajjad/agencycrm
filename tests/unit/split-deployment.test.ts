import { describe, expect, it } from "vitest"
import {
  applicationUrl,
  getApplicationOrigin,
  safeRedirectPath,
} from "../../packages/config/src"

describe("split deployment URL configuration", () => {
  it("uses the safe localhost app origin by default", () => {
    expect(getApplicationOrigin(undefined)).toBe("http://localhost:3001")
  })

  it("normalizes a valid configured origin", () => {
    expect(getApplicationOrigin(" https://app.agencyos.example/ ")).toBe(
      "https://app.agencyos.example",
    )
    expect(applicationUrl("/sign-in")).toBe("http://localhost:3001/sign-in")
  })

  it("rejects malformed or non-origin application configuration", () => {
    for (const value of [
      "agencyos.example",
      "javascript:alert(1)",
      "ftp://app.agencyos.example",
      "https://user:pass@app.agencyos.example",
      "https://app.agencyos.example/base",
      "https://app.agencyos.example?next=/app",
    ]) {
      expect(() => getApplicationOrigin(value)).toThrow()
    }
  })

  it("generates authenticated-app URLs from the configured origin", () => {
    expect(applicationUrl("/sign-in?next=/w/northstar", "https://app.agencyos.example")).toBe(
      "https://app.agencyos.example/sign-in?next=/w/northstar",
    )
    expect(applicationUrl("/onboarding")).toBe("http://localhost:3001/onboarding")
  })
})

describe("safe application redirects", () => {
  it("keeps valid app-local paths and query strings", () => {
    expect(safeRedirectPath("/w/northstar?view=board")).toBe("/w/northstar?view=board")
    expect(safeRedirectPath("/app", "/fallback")).toBe("/app")
  })

  it("rejects schemes, protocol-relative URLs, external URLs, and malformed paths", () => {
    const fallback = "/app"
    for (const target of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//evil.example/app",
      "https://evil.example/app",
      "http://evil.example/app",
      "/\\\\evil.example/app",
      "/%2F%2Fevil.example/app",
      "/%ZZ",
      "/%3Ajavascript",
    ]) {
      expect(safeRedirectPath(target, fallback)).toBe(fallback)
    }
  })
})
