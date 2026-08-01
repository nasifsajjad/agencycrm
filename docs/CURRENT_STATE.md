# AgencyOS — Current State

Updated 2026-08-01 after a source-level and real-local-Supabase audit.

## Verified

- The repository is a pnpm workspace with `apps/web`, `apps/app`, and shared packages, but the product runtime is still the root `src/` Next application. The two workspace apps are package manifests only; they are not separately deployable product applications.
- The root runtime still uses Prisma with the SQLite schema and custom bcrypt/JWT sessions for nearly all product actions. `@supabase/ssr` client factories exist, but do not provide a working production data/auth adapter. Setting Supabase credentials therefore does **not** activate a functional Supabase production path.
- All nine SQL migrations now apply to a clean isolated Supabase PostgreSQL 17.4 database with Supabase Auth and Storage schemas. The successful run created 80 public tables.
- `supabase/tests/rls_behavior.sql` executes against real `authenticated`/`anon` roles with `request.jwt.claim.sub`: owner access succeeds; a second workspace owner cannot SELECT the first workspace or its contact; cross-workspace INSERT is denied by `WITH CHECK`; anonymous SELECT is denied.

## Repairs made during the audit

- Fixed the `visibility` enum so saved views/dashboards (`private`/`workspace`) can be created.
- Corrected profile RLS to use `profiles.user_id`, not the nonexistent `id` column.
- Corrected invalid multi-clause RLS policy syntax for comments, activity events, and knowledge pages.
- Granted authenticated users table privileges; RLS policies were previously unreachable because PostgreSQL rejected access before policy evaluation.
- Made Storage bucket creation compatible with supported local Storage schema revisions and made object-path UUID parsing safe. Avatar owner access now works as documented.
- Fixed `create_workspace`: invalid `regexp_match` boolean use and a multi-row `RETURNING ... INTO` failure in role bootstrap.
- Added immutable workspace-owner enforcement and executable behavioral RLS coverage.

## Production readiness

**Not ready to deploy.** The SQL/RLS layer now has fresh-database and core behavioral evidence, but the application remains SQLite/Prisma-backed and the Supabase Auth/Storage adapter is incomplete. Invitations, portal isolation, reports, exports, notifications, signed-file access, client/contractor/suspension cases, and Storage policies still need end-to-end behavioral tests against the real Supabase application path. Existing Vitest security tests inspect SQLite application behavior or SQL text and are not sufficient evidence for those claims.

The required release architecture remains pnpm/Turborepo, separate `apps/web` and `apps/app`, Next.js, Supabase Postgres/Auth (`@supabase/ssr`)/Storage with database RLS, and Vercel. Prisma/SQLite must be removed from the production request path before deployment.

## Audit commands and results

```bash
# isolated Docker-backed Supabase PostgreSQL 17.4
docker exec … psql … -f supabase/migrations/0001_extensions_schemas.sql  # through 0009: pass
docker exec … psql … -f supabase/tests/rls_behavior.sql                  # pass (transaction rolls back)
```

Fresh pnpm installation could not complete in this environment because the shell defaults to Node 12 while the project requires Node >=20; the pinned Node 24 runtime was used for tooling, but the package install process was interrupted before creating `node_modules`/`pnpm-lock.yaml`. No application lint, TypeScript, Vitest, Playwright, or Next production-build result is claimed from this audit.
