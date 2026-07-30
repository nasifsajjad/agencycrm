# Runbook — Invitation problems

## Symptom

A user reports that an invitation link doesn't work, or accepts but doesn't add them to the workspace.

## Common causes

### Link expired

Invitations expire after 7 days. The accept-invite page shows "Invitation not found" if the link is expired.

**Resolution:** Owner resends the invitation from Settings → Members. Each resend rotates the token.

### Already accepted

Once `acceptedAt` is set, the invitation cannot be reused.

**Resolution:** Check `SELECT acceptedAt, acceptedByUserId FROM Invitation WHERE id = ?`. If accepted, the user is already a member — they should sign in normally.

### Revoked

`revokedAt` set by an admin disables the invitation.

**Resolution:** Owner sends a new invitation.

### Email mismatch

The invitation is bound to `emailNormalized`. If the user signs up with a different email, the accept-invite page rejects with "This invitation was sent to a different email address."

**Resolution:** User signs up with the exact invited email, or owner revokes and re-invites the new email.

### Token hash mismatch

The invitation `tokenHash` is bcrypt-hashed. The accept-invite flow iterates all pending invitations and compares with `bcrypt.compare(token, tokenHash)`. A malformed token (truncated, URL-decoded incorrectly) will not match.

**Resolution:** Verify the full token is in the URL query. If the link was copy-pasted incorrectly, owner resends.

## Atomic acceptance

Acceptance is wrapped in a transaction:

1. Find or create user
2. Create `WorkspaceMembership`
3. Create `MembershipRole` for each invited role
4. Set `acceptedAt` on the invitation
5. Emit audit event

If any step fails, the entire transaction rolls back — no orphaned membership without roles.

## Related

- `src/lib/invite-actions.ts`
- ADR 0002 — Tenant isolation
