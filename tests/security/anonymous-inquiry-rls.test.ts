import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_agencyos-local"

describe("public inquiry RLS behavior", () => {
  it("allows anonymous submission but not reading, while service role can process submissions", () => {
    const sql = `
      begin;
      set local role anon;
      insert into public.marketing_inquiries (kind, first_name, last_name, email, agency, message)
      values ('contact', 'Anon', 'Sender', 'anon-sender@example.test', 'Test Agency', 'Need a demo');
      do $$ begin
        begin
          perform 1 from public.marketing_inquiries;
          raise exception 'anon read unexpectedly succeeded';
        exception when insufficient_privilege then null;
        end;
      end $$;
      reset role;
      set local role service_role;
      do $$ begin
        if not exists (select 1 from public.marketing_inquiries where email = 'anon-sender@example.test') then
          raise exception 'service role could not read submitted inquiry';
        end if;
      end $$;
      rollback;
    `
    const output = execFileSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
      { encoding: "utf8", input: sql, stdio: ["pipe", "pipe", "pipe"] }
    )
    expect(output).toContain("ROLLBACK")
  })
})
