-- 0028 — A health check that can actually succeed.
--
-- /api/health probed the database with, as an unauthenticated caller:
--
--   supabase.from("workspaces").select("id", { head: true, count: "exact" })
--
-- `anon` is granted only `usage` on schema public (0001:51), execute on
-- get_invitation (0012:18) and insert on marketing_inquiries (0013:22). It has
-- no SELECT on public.workspaces — 0007:91 grants table privileges to
-- `authenticated` only. So the probe raises "permission denied for table
-- workspaces", the route catches it, and every unauthenticated request to
-- /api/health returns 503 "degraded".
--
-- That is worse than having no health check. A load balancer, uptime monitor
-- or platform health probe would treat the application as permanently down
-- while it was serving traffic perfectly well. It failed closed in the one
-- place where failing closed is wrong.
--
-- Fix: a dedicated function that proves the database is reachable and the
-- schema is populated, without touching tenant data and without granting anon
-- read access to anything.

create or replace function public.health_check()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  permission_count integer;
begin
  -- The permissions catalogue is global, non-tenant, and seeded by 0009. A
  -- non-zero count proves the connection works AND that migrations actually
  -- ran, which a bare `select 1` would not.
  select count(*) into permission_count from public.permissions;

  return jsonb_build_object(
    'ok', permission_count > 0,
    'permissions', permission_count,
    'at', now()
  );
end;
$$;

-- Deliberately callable by anon: a health check that requires credentials
-- cannot be used by the things that need it.
--
-- Safe to expose because it returns no tenant data, takes no arguments, and
-- reads only the global permission catalogue. It reveals that the service is
-- up and migrated, which is the entire point.
revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated, service_role;

comment on function public.health_check() is
  'Liveness probe for /api/health. Returns no tenant data. Callable by anon by design — a health check behind authentication cannot serve a load balancer.';
