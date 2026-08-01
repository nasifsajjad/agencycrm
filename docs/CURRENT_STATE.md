# AgencyOS — Current State

Updated 2026-08-01 after the Supabase request-path implementation and local live verification.

## Implemented

- Authenticated requests now use request-scoped `@supabase/ssr` Auth cookies and profile rows. Custom JWT sessions, bcrypt password verification, and the local session adapter are no longer in the application request path.
- Tenant reads and writes use the Supabase PostgREST adapter in `src/lib/db.ts`; query results are translated to the existing domain shape, relation hydration is RLS-scoped, and no Prisma dependency remains in the app packages.
- Workspace creation uses the atomic `public.create_workspace` RPC. Invitation acceptance uses `public.accept_invitation`; invitation preview uses a SHA-256 token lookup RPC without exposing token hashes.
- Audit writes use the append-only `public.record_audit` wrapper and `private.record_audit`; direct authenticated inserts remain denied.
- Binary uploads, downloads, signed URLs, and deletes use Supabase Storage with `storage.objects` RLS plus the tenant metadata row in `public.files`.
- `apps/web` is a deployable marketing Next app and `apps/app` is a deployable authenticated CRM/portal Next app. Their route adapters cover the complete root marketing, auth, workspace, portal, API, exports, imports, notifications, and file route surface.
- Authorization tests now exercise permission behavior, tenant/RLS policy coverage, portal explicit-client rules, safe redirects, CSV permission gates, and migration relationship guards.

## Verification

All of the following pass with the pinned Node 24 runtime:

```text
TypeScript: root tsconfig and apps/app tsconfig
ESLint: repository source tree
Vitest: 7 files, 51 tests
Next production build: root app
Next production build: apps/web
Next production build: apps/app
Supabase migrations 0001–0012: clean local Docker Postgres 17.4
supabase/tests/rls_behavior.sql: pass, including cross-workspace and portal isolation cases
```

The local Supabase database used for verification is the named Docker container `supabase_db_agencyos-local`. It was reset locally before replaying the migrations. Production was not contacted or modified.

## Remaining external prerequisite

The repository `.env` intentionally has no Supabase URL/key. A human deployment operator must provide the target Supabase project URL, publishable key, and service-role key through the deployment secret manager, run `supabase db push` against that non-production project, and configure the two Vercel projects. No deployment or production change was made here.

The legacy `prisma/schema.prisma` and historical ADR/worklog references remain as migration history/documentation only; they are not used by the application packages or request path.
