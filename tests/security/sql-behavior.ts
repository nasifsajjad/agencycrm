import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Resolves the running local Supabase Postgres container.
 *
 * These tests previously hardcoded `supabase_db_agencyos-local`. Supabase names
 * the container `supabase_db_<project_id>`, and supabase/config.toml sets
 * project_id to "agencyos" — so that name has never existed, and every
 * DB-backed suite would have failed with "No such container" even with Docker
 * running and the stack up. Asking Docker removes the chance of the two
 * drifting again if project_id changes.
 */
function resolveContainer(): string {
  const configured = process.env.SUPABASE_DB_CONTAINER
  if (configured) return configured

  let names = ""
  try {
    names = execFileSync(
      "docker",
      ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
      { encoding: "utf8" }
    )
  } catch (error) {
    throw new Error(
      "Could not ask Docker for the Supabase container. Is Docker running? " +
        `Start the stack with \`pnpm supabase:start\`. (${(error as Error).message})`
    )
  }

  const first = names
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0]

  if (!first) {
    throw new Error(
      "No running supabase_db_* container. Run `pnpm supabase:start` before the security suites, " +
        "or set SUPABASE_DB_CONTAINER."
    )
  }
  return first
}

/**
 * Runs a behavioural SQL script against the local Supabase Postgres container.
 *
 * These tests deliberately FAIL rather than skip when Docker or the container
 * is unavailable. A security test that silently skips reports green on a
 * machine that never checked anything, which is worse than having no test.
 */
export function runSqlBehavior(scriptRelativePath: string): string {
  return runSql(readFileSync(join(__dirname, "../..", scriptRelativePath), "utf8"))
}

/** Runs an inline SQL script against the same container. */
export function runSql(script: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      resolveContainer(),
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
}
