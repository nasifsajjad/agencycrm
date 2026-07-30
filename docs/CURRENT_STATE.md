# AgencyOS — Current State

> Honest accounting of what's implemented vs. deferred. Updated 2026-07-30.

## Implemented

### Foundation
- ✅ Prisma schema mirroring the AgencyOS contract (workspaces, memberships, roles, permissions, audit, CRM, clients, projects, tasks, approvals, time, finance, custom fields, automations, portals, knowledge)
- ✅ Bcrypt password hashing + JWT session cookies (`src/lib/auth.ts`)
- ✅ Workspace context resolution with role → permission resolution (`src/lib/auth.ts`)
- ✅ 60+ permission keys across 10 default roles (`src/lib/permissions.ts`)
- ✅ Atomic workspace bootstrap with default pipeline, statuses, services, feature flags (`src/lib/workspace.ts`)
- ✅ Append-only audit log (`src/lib/audit.ts`)
- ✅ Money utilities — integer minor units, no float arithmetic (`src/lib/format.ts`)

### Public marketing site
- ✅ Homepage with hero, workflow story, capability grid, role benefits, security section, demo testimonials, pricing, FAQ
- ✅ Product, Features, Pricing, Security, About, Contact, Book demo, Templates, Docs, Privacy, Terms pages
- ✅ Solutions pages for agencies, creative, performance-marketing (dynamic route)

### Auth & onboarding
- ✅ Sign-up with optional workspace creation in one flow
- ✅ Sign-in with redirect-after-login (safe local-only redirects)
- ✅ Forgot-password (capture-only in local mode)
- ✅ Accept-invite flow with token hash verification and atomic membership creation
- ✅ Sign-out
- ✅ Onboarding page with create-or-load-demo
- ✅ Demo data seeding: Northstar Growth Studio with 3 clients, deals, projects, tasks, approvals, time, finance

### CRM app shell
- ✅ Collapsible sidebar with workspace switcher, quick-create menu, navigation grouped by area
- ✅ Top bar with breadcrumbs, search, notifications, theme toggle, user menu
- ✅ ⌘K command palette for navigation and quick actions
- ✅ Mobile sidebar via Sheet

### CRM modules
- ✅ Contacts — list with search, create dialog, delete with audit
- ✅ Companies — card grid with search and create
- ✅ Leads — kanban by status with inline status change
- ✅ Deals — drag-and-drop board with @dnd-kit, weighted pipeline metrics, create dialog
- ✅ Activities — list with type icons, due dates, complete button

### Client operations
- ✅ Clients list with health badges, status, owner, renewal
- ✅ Client 360 with Overview, Projects, Requests, Finance, Activity tabs
- ✅ Stakeholders, company, health history, notes composer
- ✅ Note visibility (internal / client / restricted)

### Project delivery
- ✅ Projects list with metrics
- ✅ Project detail with Board / List / Milestones / Time / Team tabs
- ✅ Tasks board with drag-and-drop between statuses
- ✅ Tasks list page with overdue tracking
- ✅ Campaigns list
- ✅ Task form with status, priority, assignee, due date, estimate

### Approvals
- ✅ Approvals list with pending / decided sections
- ✅ Approval detail with sequential steps, immutable event log
- ✅ Approve / request-changes decision with note
- ✅ Atomic state transition in transaction

### Time & capacity
- ✅ Time entry form with project, minutes, billable, rate, startedAt
- ✅ Time page with personal metrics, submit-for-approval
- ✅ Team-wide time view (requires `time.read_all`)
- ✅ Capacity page with per-member workload, utilization, overdue tasks

### Finance
- ✅ Finance page with Invoices / Expenses / Retainers tabs
- ✅ Profitability metrics: recognized revenue, gross profit, gross margin

### Customization & search
- ✅ Global search across contacts, companies, clients, projects, deals, approvals
- ✅ Customization settings page (custom fields, saved views, pipelines, statuses — read-only display)
- ✅ Reports page with pipeline-by-stage, top owners, client health distribution, approval cycle, definition reference

### Settings
- ✅ General (workspace info, feature flags)
- ✅ Members (list, invite, revoke, remove with owner protection)
- ✅ Roles & permissions (catalogue display)
- ✅ Teams (list)
- ✅ Audit log (filterable by entity type, with before/after diff viewer)
- ✅ Customization
- ✅ Integrations (adapter pattern display; no live connections in local mode)
- ✅ Import/export (UI; permission gating displayed)

### Client portal
- ✅ Portal layout with branded shell and per-portal nav
- ✅ Portal home with project/approval/request counts
- ✅ Portal projects list (filtered by `visibility: client`)
- ✅ Portal requests with new-request submission
- ✅ Portal approvals with approve/request-changes decision
- ✅ Portal files (deliverables list)
- ✅ Portal reports (invoices, retainers summary)

### Other
- ✅ Notifications page with mark-read / mark-all-read
- ✅ My-work page with assigned tasks, pending approvals, open time entries, recent activity
- ✅ API `/api/health` endpoint with DB probe and latency

## Deferred (documented gaps)

### Not implemented in this build

- ❌ **Real Supabase Postgres + RLS** — using SQLite + application-layer isolation. See `docs/adr/0001-sandbox-stack-substitution.md`.
- ❌ **Real Supabase Auth** — using custom JWT sessions. See same ADR.
- ❌ **File binary upload** — `FileRecord` schema exists with metadata; binary upload requires a storage adapter (S3, local fs, or Supabase Storage). Not wired in this build.
- ❌ **Realtime** — no WebSocket / Supabase Realtime integration; UI refetches via router.refresh().
- ❌ **Background jobs / queue** — schema exists (`AutomationRun`, `WebhookDelivery`); no worker is wired.
- ❌ **Cron schedules** — no `pg_cron` equivalent in SQLite.
- ❌ **Vitest unit tests** — not set up.
- ❌ **Playwright E2E** — not set up.
- ❌ **Cross-workspace RLS negative tests** — would require a dedicated test runner with JWT contexts; manual smoke testing only.
- ❌ **CSV import parsing** — UI exists, file parsing not wired.
- ❌ **CSV export** — UI exists, generation not wired.
- ❌ **Webhook signing/delivery** — schema exists, no worker.
- ❌ **AI features** — schema seam not added; intentionally deferred per contract.
- ❌ **SSO/SAML/SCIM** — adapter boundary documented only.
- ❌ **Custom domain portal** — single-slug portal only.

### Partially implemented

- ⚠️ **Automations** — schema and admin UI (read-only display) only; no trigger engine.
- ⚠️ **Custom fields** — schema and one demo field; no UI for creating or editing definitions; values stored but not displayed on entity pages.
- ⚠️ **Saved views** — schema only; no UI for creating or applying.
- ⚠️ **Dashboards** — schema and one demo dashboard; no widget renderer.
- ⚠️ **Report builder** — read-only reports page; no report definition editor.
- ⚠️ **Email adapter** — local capture acknowledged in UI; no real provider wiring.

## Security model status

- ✅ Tenant isolation enforced via `workspaceId` on every query
- ✅ Permission checks via `can(ctx, permission)` on every mutation
- ✅ Audit events on mutations (workspace, contact, deal, lead, task, approval, invitation, member, time)
- ✅ Owner protection (cannot be removed)
- ✅ Invitation tokens hashed with bcrypt; cannot be replayed
- ✅ Portal visibility strictly scoped by `clientId` + `visibility: client`
- ✅ Sign-out destroys session server-side
- ✅ Safe redirect allow-list (local paths only)
- ❌ Cross-workspace negative tests not automated
- ❌ Service-role module import guards (no service role in this build)
- ❌ Storage RLS policies (no binary storage in this build)

## Verification status

- ✅ ESLint passes (0 errors)
- ✅ Database schema pushes cleanly from empty
- ✅ All routes return 200 (manually smoke-tested)
- ✅ Homepage renders without errors
- ✅ Sign-up → onboarding → demo data → workspace dashboard flow works
- ❌ Production build (`bun run build`) not tested in this session
- ❌ TypeScript strict type-check not run as a separate command (Next.js compiles inline)

## Next steps (priority order)

1. Add Vitest + write unit tests for permission composition, money math, approval state machine
2. Add Playwright + write E2E for sign-up → demo data → key flows
3. Add CSV import/export execution (parsing + streaming)
4. Add custom-field editor UI and surface values on entity pages
5. Add saved-views UI and URL state syncing on list pages
6. Add dashboard widget renderer (pipeline, approvals, utilization, health)
7. Wire a real storage adapter (local fs in dev; S3 in prod)
8. Add webhook signing/delivery worker
9. Add automation trigger engine
