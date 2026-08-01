# ADR 0004 — Remove the pre-monorepo forks

**Date:** 2026-08-02
**Status:** Accepted
**Supersedes:** ADR 0001 (sandbox stack substitution)

## Context

The monorepo split copied `src/lib/*` and `src/components/*` into both apps and
left the original in place, producing three forks of the same modules:

| Tree | Files | Deployed |
| --- | --- | --- |
| `src/` (root) | 185 | no |
| `apps/app/src` + `apps/app/app` | 174 | yes, port 3001 |
| `apps/web/src` + `apps/web/app` | 128 | yes, port 3000 |

Two concrete harms followed.

**The root fork made verification dishonest.** Root `tsconfig.json` excluded
`apps`, `packages`, and `tests`, so `pnpm typecheck` only ever checked the tree
that ships nowhere. `vitest` resolved `@` there too (see ADR 0003).

**`apps/web` shipped the whole CRM.** The public marketing site is 14 routes
that need 17 source files. It carried 111. Among the dead 94 were
`crm-actions.ts`, `portal-actions.ts`, `invite-actions.ts`, `storage.ts`, every
`components/app/*` and `components/portal/*`, and `lib/db.ts` — which exports
`serviceDb`/`serviceRpc`, the service-role-capable database handles. Nothing in
`apps/web` imported them, so this was latent rather than exploited, but it put
RLS-bypassing handles in the bundle graph of the one app that faces the
anonymous internet.

## Decision

Delete the root `src/`, `prisma/`, `public/`, `next.config.ts`,
`tailwind.config.ts`, and `components.json`. The root is now a workspace root,
not a fourth application.

Reduce `apps/web/src` to the transitive closure of its route entry points,
computed mechanically rather than by inspection: 17 files kept, 94 removed.

Fix `tsconfig.json` to cover `packages/*/src`, `tests`, `scripts`, and root
configuration, and repoint `@/*` at `apps/app/src`. `pnpm typecheck` now runs
the root project plus both apps, so the name matches what it does.

Give each app its own `postcss.config.mjs`. Both previously relied on Next
walking up the directory tree to find the repo-root config, which happened to
work and would have broken silently on any layout change.

## Consequences

- 285 files removed from the tree; `apps/web`'s source surface drops by 85%.
- `prisma/schema.prisma` goes with it. The schema of record is
  `supabase/migrations/`; the Prisma schema had been decorative since the
  Supabase migration and risked being mistaken for authoritative.
- ADR 0001 described a SQLite/Prisma sandbox substitution that no longer exists
  anywhere in the tree. It is superseded and retained only as history.
- Verified after removal: both apps build (18 and 41 routes), root typecheck
  passes at the widened scope, `eslint .` is clean, and 50 tests pass.
