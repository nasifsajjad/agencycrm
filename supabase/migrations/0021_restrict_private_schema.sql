-- 0021 — Restrict the `private` schema to its intended internal callers.
--
-- Problem
-- -------
-- Two separate mistakes combined into a live cross-tenant hole:
--
--   1. supabase/config.toml exposed `private` in the PostgREST `schemas` list,
--      making every function in it reachable as an HTTP RPC endpoint.
--
--   2. 0006 ended with a blanket
--        grant execute on all functions in schema private to authenticated;
--      and 0009:252 additionally granted private.bootstrap_default_workspace
--      to `authenticated` by name.
--
-- Together these exposed two functions that trust their arguments and perform
-- no authorization of their own, because they were written on the assumption
-- that only a SECURITY DEFINER wrapper could ever reach them:
--
--   * private.record_audit(...) inserts into audit.events for whatever
--     p_workspace_id it is handed. public.record_audit (0010) exists precisely
--     to check membership first; calling the private one skips that check.
--     Any authenticated user could forge audit entries in any other tenant.
--
--   * private.bootstrap_default_workspace(...) inserts an ACTIVE membership row
--     with the Owner role for the p_owner_id it is handed (0009:193-198), with
--     no check that auth.uid() relates to either argument. Its only intended
--     caller is public.create_workspace, immediately after creating a workspace
--     the caller demonstrably owns.
--
-- A third, quieter issue: PostgreSQL grants EXECUTE on new functions to PUBLIC
-- by default. 0006's `revoke ... from public` only covered functions that
-- existed at that moment, so private functions created later in 0008, 0009 and
-- 0017 were PUBLIC-executable regardless of the explicit grants.
--
-- Fix
-- ---
-- Revoke broadly, then re-grant EXECUTE only on the read-only predicates that
-- RLS policies must be able to evaluate. RLS policy expressions run with the
-- privileges of the querying role, so `authenticated` genuinely needs EXECUTE
-- on those predicates and USAGE on the schema — that part is not optional and
-- is deliberately preserved.
--
-- The two dangerous functions keep no grant at all. SECURITY DEFINER wrappers
-- execute as the function owner, which retains implicit EXECUTE, so
-- public.record_audit, public.create_workspace, public.accept_invitation,
-- public.decide_approval and public.convert_deal_to_client all keep working.
-- A direct call by an ordinary role now fails with a privilege error.
--
-- Deliberately NOT done: an authorization check inside private.record_audit.
-- It cannot be written correctly at that layer. `current_user` is rewritten to
-- the owner under SECURITY DEFINER, and `session_user` under PostgREST is the
-- connection role `authenticator` rather than `authenticated`, so neither
-- distinguishes an internal caller from a direct one. An unconditional
-- membership check would be wrong in the other direction: decide_approval and
-- create_client_request are legitimately invoked by client-portal identities,
-- who are not workspace members by design. Privilege is the correct control,
-- and it is complete on its own.
--
-- The matching config.toml change removes `private` from the exposed API
-- schemas, so these functions are not addressable over HTTP at all. Both
-- layers are applied; neither is relied on alone.

-- ---------------------------------------------------------------------------
-- 1. Reset every privilege on the schema's functions.
-- ---------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;

-- Future functions in this schema must not be PUBLIC-executable by default.
alter default privileges in schema private revoke execute on functions from public;
alter default privileges for role postgres in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- 2. Schema usage. RLS policies reference private.* with a qualified name, so
--    `authenticated` needs USAGE for policy evaluation to succeed at all.
-- ---------------------------------------------------------------------------
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Re-grant EXECUTE only on side-effect-free predicates used by RLS policies
--    and storage policies. Each derives identity from auth.uid() internally and
--    cannot be steered by a caller-supplied actor.
--
--    private.has_permission is referenced by 210 policy expressions and
--    is_workspace_member by 97; omitting either would deny every read in the
--    product rather than fail closed on one table.
-- ---------------------------------------------------------------------------
grant execute on function private.active_workspace_ids() to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.has_role(uuid, text) to authenticated;
grant execute on function private.can_access_client(uuid) to authenticated;
grant execute on function private.can_access_project(uuid) to authenticated;
grant execute on function private.can_access_entity(text, uuid) to authenticated;
grant execute on function private.can_access_storage_object(text, text) to authenticated;
grant execute on function private.workspace_id_from_path(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The two argument-trusting functions keep no application-role grant.
--    Restated explicitly so the intent survives a future `on all functions`
--    grant being reintroduced above them.
-- ---------------------------------------------------------------------------
revoke all on function private.record_audit(uuid, text, text, uuid, jsonb, jsonb, text, text)
  from public, anon, authenticated;

revoke all on function private.bootstrap_default_workspace(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;

comment on function private.record_audit(uuid, text, text, uuid, jsonb, jsonb, text, text) is
  'Internal. Trusts p_workspace_id. Call public.record_audit instead, which verifies membership first. No EXECUTE grant is issued to application roles.';

comment on function private.bootstrap_default_workspace(uuid, uuid, text, text, text, text) is
  'Internal. Grants an active Owner membership from its arguments with no check on auth.uid(), so it must never be callable directly. Sole intended caller is public.create_workspace. No EXECUTE grant is issued to application roles.';

comment on schema private is
  'Internal helpers. Must NOT appear in the PostgREST exposed-schema list. Grant EXECUTE per function, never with `on all functions`.';
