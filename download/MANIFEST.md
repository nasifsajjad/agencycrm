# AgencyOS — Source archive manifest

**Archive:** `agencyos-source.tar.gz`
**Size:** 42 MB
**Files:** 2,380
**SHA-256:** `cd481204d4e22ed88f17a59679a4b780d50a6506713452b1993e225ef20c75d0`
**Build timestamp:** 2026-07-30T16:41:03Z
**Git commit:** `d6b16d2def5399dba5b916014e181c95c02b6616`

## Verify

```bash
sha256sum agencyos-source.tar.gz
# should print: cd481204d4e22ed88f17a59679a4b780d50a6506713452b1993e225ef20c75d0  agencyos-source.tar.gz

tar -xzf agencyos-source.tar.gz
cd agencyos
bun install  # or pnpm install
bun run db:push
bun run dev
```

## What's inside

- `apps/web`, `apps/app` — pnpm/Turborepo workspace packages for the two Vercel projects
- `packages/{database,auth,ui,domain,validation,config}` — shared monorepo packages
- `prisma/schema.prisma` — 1,462-line data model
- `supabase/migrations/0001`–`0009` — 2,824 lines of forward-only SQL with RLS, security-definer helpers, storage policies
- `supabase/config.toml`, `supabase/seed.sql` — local Supabase config and demo seed
- `src/` — Next.js 16 app source (180 TS/TSX files across 80 directories)
- `tests/unit`, `tests/integration`, `tests/security`, `tests/e2e` — 55 Vitest + 9 Playwright tests
- `docs/CURRENT_STATE.md`, `docs/adr/`, `docs/runbooks/`, `docs/product/` — documentation
- `AGENTS.md`, `README.md`, `.env.example` — operating guides
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `vitest.config.ts`, `playwright.config.ts`, `.prettierrc.json` — tooling config

## Verification commands

```bash
bunx prettier --check "**/*.{ts,tsx,js,jsx,json,md}"   # ✅ All matched files use Prettier code style
bun run lint                                            # ✅ ESLint passes (0 errors)
bunx tsc --noEmit                                       # ✅ No type errors
DATABASE_URL=file:db/test.db bunx vitest run            # ✅ 55 tests pass
bunx playwright test                                    # ✅ 9 tests pass
bun run build                                           # ✅ Production build succeeds
```
