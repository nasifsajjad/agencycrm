// Vitest setup: load env, ensure DB schema
import { beforeAll } from "vitest"
import { execSync } from "node:child_process"

beforeAll(async () => {
  // Ensure DATABASE_URL is set for tests
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:/home/z/my-project/db/test.db"
  }
  // Push schema to test DB (idempotent)
  try {
    execSync("bun run db:push", {
      stdio: "ignore",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    })
  } catch {
    // Schema may already be in sync
  }
})
