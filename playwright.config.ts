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
  webServer: [
    {
      command: "pnpm --filter @agencyos/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60_000,
      env: { NEXT_PUBLIC_APP_URL: "http://localhost:3001" },
    },
    {
      command: "pnpm --filter @agencyos/app dev",
      url: "http://localhost:3001/sign-in",
      reuseExistingServer: true,
      timeout: 60_000,
      env: { NEXT_PUBLIC_APP_URL: "http://localhost:3001" },
    },
  ],
})
