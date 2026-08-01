# AgencyOS — Current State

Updated 2026-08-01 after adapter, portal, and conversion verification. This
document records observed results; it is not a release approval.

## Verdict: NOT READY

The repository is not ready for production. A deployable Supabase production
environment, its credentials, and a complete end-to-end verification are all
absent. More importantly, the application test suite does not cover the
critical behaviours it claims to cover.

## Verified locally

- Split-deployment contract repaired: `apps/web` now sends sign-in, sign-up,
  onboarding, demo-to-app, and authenticated-app links to the validated
  `NEXT_PUBLIC_APP_URL` origin. When unset, local development safely defaults to
  `http://localhost:3001`. `apps/app` owns the authentication and onboarding
  routes.
- Authentication redirect targets are accepted only as app-local paths.
  `javascript:`, `data:`, protocol-relative, malformed, backslash-based, and
  untrusted external targets fall back to `/` (or `/app` in the client form).
- Exact verification commands and outcomes:
  - `pnpm exec vitest run tests/unit --reporter=default` — PASS, 4 files and 29
    tests.
  - `pnpm lint` — PASS.
  - `pnpm --dir apps/web lint` — PASS.
  - `pnpm --dir apps/app lint` — PASS.
  - `pnpm --dir apps/web typecheck` — PASS.
  - `pnpm --dir apps/app typecheck` — PASS.
  - `pnpm --dir apps/web build` — PASS, 18 marketing routes generated.
  - `pnpm --dir apps/app build` — PASS, 22 authenticated/app/portal routes
    generated.
  - `git diff --check` — PASS.
- Cross-application link audit command:
  `rg -n --glob '!**/.next/**' --glob '!**/node_modules/**' 'href=["\`](/(sign-in|sign-up|onboarding|app)|/w/)|redirect\(["\`](/(sign-in|sign-up|onboarding|app)|/w/)' apps/web`
  — no matches. App-owned local routes remain intentionally relative inside
  `apps/app`.
- The request-path code in `apps/app` uses `@supabase/ssr`, PostgREST, and
  Supabase Storage; it does not import Prisma, SQLite, bcrypt, or a custom JWT
  implementation.
- The local Docker Supabase Postgres instance was exercised with its actual
  `authenticated`, `anon`, and `service_role` database roles and
  `request.jwt.claim.sub` claims. The behavioral SQL test passed for workspace
  read/insert isolation, client-portal isolation, Storage object isolation,
  anonymous inquiry privacy, and the intentional service-role bypass.
- Root and both deployable apps' TypeScript checks, ESLint, focused unit tests,
  and separate Next production builds pass under Node 24.
- Verification repairs added in this pass: immutable workspace owner/ID are
  enforced by a Postgres trigger; user mutations can enqueue RLS-scoped outbox
  events; the worker uses a service-role client and fails closed when it is not
  configured; notification count is implemented in the adapter; and portal
  request mutations no longer trust browser-supplied workspace or client IDs.

## Blocking findings

- `.env` contains only a legacy `DATABASE_URL`. There is no configured
  Supabase URL, publishable key, service-role key, CRON secret, email provider,
  webhook secret, or production project to verify. No remote environment was
  contacted or deployed.
- The automated tests do not execute authentication, invitation acceptance,
  portal authorization as a real client identity, exports, reports, custom
  fields, notifications, automation execution, or complete critical user
  workflows. The Playwright configuration starts the obsolete root app with
  Bun (which is not installed in this environment), not the two deployable
  apps.
- The database adapter deliberately emulates an ORM but lacks real
  transactional semantics for generic callbacks; production multi-write paths
  must use narrow PostgreSQL RPCs. The adapter now rejects unsupported `every`
  relation predicates, handles `none`/`isNot`, validates projections through
  PostgREST, returns empty `findMany` results correctly, and preflights single
  row writes to prevent partial multi-row mutation.
- Email and webhook automation actions intentionally throw because delivery
  adapters are not implemented/configured. Condition trees are not evaluated.
- Legacy Prisma/SQLite/custom-JWT artifacts remain in the repository and
  historical documentation. They are not on the `apps/app` request path, but
  their presence makes the root application and test suite misleading.

## Additional observed repairs in this verification pass

- `packages/database/src/adapter.ts` is the shared adapter used by both
  deployable apps; Vitest now resolves the workspace package directly.
- Unit adapter coverage is 5 files and 34 tests; the integration CSV suite is
  1 file and 4 tests; security coverage is 3 files and 7 tests.
- Migrations 0017–0019 were applied successfully to the local
  `supabase_db_agencyos-local` Postgres container. `supabase/tests/release_behavior.sql`
  passed with transaction rollback, atomic deal conversion, retry idempotency,
  and suspended-owner rejection.
- Client portal approval decisions now use a portal-scoped action and an RPC;
  deliverable visibility is checked against the explicit client, not workspace
  membership. Portal requests use the scoped RPC and emit an audit event.
- Won-deal conversion is exposed in the CRM board and uses an atomic RPC that
  creates/reuses the client and creates the onboarding project/task.

## Required before re-verification

1. Set `NEXT_PUBLIC_APP_URL` to the deployed authenticated-app origin in the
   `apps/web` production environment. The code default is intentionally only
   for local development; no deployment was performed in this pass.
2. Provision a non-production Supabase project with Auth, Postgres migrations,
   Storage buckets/policies, service role, cron secret, and delivery adapters.
3. Replace the root-app Playwright smoke tests with authenticated E2E coverage
   against `apps/web` and `apps/app`, including invitations, portal identities,
   Storage, exports, notifications, reports, custom fields, and automation.
4. Resolve the adapter’s missing transaction and relation-filter semantics,
   then run the complete suite against the non-production Supabase project.
