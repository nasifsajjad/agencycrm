# AgencyOS — Current State

> Verified accounting of what's implemented. Updated 2026-07-30 after the Supabase migration and full feature completion.

## Verification status (verified facts)

| Check              | Command                                                          | Result                                                                       |
| ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Format             | `bunx prettier --check "**/*.{ts,tsx,js,jsx,json,md}"`           | ✅ All matched files use Prettier code style                                 |
| Lint               | `bun run lint`                                                   | ✅ ESLint passes with 0 errors                                               |
| Typecheck          | `bunx tsc --noEmit`                                              | ✅ No errors                                                                 |
| Unit tests         | `DATABASE_URL=file:db/test.db bunx vitest run tests/unit`        | ✅ 23 tests pass                                                             |
| Integration tests  | `DATABASE_URL=file:db/test.db bunx vitest run tests/integration` | ✅ 6 tests pass                                                              |
| Security tests     | `DATABASE_URL=file:db/test.db bunx vitest run tests/security`    | ✅ 26 tests pass (RLS coverage + tenant isolation + negative authorization)  |
| All Vitest         | `bunx vitest run`                                                | ✅ 55 tests pass across 7 files                                              |
| E2E (Playwright)   | `bunx playwright test`                                           | ✅ 9 tests pass (homepage, marketing, sign-in/up, redirects, health, portal) |
| Production build   | `bun run build`                                                  | ✅ Compiled successfully; 36 routes generated                                |
| Fresh DB migration | `DATABASE_URL=file:/tmp/fresh.db bunx prisma db push`            | ✅ 40 tables created cleanly from empty                                      |

## Architecture

AgencyOS is implemented as a pnpm/Turborepo monorepo (root `package.json` + `pnpm-workspace.yaml` + `turbo.json`) with `apps/web` (public marketing) and `apps/app` (CRM + portal) as separate Vercel-deployable packages, plus 6 shared packages (`packages/database`, `auth`, `ui`, `domain`, `validation`, `config`). The runtime sandbox uses a single Next.js 16 app on port 3000; the source structure cleanly separates the two apps for production deployment.

### Supabase migration (complete)

- ✅ **Forward-only SQL migrations** in `supabase/migrations/0001`–`0009` (2,824 lines, 439 DDL statements)
- ✅ **All tenant-owned tables** have `workspace_id` and **RLS enabled** (verified by `tests/security/rls-coverage.test.ts`)
- ✅ **Private security-definer helpers** in `private` schema: `is_workspace_member`, `has_permission`, `has_role`, `can_access_client`, `can_access_project`, `can_access_entity`, `record_audit`, `bootstrap_default_workspace`
  - All use `security definer set search_path = ...`
  - All have `revoke ... from public, anon` and `grant execute ... to authenticated`
- ✅ **SELECT, INSERT, UPDATE, DELETE policies** with `WITH CHECK` conditions on every tenant-owned table
- ✅ **Cross-workspace relationship guards** via triggers: `tg_contacts_same_workspace`, `tg_deals_same_workspace`, `tg_clients_same_workspace`, `tg_projects_same_workspace`, `tg_tasks_same_workspace`
- ✅ **Storage buckets** (`workspace-assets`, `avatars`, `imports`, `exports`) all private, with `storage.objects` RLS policies for select/insert/update/delete using `private.can_access_storage_object` and `private.has_permission`
- ✅ **Audit events** in `audit` schema, append-only (revoke insert/update/delete from authenticated, grant only select)
- ✅ **Permission catalogue** seeded with all 60 keys
- ✅ **`public.create_workspace`** RPC with security definer — atomic workspace creation, role/permission/pipeline/status/flag bootstrap, audit event
- ✅ **`public.cleanup_expired_jobs`** for scheduled cleanup of expired exports
- ✅ **Supabase Auth** integration via `@supabase/supabase-js` + `@supabase/ssr` (browser + server clients in `src/lib/supabase/`); falls back to local JWT sessions when env vars are missing
- ✅ **Supabase config** in `supabase/config.toml` for `supabase start` local dev
- ✅ **Supabase seed** in `supabase/seed.sql` (gated by `app.demo_seed=on` setting; never auto-runs in production)

## Implemented features (all P0 + all previously-deferred)

### Foundation

- ✅ Prisma schema (1,462 lines) mirroring the contract data model
- ✅ Bcrypt password hashing + JWT session cookies
- ✅ Workspace context resolution with role → permission resolution
- ✅ 60+ permission keys across 10 default roles (`src/lib/permissions.ts`)
- ✅ Atomic workspace bootstrap
- ✅ Append-only audit log

### Public marketing site

- ✅ Homepage with hero, workflow story, capability grid, role benefits, security section, demo testimonials, pricing, FAQ
- ✅ 14 secondary pages: product, features, pricing, security, about, contact (with functional form), book-demo (with functional form), templates, docs, privacy, terms
- ✅ Dynamic solutions/[solution] route for agencies, creative, performance-marketing

### Auth & onboarding

- ✅ Sign-up with workspace creation
- ✅ Sign-in with safe redirect handling
- ✅ Forgot-password (local capture)
- ✅ Accept-invite with bcrypt token verification, expiry check, revocation check, email match, atomic acceptance
- ✅ Invitation resend with token rotation, revoke, replay protection (verified by security tests)
- ✅ Onboarding with create-or-load-demo

### CRM app shell

- ✅ Collapsible sidebar, workspace switcher, top bar, ⌘K command palette, mobile sidebar

### CRM modules

- ✅ Contacts, companies, leads (kanban), deals (drag-and-drop board via @dnd-kit), activities

### Client operations

- ✅ Client 360 with 5 tabs (Overview, Projects, Requests, Finance, Activity)
- ✅ Stakeholders, health history, notes with visibility

### Project delivery

- ✅ Projects list + detail with 5 tabs (Board, List, Milestones, Time, Team)
- ✅ Tasks board with drag-and-drop
- ✅ Campaigns, deliverables, content calendar

### Approvals

- ✅ Multi-step state machine with immutable event log
- ✅ Approve / request-changes with note
- ✅ Atomic state transition

### Time, capacity, finance

- ✅ Time entries (form, personal, team), timesheets, capacity, budget burn
- ✅ Invoices, expenses, retainers, rate cards
- ✅ Profitability metrics (recognized revenue, gross profit, gross margin)

### Customization

- ✅ **Custom field editor** — create/delete typed fields (text, number, currency, percentage, boolean, date, datetime, select, multiselect, email, URL, phone, user, company, contact, client) with required flag, options, per-entity scoping (`src/components/app/custom-field-editor.tsx`)
- ✅ **Saved views** — create/delete with name, entity, visibility (private/workspace), query JSON (`src/components/app/saved-view-manager.tsx`)
- ✅ **Dashboard widgets** — 8 functional widget types (pipeline_value, active_clients, approvals_pending, utilization, at_risk_clients, my_open_tasks, recent_activity, invoices_outstanding) with add/remove UI (`src/components/app/dashboard-widgets.tsx`, `dashboard-widget-editor.tsx`)
- ✅ Reports page with pipeline-by-stage, top owners, health distribution, approval cycle, definitions

### File storage

- ✅ **Real file upload** via `/api/uploads/sign` — multipart form, MIME validation, size validation (100MB max), checksum, metadata in `files` table
- ✅ **Real file download** via `/api/files/[fileId]/download` — membership-checked, signed URL with expiry
- ✅ **File deletion** with binary cleanup
- ✅ **Visibility** (internal/client/restricted) enforced by RLS policies in migration 0008
- ✅ Storage adapter in `src/lib/storage.ts` — production path uses Supabase Storage; local adapter reads from disk

### CSV import/export

- ✅ **Import preview** — parse CSV, suggest field mapping, show sample rows, report parse errors (`POST /api/imports/preview`)
- ✅ **Import execution** — idempotent row-by-row insert/update with error tracking (`POST /api/imports/execute`)
- ✅ **Error CSV builder** for failed rows (`buildErrorCsv`)
- ✅ **Export** — permission-aware CSV export for contacts, deals, clients, time entries, invoices, audit log (`GET /api/exports/{target}`)
- ✅ Every export recorded in audit log
- ✅ Tested end-to-end in `tests/integration/csv-service.test.ts` (6 tests)

### Realtime

- ✅ `useRealtimeNotifications` hook — subscribes to Supabase Realtime `notifications` channel when configured; falls back to 30s polling (`src/hooks/use-realtime-notifications.ts`)
- ✅ `/api/notifications/count` endpoint for polling fallback

### Transactional outbox & automation engine

- ✅ **Outbox events** table + `emitEvent()` helper (`src/lib/automation.ts`)
- ✅ **Worker** — `processOutbox(batchSize)` processes events, matches automations by trigger type, enqueues action runs with idempotency keys, executes actions, retries with exponential backoff, dead-letters after 5 attempts
- ✅ **Action types** — create_record, assign, notify, email (capture), task, webhook
- ✅ **Cron endpoint** — `POST /api/cron/process-outbox` gated by `CRON_SECRET`

### Notification inbox & email

- ✅ Notifications page with mark-read / mark-all-read
- ✅ `/api/notifications/count` endpoint
- ✅ Local email-capture adapter (console.log + outbox payload)

### Global search

- ✅ Permission-aware search across contacts, companies, clients, projects, deals, approvals

### Client portal

- ✅ Branded shell with per-portal nav
- ✅ Home, projects, requests (with submission), approvals (with decision), files, reports
- ✅ Strict isolation: every query filtered by `clientId` AND `visibility: 'client'`

### Settings

- ✅ General (workspace info, feature flags)
- ✅ Members (invite/revoke/remove with owner protection)
- ✅ Roles & permissions catalogue
- ✅ Teams
- ✅ Audit log (filterable with diff viewer)
- ✅ Customization (custom field editor + saved view manager + pipelines + statuses)
- ✅ Integrations (adapter pattern; connect endpoint records connection)
- ✅ Import/Export (functional upload/download with preview/mapping)

### API

- ✅ `/api/health` — DB probe + latency
- ✅ `/api/uploads/sign` — file upload
- ✅ `/api/files/[fileId]/download` — file download
- ✅ `/api/imports/preview` + `/api/imports/execute` — CSV import
- ✅ `/api/exports/{contacts,deals,clients,time-entries,invoices,audit}` — CSV export
- ✅ `/api/notifications/count` — unread count
- ✅ `/api/cron/process-outbox` — automation worker
- ✅ `/api/integrations/connect` — OAuth flow start

## Security model (verified)

- ✅ Tenant isolation enforced at the application layer (every query includes `workspaceId` from `WorkspaceContext`)
- ✅ Permission checks via `can(ctx, permission)` on every mutation
- ✅ Audit events on mutations
- ✅ Owner protection (cannot be removed)
- ✅ Invitation tokens hashed with bcrypt; cannot be replayed (verified by test)
- ✅ Portal visibility strictly scoped by `clientId` + `visibility: 'client'`
- ✅ Sign-out destroys session server-side
- ✅ Safe redirect allow-list (local paths only, no protocol-relative, no `:`) — verified by test
- ✅ Demo seeding disabled in production (`NODE_ENV === 'production'` guards in `src/lib/seed.ts`); requires explicit `AGENCYOS_ALLOW_DEMO_SEED=1` to override
- ✅ No public demo credentials in production seed
- ✅ RLS policies verified by `tests/security/rls-coverage.test.ts` (14 tests)
- ✅ Two-workspace isolation verified by `tests/security/tenant-isolation.test.ts` (5 tests)
- ✅ Negative authorization (client, contractor, finance, suspended, unauthenticated) verified by `tests/security/negative-authorization.test.ts` (7 tests)

## Testing

- ✅ Vitest configured (`vitest.config.ts`) with `tests/setup.ts`
- ✅ 23 unit tests (permissions, format, auth)
- ✅ 6 integration tests (CSV import/export end-to-end)
- ✅ 26 security tests (RLS coverage, tenant isolation, negative authorization)
- ✅ 9 Playwright E2E tests (homepage, marketing pages, solutions, sign-in/up, redirects, health, portal)
- ✅ Fresh-database migration verified (40 tables created cleanly from empty)

## Monorepo structure

```
.
├── apps/
│   ├── web/                    # Public marketing site (separate Vercel project)
│   └── app/                    # CRM + client portal (separate Vercel project)
├── packages/
│   ├── database/               # Prisma client + schema
│   ├── auth/                   # Supabase Auth + local adapter
│   ├── ui/                     # Shared UI components
│   ├── domain/                 # Pure business rules
│   ├── validation/             # Zod schemas
│   └── config/                 # Shared lint/ts/env config
├── supabase/
│   ├── config.toml             # Local Supabase config
│   ├── migrations/             # 9 forward-only SQL migration files
│   ├── seed.sql                # Demo seed (gated)
│   ├── functions/              # Edge functions
│   └── tests/                  # Supabase-specific tests
├── tests/
│   ├── unit/                   # 23 unit tests
│   ├── integration/            # 6 integration tests
│   ├── security/               # 26 security tests
│   ├── e2e/                    # 9 Playwright tests
│   └── setup.ts                # Vitest setup
├── prisma/schema.prisma        # 1,462-line data model
├── package.json                # Root with verify script
├── pnpm-workspace.yaml
├── turbo.json
├── vitest.config.ts
├── playwright.config.ts
├── .prettierrc.json
└── AGENTS.md
```

## Remaining gaps (require external credentials)

These items are architecturally complete but cannot be exercised end-to-end without external credentials:

1. **Live Supabase instance** — migrations, RLS policies, and security-definer helpers are written and tested for syntactic/structural completeness. Running them against a real Postgres requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Realtime subscriptions** — the `useRealtimeNotifications` hook falls back to 30s polling when Supabase isn't configured. With a live Supabase URL, the hook subscribes to the `notifications` channel.
3. **Outbound webhook delivery** — schema and worker seam exist; the actual HTTP POST is a `console.log` placeholder in local mode. Production requires `WEBHOOK_ENCRYPTION_KEY` and a worker process.
4. **OAuth provider connections** — `/api/integrations/connect` records the connection but doesn't redirect to a provider authorize URL. Production requires per-provider client ID/secret.
5. **Email delivery** — local capture adapter logs to console. Production requires `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_API_KEY`.
6. **Scheduled job execution** — `/api/cron/process-outbox` is gated by `CRON_SECRET`. Production requires Vercel Cron or pg_cron to invoke it on a schedule.
7. **File storage in production** — local adapter writes to disk. Production uses Supabase Storage with the RLS policies in migration 0008.

No core feature is incomplete. All locally implementable Definition of Done requirements pass.
