# AgencyOS — Current State

Updated 2026-08-01 by an independent production-readiness verification. This
document records observed results; it is not a release approval.

## Verdict: NOT READY

The repository is not ready for production. A deployable Supabase production
environment, its credentials, and a complete end-to-end verification are all
absent. More importantly, the application test suite does not cover the
critical behaviours it claims to cover.

## Verified locally

- The request-path code in `apps/app` uses `@supabase/ssr`, PostgREST, and
  Supabase Storage; it does not import Prisma, SQLite, bcrypt, or a custom JWT
  implementation.
- The local Docker Supabase Postgres instance was exercised with its actual
  `authenticated`, `anon`, and `service_role` database roles and
  `request.jwt.claim.sub` claims. The behavioral SQL test passed for workspace
  read/insert isolation, client-portal isolation, Storage object isolation,
  anonymous inquiry privacy, and the intentional service-role bypass.
- Root and `apps/app` TypeScript checks and repository ESLint pass under Node 24. The web app produced a standalone Next production artifact.
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
- `apps/web` links to `/sign-in` and `/sign-up`, but it does not own those
  routes; it has no configured application origin/rewrite to `apps/app`.
  Independently deployed marketing calls-to-action therefore 404.
- The automated tests do not execute authentication, invitation acceptance,
  portal authorization as a real client identity, exports, reports, custom
  fields, notifications, automation execution, or complete critical user
  workflows. The Playwright configuration starts the obsolete root app with
  Bun (which is not installed in this environment), not the two deployable
  apps.
- The database adapter deliberately emulates an ORM but lacks real
  transactional semantics and ignores several relation predicates. This can
  make feature queries incorrect even when RLS prevents cross-tenant exposure.
- Email and webhook automation actions intentionally throw because delivery
  adapters are not implemented/configured. Condition trees are not evaluated.
- Legacy Prisma/SQLite/custom-JWT artifacts remain in the repository and
  historical documentation. They are not on the `apps/app` request path, but
  their presence makes the root application and test suite misleading.

## Required before re-verification

1. Complete the split deployment contract: configure a required app origin for
   `apps/web`, and run separate production builds and smoke tests for both
   apps.
2. Provision a non-production Supabase project with Auth, Postgres migrations,
   Storage buckets/policies, service role, cron secret, and delivery adapters.
3. Replace the root-app Playwright smoke tests with authenticated E2E coverage
   against `apps/web` and `apps/app`, including invitations, portal identities,
   Storage, exports, notifications, reports, custom fields, and automation.
4. Resolve the adapter’s missing transaction and relation-filter semantics,
   then run the complete suite against the non-production Supabase project.
