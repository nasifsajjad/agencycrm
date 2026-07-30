# AgencyOS

> The operating system for modern marketing agencies. Lead → deal → client → delivery → approval → report → invoice → renewal — in one configurable, multi-tenant workspace.

## Quick start

```bash
# 1. Install deps
bun install

# 2. Set up the database
bun run db:push

# 3. Start the dev server (auto-runs on port 3000)
# Dev server starts automatically in the sandbox; locally, run `bun run dev`

# 4. Visit http://localhost:3000
#    Sign up, then either create an empty workspace or load demo data.
```

## Demo credentials

After loading demo data, the following accounts are created (password: `demo-pass-12345`):

- `sarah@northstar.demo` — Sales
- `marcus@northstar.demo` — Account Manager
- `jordan@northstar.demo` — Team Member (designer)
- `rio@northstar.demo` — Contractor (copywriter)

Plus two demo client portals (no auth in local mode):
- `/portal/aurora-portal`
- `/portal/helix-portal`

## What's inside

- **Public marketing site** — `/`, `/product`, `/features`, `/pricing`, `/security`, `/solutions/*`, `/about`, `/contact`, `/book-demo`, `/docs`, `/privacy`, `/terms`
- **Authentication** — sign-up, sign-in, forgot-password (capture-only), accept-invite
- **Onboarding** — workspace creation + demo data loading
- **CRM** — contacts, companies, leads (kanban), deals (drag-and-drop board), activities
- **Clients** — Client 360 with stakeholders, projects, requests, health, finance, activity timeline
- **Projects & delivery** — list + detail with board, list, milestones, time, team tabs; tasks with drag-and-drop board; campaigns
- **Approvals** — list + detail with multi-step state machine and immutable event log
- **Time** — log time, weekly view, team view, submit-for-approval
- **Capacity** — per-member workload, utilization, overdue tasks
- **Finance** — invoices, expenses, retainers, profitability metrics
- **Reports** — role-aware dashboards, pipeline/win-rate/utilization/health
- **Settings** — members & invitations, roles, teams, audit log, customization, integrations, import/export
- **Client portal** — branded portal with projects, requests, approvals, files, reports (strictly isolated)
- **Global search** — permission-aware ⌘K command palette

## Architecture

AgencyOS is built on:

- **Next.js 16** App Router with React Server Components and Server Actions
- **Prisma** + SQLite (Postgres-compatible schema; see `docs/adr/0001-sandbox-stack-substitution.md` for the rationale)
- **bcryptjs + jose** for password hashing and JWT session cookies
- **Tailwind CSS 4** + shadcn/ui for the design system
- **TanStack Table + dnd-kit** for data grids and drag-and-drop boards
- **Zod** at trust boundaries

### Security model

- **Tenant isolation** is enforced at the application layer. Every tenant-owned query includes `workspaceId` derived from the resolved `WorkspaceContext`, never from browser-supplied data.
- **Permissions** are checked server-side on every mutation via the `can(ctx, permission)` helper. UI gating is presentation only.
- **Audit events** are append-only and capture every permission, approval, export, and financial mutation.
- **Portal users** see only explicitly shared records — never inherited from workspace membership.

See [`docs/security.md`](docs/security.md) and the ADRs in `docs/adr/` for details.

## Project structure

```
.
├── AGENTS.md                  # Operating guide for AI agents
├── README.md                  # This file
├── prisma/
│   └── schema.prisma          # Full data model
├── docs/
│   ├── CURRENT_STATE.md       # What's done vs. deferred
│   ├── adr/                   # Architecture Decision Records
│   ├── runbooks/              # Operational runbooks
│   └── product/               # Product docs
├── src/
│   ├── app/
│   │   ├── (marketing)/       # Public website
│   │   ├── (auth)/            # Sign-in, sign-up, accept-invite
│   │   ├── onboarding/        # Workspace creation
│   │   ├── w/[workspaceSlug]/ # Authenticated CRM app
│   │   ├── portal/[portalSlug]/ # Client portal
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives
│   │   ├── marketing/         # Public site components
│   │   ├── app/               # CRM app components
│   │   ├── portal/            # Portal components
│   │   └── auth/              # Auth forms
│   └── lib/                   # Server-only modules (db, auth, permissions, audit)
└── .env.example               # Environment template
```

## Documentation

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — what's done vs. deferred
- [`docs/adr/`](docs/adr/) — architecture decisions
- [`docs/runbooks/`](docs/runbooks/) — operational runbooks
- [`docs/product/`](docs/product/) — product specs
- [`AGENTS.md`](AGENTS.md) — operating guide for contributors and AI agents

## License

Demo project. All customer names, testimonials, and case studies are clearly-labelled fictional content.
