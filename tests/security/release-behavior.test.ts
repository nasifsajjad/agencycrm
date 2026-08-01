import { describe, expect, it } from "vitest"
import { runSqlBehavior } from "./sql-behavior"

/**
 * supabase/tests/release_behavior.sql existed since the deal-conversion work
 * but was referenced by no test and no package script, so it had never run in
 * any automated check. It covers the paths most likely to corrupt data or lose
 * work: atomic deal conversion, replay identity, outbox crash recovery and
 * dead-lettering, and authorization on the queue functions.
 */
describe("release behavior", () => {
  it("executes conversion, replay identity, and outbox lifecycle checks against Postgres", () => {
    const output = runSqlBehavior("supabase/tests/release_behavior.sql")
    // The script raises on any failed assertion, so reaching ROLLBACK means
    // every check inside it passed and nothing was left behind.
    expect(output).toContain("ROLLBACK")
  })
})
