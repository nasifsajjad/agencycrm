import { test, expect } from "@playwright/test"

const appOrigin = process.env.PLAYWRIGHT_APP_URL ?? "http://localhost:3001"

function appPath(path: string): string {
  return `${appOrigin}${path}`
}

test.describe("AgencyOS critical flows", () => {
  test("homepage renders with hero, capabilities, and footer", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/AgencyOS/)
    await expect(page.locator("h1")).toContainText(/operating system for/)
    await expect(page.getByRole("link", { name: /Start free/ }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
    // Footer
    await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Terms" })).toBeVisible()
  })

  test("marketing pages render real content, not just an absent error boundary", async ({
    page,
  }) => {
    for (const path of [
      "/product",
      "/features",
      "/pricing",
      "/security",
      "/about",
      "/contact",
      "/book-demo",
      "/templates",
      "/docs",
      "/privacy",
      "/terms",
    ]) {
      const res = await page.goto(path)
      // `not.toContainText("Application error")` passes on a blank page, a 404,
      // and a 500 alike. Assert the page actually served and rendered.
      expect(res?.status(), `${path} should return 2xx`).toBeLessThan(400)
      await expect(page).toHaveURL(path)
      await expect(page.locator("h1")).toBeVisible()
      await expect(page.locator("body")).not.toContainText("Application error")
    }
  })

  test("solutions dynamic route renders", async ({ page }) => {
    await page.goto("/solutions/agencies")
    await expect(page.locator("h1")).toContainText(/full-service agencies/i)
    await page.goto("/solutions/creative")
    await expect(page.locator("h1")).toContainText(/creative teams/i)
    await page.goto("/solutions/performance-marketing")
    await expect(page.locator("h1")).toContainText(/performance marketing teams/i)
  })

  test("sign-in page renders form", async ({ page }) => {
    await page.goto(appPath("/sign-in"))
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: /Sign in/ })).toBeVisible()
  })

  test("sign-up page renders form with workspace field", async ({ page }) => {
    await page.goto(appPath("/sign-up"))
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByLabel("Workspace name")).toBeVisible()
  })

  test("unauthenticated /w/slug redirects to sign-in", async ({ page }) => {
    await page.goto(appPath("/w/northstar"))
    await expect(page).toHaveURL(/:3001\/sign-in/)
  })

  test("unauthenticated /app redirects to sign-in", async ({ page }) => {
    await page.goto(appPath("/app"))
    await expect(page).toHaveURL(/:3001\/sign-in/)
  })

  test("the app domain root is not a dead end", async ({ page }) => {
    // This returned a bare 404 in production: apps/app had no `/` route at
    // all, so the front door of the authenticated product was a Next error
    // page. Signed out, the root must land on sign-in.
    await page.goto(appPath("/"))
    await expect(page).toHaveURL(/:3001\/sign-in/)
    await expect(page.getByLabel("Email")).toBeVisible()
  })

  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get(appPath("/api/health"))
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(body.db).toBe("ok")
  })

  test("client portal does not expose client data to an anonymous visitor", async ({ page }) => {
    const res = await page.goto(appPath("/portal/aurora-portal"))
    expect(res).not.toBeNull()

    // The original assertion here was only `not.toContainText("Application
    // error")`, which a fully-rendered portal leaking every client record
    // would also satisfy. Assert the actual security property: an anonymous
    // visitor is either bounced to sign-in or shown a not-found, and in no
    // case sees portal contents.
    const url = page.url()
    const status = res!.status()
    expect(
      /\/sign-in/.test(url) || status === 404 || status === 403,
      `anonymous portal visit should be denied, got ${status} at ${url}`
    ).toBeTruthy()

    if (!/\/sign-in/.test(url)) {
      const body = page.locator("body")
      await expect(body).not.toContainText(/Projects/i)
      await expect(body).not.toContainText(/Approvals/i)
      await expect(body).not.toContainText(/Files/i)
    }
  })

  test("password reset request always answers the same way", async ({ page }) => {
    // The response must not differ between a known and an unknown address, or
    // the form becomes an account-enumeration oracle.
    await page.goto(appPath("/forgot-password"))
    await page.getByLabel("Email").fill("definitely-not-a-user@example.invalid")
    await page.getByRole("button", { name: /Send reset link/i }).click()
    await expect(page.locator("body")).toContainText(/reset link is on its way/i)
  })

  test("sign-in offers magic link as well as password", async ({ page }) => {
    await page.goto(appPath("/sign-in"))
    await expect(page.getByRole("button", { name: /Email me a sign-in link/i })).toBeVisible()
  })

  test("auth callback rejects a request with no code", async ({ request }) => {
    const res = await request.get(appPath("/auth/callback"), { maxRedirects: 0 })
    expect(res.status()).toBeGreaterThanOrEqual(300)
    expect(res.status()).toBeLessThan(400)
    expect(res.headers()["location"]).toContain("/sign-in")
  })

  test("open-redirect attempts through the sign-in next parameter are refused", async ({
    page,
  }) => {
    for (const hostile of [
      "//evil.example",
      "https://evil.example",
      "/%2f%2fevil.example",
      "/\\evil.example",
    ]) {
      await page.goto(appPath(`/sign-in?next=${encodeURIComponent(hostile)}`))
      // Whatever happens, the user must still be on this origin.
      expect(page.url().startsWith(appOrigin)).toBeTruthy()
      await expect(page.getByLabel("Email")).toBeVisible()
    }
  })
})
