# AgencyOS — Agent Operating Guide

> Read this before making changes. It describes the repository as it actually is.
> If something here contradicts what you find in the code, trust the code and fix this file.

## Project intent

AgencyOS is a multi-tenant CRM and operating system for marketing agencies. It connects
lead → deal → client → delivery → approval → report → invoice → renewal in one configurable workspace.

## Actual stack

pnpm workspaces monorepo, two independently deployable Next.js 16 apps, Supabase Postgres with RLS.

```
apps/web           Public marketing site        port 3000   @agencyos/web
apps/app           Authenticated CRM + portal   port 3001   @agencyos/app
packages/config    Shared env + redirect safety             @agencyos/config
packages/database  PostgREST adapter                        @agencyos/database
packages/domain    Pure business rules                      @agencyos/domain
supabase/migrations  Forward-only SQL, applied in filename order
```

`packages/auth`, `packages/validation`, and `packages/ui` are declared as workspace
dependencies but contain only a `package.json`. Nothing imports them. Either populate
them or remove them — do not assume they hold logic.

### Routes

- Marketing (`apps/web`): `/`, `/(marketing)/*`
- Auth (`apps/app`): `/sign-in`, `/sign-up`, `/reset-password`, `/accept-invite`, `/auth/callback`
- Onboarding (`apps/app`): `/onboarding`
- CRM (`apps/app`): `/w/[workspaceSlug]/*`
- Client portal (`apps/app`): `/portal/[portalSlug]/*`
- Health (`apps/app`): `/api/health`
- Outbox worker (`apps/app`): `POST /api/cron/process-outbox`

## Architecture rules (non-negotiable)

1. **Tenant isolation is enforced twice: RLS in the database, and `workspaceId` in the
   application.** Every tenant-owned query filters by `ctx.workspaceId`, derived from
   `resolveWorkspace(slug)` in `apps/app/src/lib/server.ts` — session user plus a
   slug→membership lookup. Never take `workspace_id` from a request body or URL and trust it.
2. **Permissions are checked server-side on every mutation.** Use `withPermission(slug, perm, fn)`
   in `crm-actions.ts`, or `can(ctx, permission)` / `requirePermission(ctx, permission)` from
   `apps/app/src/lib/auth.ts`. UI gating is presentation only. Every new mutating action needs a
   permission key in `apps/app/src/lib/permissions.ts` **and** an RLS policy — neither alone.
3. **Multi-write operations go in a PostgreSQL RPC, not the adapter.** `db.$transaction` is a
   deliberate throw-stub (`packages/database/src/adapter.ts`). Atomic work belongs in a
   `security definer` function — see `convert_deal_to_client`, `decide_approval`, `accept_invitation`.
4. **Every `security definer` function must `set search_path` and re-check authorization
   internally.** Do not rely on the caller having checked. Do not grant `execute on all functions
in schema private` — grant per function, to the narrowest role.
5. **Audit events are append-only.** Use `public.record_audit`, never `private.record_audit` —
   the public wrapper is the one that verifies membership.
6. **Money is integer minor units.** No floating-point arithmetic on monetary values.
   Use the helpers in `apps/app/src/lib/format.ts`.
7. **The service-role key never enters a request path.** Only the outbox worker
   (`apps/app/src/lib/automation.ts`, reached solely from the CRON-secret-gated route) may use
   `serviceDb`/`serviceRpc`. Server-only modules must `import "server-only"`.
8. **Portal users see only explicitly shared records.** Visibility comes from an explicit
   `client_id` linkage (`private.can_access_client`) plus `visibility = 'client'` — never from
   workspace membership.

## Commands

This project uses **pnpm**, not bun and not npm.

```bash
pnpm install

pnpm dev:web              # marketing site on :3000
pnpm dev:app              # CRM app on :3001

pnpm lint                 # eslint, all workspaces
pnpm typecheck            # tsc across apps, packages and tests
pnpm test                 # vitest: unit + integration + security
pnpm test:e2e             # playwright (boots both dev servers)

pnpm supabase:start       # local Supabase (requires Docker)
pnpm db:reset             # rebuild local DB from migrations + seed
pnpm supabase:test        # behavioural SQL

pnpm verify               # everything CI runs
```

`pnpm db:reset` requires Docker and the Supabase CLI. The DB-backed security tests
(`tests/security/*`) shell out to the local Supabase container and will fail — not skip —
without it. That is intentional: a security test that silently skips is worse than none.

## File conventions

- `apps/app/src/lib/` — server-only modules (db, auth, permissions, audit, actions)
- `apps/app/src/components/app/` — CRM components
- `apps/app/src/components/portal/` — client portal components
- `apps/web/src/components/marketing/` — public site components
- `supabase/migrations/` — forward-only. Never edit an applied migration; add a new one.
- `supabase/tests/` — behavioural SQL, executed by `tests/security/*`
- `docs/adr/` — architecture decisions

## Definition of Done (per feature)

- Permission checked server-side on every mutation, with a key in `permissions.ts`
- RLS policy covering the same operation, tested positively **and** negatively
- `workspaceId` derived from `resolveWorkspace`, never from URL or body alone
- Loading, empty, error, and forbidden states exist
- Audit event emitted for meaningful state changes
- Background work is idempotent, with retry and a visible failure state
- Lists are paginated
- Mobile-responsive
- No `any` at a trust boundary

## Known gaps

Tracked honestly rather than hidden. See `docs/CURRENT_STATE.md` for detail.

- Email delivery has no configured provider, so invitations and password reset cannot
  complete end-to-end in any environment that lacks one.
- Magic-link sign-in exists in `supabase/client.ts` but has no UI.
- `packages/auth`, `packages/validation`, `packages/ui` are empty shells.
- There is no shared schema-validation layer; form input is hand-parsed in the actions.
