# AgencyOS — Agent Operating Guide

> Read this before making changes to the repository. Follow it strictly.

## Project intent

AgencyOS is a multi-tenant CRM and operating system for marketing agencies. It connects lead → deal → client → delivery → approval → report → invoice → renewal in one configurable workspace.

## Topology (sandbox adapter)

The build contract specifies a pnpm/Turborepo monorepo with two Next.js apps and Supabase. The current sandbox runs a single Next.js 16 app on port 3000 with Prisma + SQLite. The data model and authorization approach mirror the contract; environment-specific substitutions are documented in `docs/adr/`.

- Public marketing site: `/` and `/(marketing)/*`
- Auth & onboarding: `/sign-in`, `/sign-up`, `/onboarding`, `/accept-invite`
- Authenticated CRM app: `/w/[workspaceSlug]/*`
- Client portal: `/portal/[portalSlug]/*`
- Health check: `/api/health`

## Architecture rules (non-negotiable)

1. **Tenant isolation is enforced at the application layer.** Every tenant-owned query includes `workspaceId` derived from the resolved `WorkspaceContext`, never from browser-supplied data. The `resolveWorkspace` helper in `src/lib/server.ts` is the single entry point for resolving the current workspace.
2. **Permissions are checked server-side on every mutation.** UI gating is presentation only. The `can(ctx, permission)` helper must be called in every Server Action and route handler before mutating data.
3. **Audit events are append-only.** The `audit()` helper in `src/lib/audit.ts` records every permission, approval, export, and financial mutation with actor, before/after state, and timestamp.
4. **Money is integer minor units.** No floating-point arithmetic on monetary values. Use the helpers in `src/lib/format.ts`.
5. **Service-role / server-only code never enters the client bundle.** Server Actions and `lib/` modules that touch the database directly must never be imported from client components.
6. **Portal users see only explicitly shared records.** Never derive portal visibility from workspace membership — always check `clientId` explicitly.

## Required commands

```bash
bun run lint        # ESLint
bun run db:push     # Apply Prisma schema
bun run dev         # Dev server (auto-runs on port 3000)
```

## File conventions

- `src/lib/` — server-only modules (db, auth, permissions, audit, queries, actions)
- `src/components/app/` — CRM app components (shell, forms, boards)
- `src/components/portal/` — client portal components
- `src/components/marketing/` — public site components
- `src/app/(marketing)/` — public marketing routes
- `src/app/(auth)/` — authentication routes
- `src/app/w/[workspaceSlug]/` — authenticated CRM app
- `src/app/portal/[portalSlug]/` — client portal
- `prisma/schema.prisma` — data model
- `docs/` — ADRs, runbooks, current state, product docs

## Definition of Done (per feature)

- ✅ Permission checked server-side on every mutation
- ✅ Workspace ID derived from `resolveWorkspace`, never from URL/body alone
- ✅ Loading, empty, error, forbidden states exist
- ✅ Audit event emitted for mutations that change meaningful state
- ✅ Mobile-responsive
- ✅ No `any` types — use proper Prisma generated types

## Known substitutions vs. the original contract

See `docs/adr/0001-sandbox-stack-substitution.md` for the full list. Most notably:

- pnpm/Turborepo monorepo → single Next.js app
- Supabase Postgres + RLS → Prisma + SQLite with application-layer isolation
- Supabase Auth → custom JWT sessions with bcrypt
- Supabase Storage → server-managed file metadata (binary upload via signed URL adapter seam)
- Vitest/Playwright → manual smoke testing in this build
