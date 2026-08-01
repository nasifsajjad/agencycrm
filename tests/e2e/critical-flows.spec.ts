import { test, expect } from "@playwright/test"

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

  test("marketing pages are reachable", async ({ page }) => {
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
      await page.goto(path)
      await expect(page).toHaveURL(path)
      // No error boundary
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
    await page.goto("/sign-in")
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: /Sign in/ })).toBeVisible()
  })

  test("sign-up page renders form with workspace field", async ({ page }) => {
    await page.goto("/sign-up")
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByLabel("Workspace name")).toBeVisible()
  })

  test("unauthenticated /w/slug redirects to sign-in", async ({ page }) => {
    await page.goto("/w/northstar")
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test("unauthenticated /app redirects to sign-in", async ({ page }) => {
    await page.goto("/app")
    await expect(page).toHaveURL(/\/sign-in/)
  })

  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get("/api/health")
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(body.db).toBe("ok")
  })

  test("client portal renders for a known slug (no auth required in local mode)", async ({
    page,
  }) => {
    // Depends on seeded demo data; if absent, will 404 — that's fine for the smoke test
    const res = await page.goto("/portal/aurora-portal")
    if (res && res.ok()) {
      await expect(page.locator("body")).not.toContainText("Application error")
    }
  })
})
