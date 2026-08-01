import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_agencyos-local"

/**
 * Runs a behavioural SQL script against the local Supabase Postgres container.
 *
 * These tests deliberately FAIL rather than skip when Docker or the container
 * is unavailable. A security test that silently skips reports green on a
 * machine that never checked anything, which is worse than having no test.
 * `pnpm supabase:start` first.
 */
export function runSqlBehavior(scriptRelativePath: string): string {
  const script = readFileSync(join(__dirname, "../..", scriptRelativePath), "utf8")
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { encoding: "utf8", input: script, stdio: ["pipe", "pipe", "pipe"] }
  )
}
