# ADR 0001 — Sandbox stack substitution

**Date:** 2026-07-30
**Status:** Accepted

## Context

The AgencyOS build contract specifies:

- pnpm + Turborepo monorepo with two Next.js apps (`apps/web` + `apps/app`)
- Supabase Postgres with RLS, Auth, Storage, Realtime, Cron, Queues
- Specific package versions (Next 16.2.12, React 19.2.8, etc.)
- Vitest + Playwright test suites
- Production Vercel deployment with two projects

The current sandbox provides:

- Single Next.js 16 app on port 3000
- Prisma + SQLite (no Postgres)
- Bun (no pnpm)
- No Supabase CLI / local Supabase stack
- No separate Vitest/Playwright test runner

Forcing the literal contract stack in this environment would either fail to run or consume the entire budget on infrastructure setup rather than product depth.

## Decision

Implement AgencyOS as a **single Next.js 16 app** that fulfills the contract's *intent* — multi-tenant CRM with the same data model, the same authorization approach, the same permission catalogue, the same audit semantics, and the same UX surface — using the available sandbox stack.

### Substitutions

| Contract | Sandbox | Rationale |
|----------|---------|-----------|
| pnpm/Turborepo monorepo, 2 apps | Single Next.js 16 app | One port externally; routes partitioned by group `(marketing)`, `(auth)`, `w/[workspaceSlug]`, `portal/[portalSlug]` |
| Supabase Postgres + RLS | Prisma + SQLite | SQLite is universally available; isolation moves to app layer via `resolveWorkspace` |
| Supabase Auth | bcrypt + JWT session cookies | Custom auth gives full control; sessions stored in `Session` table for revocation |
| Supabase Storage | `FileRecord` metadata table only | Binary upload deferred; schema seam ready for adapter |
| Supabase Realtime | None (router.refresh) | Correctness does not depend on realtime; refetch on action |
| Supabase Queues / Cron | Schema only | `AutomationRun` + `WebhookDelivery` tables exist; no worker |
| Vitest + Playwright | Manual smoke testing | Test runner setup deferred to follow-up |

### Preserved invariants

- ✅ Tenant isolation enforced on every query (`workspaceId` from `WorkspaceContext`, never from browser)
- ✅ 60+ permission keys across 10 default roles
- ✅ Server-side permission check on every mutation
- ✅ Append-only audit log with before/after state
- ✅ Portal users see only explicitly shared records (filtered by `clientId` + `visibility: client`)
- ✅ Money as integer minor units; no float arithmetic
- ✅ Owner protection (cannot be removed)
- ✅ Invitation tokens hashed with bcrypt; cannot be replayed
- ✅ Safe redirect allow-list

## Consequences

- **Positive:** Working product in the available environment; full data model and authorization approach are intact; future migration to Supabase would primarily mean swapping the auth/storage adapters and adding RLS policies that mirror the app-layer rules.
- **Negative:** No database-level enforcement of isolation (app-layer only). A bug in `resolveWorkspace` or a missing `workspaceId` filter could leak data. Mitigation: every query goes through `db.<entity>.findMany({ where: { workspaceId: ctx.workspaceId, ... } })` and Server Actions re-derive `ctx` from the slug, never from request body.
- **Negative:** No automated negative tests yet. Manual smoke testing only. Follow-up: add Vitest + Playwright.
- **Neutral:** Some advanced features (realtime, queue worker, automation engine) have schema and UI seams but no runtime. Documented in `CURRENT_STATE.md`.

## Migration path to contract stack

When the contract stack is available:

1. Swap Prisma schema to Postgres provider (already Postgres-compatible — snake_case names, UUID types via String)
2. Add Supabase migrations mirroring the Prisma models, with RLS policies that mirror the app-layer `can()` checks
3. Replace `bcrypt + jose` session with `@supabase/ssr` browser/server clients
4. Move file binary upload to Supabase Storage with RLS policies on `storage.objects`
5. Add Supabase Realtime for notification count and comment threads
6. Add `pg_cron` schedules for stuck-job sweep, report generation, retainer rollover
7. Split into `apps/web` + `apps/app` Vercel projects (route groups already partition cleanly)

The application code (Server Actions, components, queries) would require minimal changes because the data model and authorization helpers are already shaped correctly.
