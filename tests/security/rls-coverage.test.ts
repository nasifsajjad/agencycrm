import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_agencyos-local"
const script = readFileSync(join(__dirname, "../../supabase/tests/rls_behavior.sql"), "utf8")

describe("Supabase RLS behavior", () => {
  it("executes authenticated, anonymous, and service-role isolation checks against Postgres", () => {
    const output = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { encoding: "utf8", input: script, stdio: ["pipe", "pipe", "pipe"] }
    )
    expect(output).toContain("ROLLBACK")
  })
})
