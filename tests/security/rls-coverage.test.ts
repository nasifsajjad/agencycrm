import { describe, expect, it } from "vitest"
import { runSqlBehavior } from "./sql-behavior"

describe("Supabase RLS behavior", () => {
  it("executes authenticated, anonymous, and service-role isolation checks against Postgres", () => {
    const output = runSqlBehavior("supabase/tests/rls_behavior.sql")
    // The script raises on any failed assertion, so reaching ROLLBACK means
    // every check inside it passed and nothing was left behind.
    expect(output).toContain("ROLLBACK")
  })
})
