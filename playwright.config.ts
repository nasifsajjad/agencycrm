import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // In CI the apps are built first and served with `next start`. Dev mode
  // compiles each route on first request, so a cold run routinely exceeds the
  // start timeout and then times out again per navigation — flake that looks
  // like a product failure. Locally, dev stays the default so `pnpm test:e2e`
  // needs no build step.
  webServer: [
    {
      command: process.env.CI
        ? "pnpm --filter @agencyos/web start"
        : "pnpm --filter @agencyos/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { NEXT_PUBLIC_APP_URL: "http://localhost:3001" },
    },
    {
      command: process.env.CI
        ? "pnpm --filter @agencyos/app start"
        : "pnpm --filter @agencyos/app dev",
      url: "http://localhost:3001/sign-in",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { NEXT_PUBLIC_APP_URL: "http://localhost:3001" },
    },
  ],
})
