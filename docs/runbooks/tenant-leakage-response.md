# Runbook — Tenant leakage response

## Symptom

A user reports seeing data that does not belong to their workspace, or two workspaces appear to share records.

## Immediate containment

1. **Suspend the suspected source workspace** to prevent further writes:
   ```sql
   UPDATE WorkspaceMembership
   SET status = 'suspended'
   WHERE workspaceId = '<suspected_workspace_id>';
   ```
2. **Capture the audit log** for the affected period:
   ```sql
   SELECT * FROM AuditEvent
   WHERE workspaceId = '<suspected_workspace_id>'
     AND occurredAt > datetime('now', '-7 days')
   ORDER BY occurredAt DESC;
   ```
3. **Identify the leak vector** — review recent code changes, missing `workspaceId` filters, or accidental browser-supplied IDs.

## Root cause analysis

Common causes:

- Missing `workspaceId` in a `findMany` or `findFirst` query
- Browser-supplied `workspaceId` used directly in a mutation (should always be derived from `resolveWorkspace`)
- A Server Action that accepts an entity ID without verifying it belongs to the caller's workspace
- A portal query missing the `clientId` + `visibility: client` filter

## Remediation

1. Patch the leak vector — add the missing `workspaceId` filter or permission check.
2. Audit similar code paths for the same pattern.
3. Add an automated negative test for the specific scenario.
4. Notify affected users per your disclosure policy.

## Prevention

- Code review checklist: every tenant-owned query must include `workspaceId` from `ctx`.
- Future: RLS at the database layer (see ADR 0001 migration path).
- Future: automated negative tests (two-workspace, client, contractor, suspended, unauthenticated).

## Related

- ADR 0002 — Tenant isolation approach
- `docs/CURRENT_STATE.md` — security model status
