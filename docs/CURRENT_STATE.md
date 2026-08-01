# AgencyOS — Current State

Updated 2026-08-02, after a takeover review of the interrupted production-readiness
run and ten remediation milestones. This records observed results. It is not a
release approval.

## Verdict: NOT READY for production. Ready for staging verification.

Everything below marked unverified is unverified because this pass had no Docker,
no Supabase CLI, and no provisioned project. That is the single largest gap and
it gates most of the rest.

## What was actually run

Executed in this environment, with results:

| Check                                         | Result                                                   |
| --------------------------------------------- | -------------------------------------------------------- |
| `pnpm install --frozen-lockfile`              | pass                                                     |
| `pnpm typecheck` (root + both apps)           | pass                                                     |
| `eslint .`                                    | pass, 0 problems                                         |
| `prettier --check`                            | pass (repo formatted; it previously failed on 250 files) |
| `vitest` unit + integration + non-DB security | pass, 93 tests                                           |
| `vitest` DB-backed security                   | **fail — no Docker**, by design                          |
| `apps/web` production build                   | pass, 18 routes                                          |
| `apps/app` production build                   | pass, 41 routes                                          |
| `playwright` e2e                              | **not run** — needs both dev servers and a database      |

## Not verified, and why

- **No migration has been executed.** Migrations 0021–0025 were written in this
  pass and none has been applied to any database. The chain has been read
  end-to-end for ordering, forward references, duplicate objects and
  in-transaction enum use, and no problem was found statically — but static
  reading is not a reset. `supabase db reset` from empty is the first thing to
  do next.
- **No RLS test has been executed.** `supabase/tests/rls_behavior.sql` and
  `release_behavior.sql` are now wired into the vitest suite, and both fail
  loudly without Docker rather than skipping.
- **No environment exists.** There is no Supabase project, no service-role key,
  no `CRON_SECRET`, no email provider. `.env.example` documents the full
  contract.
- **No deployment has been performed.**

## Fixed in this pass

Security, highest severity first:

1. **The `private` schema was exposed over PostgREST** (`config.toml`) while
   0006 granted `execute on all functions in schema private` to `authenticated`.
   That made `private.record_audit` — which trusts its `p_workspace_id` and
   skips the membership check its public wrapper exists to perform — callable by
   any logged-in user against any tenant, and `private.bootstrap_default_workspace`,
   which grants an active Owner membership from its arguments, directly callable.
   Migration 0021 revokes broadly, re-grants only the nine read-only predicates
   RLS needs, and removes the schema from the exposed list.
2. **`cleanup_expired_jobs` deleted export jobs across every tenant** with no
   workspace filter and no permission check, granted to `authenticated`. Now
   `service_role` only (0022).
3. **Dashboard widgets ignored dashboard ownership and visibility.** Any member
   could read, add to, and delete from another member's private dashboard. The
   delete action had no `workspaceId` filter in application code at all. Fixed in
   both layers (0022, `customization-actions.ts`).
4. **`comment_mentions` had RLS enabled and zero policies**, so @mentions could
   never be written or read; **`approval_steps` had no INSERT path**, so an
   approval request could never be given approvers (0025).

Correctness:

5. **The outbox stranded work silently.** A worker that died mid-batch left
   `locked_at` set forever, and those events were never retried, dead-lettered,
   or counted. `attempts` only incremented in application code, so a
   process-killing event never aged. "Dead letter" set `processed_at`, making
   permanent failure indistinguishable from success. Migration 0023 adds
   stale-lock reclaim, claim-time attempt counting, a real terminal state, and
   the persisted error.
6. **Deal-conversion replay returned the wrong records.** Only
   `converted_client_id` was persisted; project and task were re-derived as
   "earliest for this client", which is wrong whenever the client pre-existed or
   a second deal for the same company converted (0024).
7. **`formatMoney` lost precision.** It converted `bigint` to `Number` and
   divided by 100 in floating point, in a module whose header promises no
   floating-point arithmetic on money.
8. **`formatMoneyShort` overstated every abbreviated figure by 100x**, comparing
   minor-unit input against major-unit thresholds. `$15,000` rendered as `$1.5M`
   on the reports and dashboard pages.
9. **Password reset silently depended on a dashboard setting.**
   `resetPasswordForEmail` was called with no `redirectTo`, so the link went
   wherever the project's Site URL pointed. Both it and sign-up confirmation now
   pass an explicit callback URL.
10. **`bootstrapWorkspace` would have thrown on first use** — it called
    `db.$transaction`, which is an unconditional throw. The module had no
    importers and duplicated what `create_workspace` does in SQL. Removed.

Integrity of the checks themselves:

11. **The test suite tested code that ships nowhere.** vitest aliased `@` to the
    root `src/` tree, an orphaned pre-monorepo fork. Six of nine test files
    imported from it. The forks had diverged: the tested `isSafeRedirect` was a
    weaker implementation than the one that ships. Repointing surfaced defects 7
    and 8 immediately.
12. **`pnpm typecheck` checked almost nothing** — root `tsconfig.json` excluded
    `apps`, `packages` and `tests`.
13. **`apps/web`, the public marketing site, shipped the entire CRM** — 94 dead
    files including every server action and `lib/db.ts`, which exports the
    service-role database handles.
14. **There was no CI at all.** No `.github/` directory existed.

## Known gaps, unfixed and deliberate

- **Email delivery has no provider.** Invitations and password reset cannot
  complete end-to-end anywhere until one is configured. This is a product
  decision (`prd.md` §17), not an implementation gap.
- **`packages/auth`, `packages/validation`, `packages/ui` are empty shells** — a
  `package.json` each, declared as dependencies, imported by nothing. There is no
  shared schema-validation layer; server actions hand-parse form input.
- **Webhook SSRF has a TOCTOU window.** `delivery.ts` resolves DNS to check for
  private ranges, then `fetch` resolves again. Low priority: webhook targets are
  admin-configured, not user input.
- **Realtime, file binary upload, CSV import/export execution, the automation
  builder UI, custom-field editor UI and saved-view UI** remain unimplemented.

## Next steps, in order

1. `supabase start && supabase db reset` on an empty database. Apply 0001–0025.
   Expect to fix something; nothing here has been executed.
2. Run `pnpm test:security`. All three DB-backed suites must pass.
3. Run `pnpm test:e2e` against that local stack.
4. Provision a staging Supabase project; set every key in `.env.example`.
5. Configure an email provider, then verify invitation and password-reset flows
   end-to-end for the first time.
6. Deploy both apps, set `NEXT_PUBLIC_APP_URL` on `apps/web` to the deployed app
   origin, and confirm CI is green on `main`.
