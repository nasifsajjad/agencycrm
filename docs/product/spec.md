# AgencyOS — Product specification

## Vision

AgencyOS is a configurable operating system for marketing agencies. It connects the complete lifecycle:

> Lead → deal → client onboarding → campaign/project delivery → approval → reporting → invoice → renewal

Every contact, decision, task, asset, approval, hour, expense, result, and relationship belongs to one coherent workspace data graph. It should feel custom-built for each agency without requiring that agency to write code.

## Target personas

- **Founder/owner:** pipeline, revenue, margin, health, risk, utilization
- **Sales/account executive:** leads, deals, activities, follow-up, forecasting
- **Account manager:** Client 360, requests, communication, renewals, reports
- **Project/traffic manager:** work intake, schedules, dependencies, capacity
- **Strategist/creative/specialist:** assigned work, briefs, files, feedback, time
- **Finance/operations:** retainers, budgets, rates, costs, invoices, exports
- **Contractor:** restricted project/task access
- **Client stakeholder:** portal, requests, files, approvals, reports
- **Workspace admin:** members, teams, roles, configuration, integrations, audit

## Commercial quality bar

- Fast onboarding with realistic templates and demo data
- Elegant information density, not a generic admin dashboard
- Cross-linked records and complete activity history
- Configurable terminology, fields, statuses, pipelines, views, branding
- Safe external collaboration and client approval
- Useful operational intelligence, not vanity charts
- Excellent search, keyboard interaction, bulk actions, saved views
- Clear permission and audit behavior

## Module map

| Module | Routes | Status |
|--------|--------|--------|
| Marketing site | `/`, `/product`, `/features`, `/pricing`, `/security`, `/solutions/*`, `/about`, `/contact`, `/book-demo`, `/templates`, `/docs`, `/privacy`, `/terms` | ✅ Implemented |
| Auth | `/sign-in`, `/sign-up`, `/forgot-password`, `/accept-invite` | ✅ Implemented |
| Onboarding | `/onboarding` | ✅ Implemented |
| Dashboard | `/w/[slug]` | ✅ Implemented |
| CRM | `/w/[slug]/crm/contacts`, `/companies`, `/leads`, `/deals`, `/activities` | ✅ Implemented |
| Clients | `/w/[slug]/clients`, `/clients/[id]` | ✅ Implemented (Client 360) |
| Projects | `/w/[slug]/projects`, `/projects/[id]` | ✅ Implemented |
| Tasks | `/w/[slug]/tasks` | ✅ Implemented |
| Campaigns | `/w/[slug]/campaigns` | ✅ List only |
| Approvals | `/w/[slug]/approvals`, `/approvals/[id]` | ✅ Implemented |
| Time | `/w/[slug]/time` | ✅ Implemented |
| Capacity | `/w/[slug]/capacity` | ✅ Implemented |
| Finance | `/w/[slug]/finance` | ✅ Implemented |
| Reports | `/w/[slug]/reports` | ✅ Implemented |
| My work | `/w/[slug]/my-work` | ✅ Implemented |
| Search | `/w/[slug]/search` | ✅ Implemented |
| Notifications | `/w/[slug]/notifications` | ✅ Implemented |
| Settings | `/w/[slug]/settings/{general,members,teams,roles,audit,customization,integrations,import-export}` | ✅ Implemented |
| Client portal | `/portal/[slug]/{,projects,requests,approvals,files,reports}` | ✅ Implemented |
| Health | `/api/health` | ✅ Implemented |

## Definitions

```
weighted pipeline = Σ(open deal amount × stage probability)
win rate = won deals / closed deals
utilization = billable approved minutes / available minutes
budget burn = actual approved cost or time / approved budget
approval age = now − approval requested timestamp
recognized revenue = Σ(billable minutes × rate / 60) for approved entries
gross profit = recognized revenue − labor cost − expenses
gross margin = gross profit / recognized revenue
```

## Permission catalogue

See `src/lib/permissions.ts` for the full 60+ key catalogue and the role → permission map for the 10 default roles.
