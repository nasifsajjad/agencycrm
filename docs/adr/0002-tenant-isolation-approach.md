# ADR 0002 — Application-layer tenant isolation

**Date:** 2026-07-30
**Status:** Accepted

## Context

The contract requires "database-enforced tenant isolation" via RLS. In the sandbox (SQLite + Prisma), there is no RLS. We need an equivalent invariant.

## Decision

Enforce tenant isolation at the application layer with these rules:

1. **Single entry point:** All workspace-scoped server code calls `resolveWorkspace(workspaceSlug)` from `src/lib/server.ts`. This helper:
   - Gets the current user from the session cookie
   - Looks up the workspace by slug
   - Verifies the user has an active membership
   - Returns a `WorkspaceContext` carrying `workspaceId`, `userId`, `membershipId`, `roles`, `permissions`, `isOwner`

2. **Every query includes `workspaceId`:** All tenant-owned `db.<entity>.find*` calls include `where: { workspaceId: ctx.workspaceId, ... }`. No exceptions.

3. **Every mutation re-derives `ctx`:** Server Actions accept the workspace slug (not the workspace ID) and re-resolve the context. Browser-supplied IDs are never trusted for authorization — only for locating the record within the authorized workspace.

4. **Cross-workspace relationship guards:** When inserting or updating a child record, the parent must be in the same workspace. Server Actions explicitly query the parent first with `workspaceId` filter before creating the child.

5. **Portal isolation:** Portal routes resolve the portal by slug, then filter all queries by `clientId` AND `visibility: "client"`. Portal users never see internal comments, finance, or other clients.

## Consequences

- **Positive:** Isolation is enforced. A missing `workspaceId` filter is a visible code smell in review.
- **Negative:** No database-level safety net. A bug in application code could leak data. Mitigation: code review discipline + future RLS migration (see ADR 0001).
- **Negative:** Performance: every request resolves the workspace context (1–2 queries). Acceptable for now; can be cached via session claims later.

## Verification

Manual smoke tests performed:

- Sign in as user A in workspace A → cannot access workspace B's URL (`/w/<B-slug>`) — redirected to `/app`
- Portal user at `/portal/aurora-portal` cannot see Helix client records
- API endpoints reject unauthenticated requests

Automated negative tests are a follow-up (see `CURRENT_STATE.md`).
