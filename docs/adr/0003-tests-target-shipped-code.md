# ADR 0003 — The test suite targets shipped code, not the orphaned root fork

**Date:** 2026-08-02
**Status:** Accepted
**Supersedes:** the test-resolution half of ADR 0001

## Context

The repository began as a single Next.js app rooted at `src/` and was later split
into a pnpm monorepo (`apps/web`, `apps/app`, `packages/*`). The split copied
`src/lib/*` into both apps but never removed the original, leaving three parallel
forks of the same modules.

`vitest.config.ts` continued to alias `@` to the root `src/` tree. Six of nine
vitest files import `@/lib/...`, so the suite was exercising the orphaned fork
rather than either deployed app. The forks had already diverged, and the
divergence was security-relevant:

- Root `src/lib/auth.ts` carried a hand-rolled `isSafeRedirect` that rejected
  only `//` prefixes and strings containing `:`.
- Shipped `apps/app/src/lib/auth.ts` delegates to `safeRedirectPath` in
  `@agencyos/config`, which additionally rejects backslashes, control
  characters, and percent-encoded forms of all of the above.

The suite was green against the weaker implementation. A regression in the
shipped one could not have been detected.

## Decision

`@` resolves to `apps/app/src`. `apps/app/src/lib` is a strict superset of
`src/lib`, so every existing import resolves without change. Coverage
configuration now measures `apps/app/src/lib/**` and `packages/*/src/**`.

Tests that assert on behaviour rather than on constants are preferred. Two
assertions were replaced because they could not fail:

- `format.test.ts` divided two local bigint literals and asserted the result was
  a bigint, never calling the module under test.
- `negative-authorization.test.ts` covered only the four redirect cases the weak
  implementation already handled.

## Consequences

Repointing immediately surfaced two real defects in `apps/app/src/lib/format.ts`
that the orphaned-fork suite had been hiding, both now fixed:

1. `formatMoney` converted `bigint` to `Number` and divided by 100 in floating
   point, silently rounding any amount above 2^53 minor units — in a module
   whose header comment promises no floating-point arithmetic on money.
2. `formatMoneyShort` compared minor-unit inputs against major-unit thresholds,
   so every abbreviated figure on the reports and dashboard pages was overstated
   by 100x. `$15,000` rendered as `$1.5M`.

The DB-backed tests under `tests/security/` fail rather than skip when Docker is
absent. This is deliberate; a security test that silently skips is worse than no
test, because it reports green.

The root `src/` tree is removed in ADR 0004. This ADR lands first so the tests
move to their new target before the old one disappears.
