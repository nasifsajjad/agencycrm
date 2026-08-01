-- 0022 — Two over-permissive grants.
--
-- A. public.cleanup_expired_jobs was destructive, unscoped, and granted to
--    every authenticated user.
-- B. dashboard_widgets policies asked only for workspace membership, ignoring
--    the ownership and visibility rules that the parent dashboards table
--    already enforces.

-- ---------------------------------------------------------------------------
-- A. cleanup_expired_jobs
--
-- 0009:285-300 defines it as SECURITY DEFINER with the body
--     delete from public.export_jobs where expires_at < now();
-- and then grants EXECUTE to `authenticated` (0009:300).
--
-- There is no workspace filter and no permission check, so any logged-in user
-- of any tenant could call it over PostgREST and delete every expired export
-- job belonging to every other tenant. The comment above it says it is meant
-- to run from pg_cron; nothing enforced that.
--
-- It stays a maintenance routine, so the fix is to restrict it to the roles
-- that actually run maintenance. pg_cron jobs execute as the scheduling
-- superuser and are unaffected by revoking application roles.
-- ---------------------------------------------------------------------------
revoke all on function public.cleanup_expired_jobs() from public, anon, authenticated;
grant execute on function public.cleanup_expired_jobs() to service_role;

comment on function public.cleanup_expired_jobs() is
  'Maintenance only. Deletes expired export jobs across all workspaces, so it must never be callable by an application role. Intended to run from pg_cron or a trusted worker using service_role.';

-- ---------------------------------------------------------------------------
-- B. dashboard_widgets
--
-- The dashboards table distinguishes private from shared dashboards and
-- restricts edits to the owner or settings.manage:
--
--   dashboards_select  visibility <> 'private' or owner_user_id = auth.uid()
--   dashboards_update  owner_user_id = auth.uid() or has_permission('settings.manage')
--   dashboards_delete  owner_user_id = auth.uid() or has_permission('settings.manage')
--
-- The widget policies (0007:706-713) checked only is_workspace_member on the
-- parent dashboard's workspace. Consequences, both confirmed by reading the
-- policies rather than inferred:
--
--   * read  — any member could read the widgets of another member's PRIVATE
--             dashboard, defeating the point of `visibility = 'private'`.
--   * write — any member could add, alter or delete widgets on any dashboard
--             in the workspace, including private ones and workspace defaults.
--
-- Widgets are components of a dashboard, not independent records, so each
-- policy now inherits the corresponding dashboard rule.
-- ---------------------------------------------------------------------------
drop policy if exists dashboard_widgets_select on public.dashboard_widgets;
drop policy if exists dashboard_widgets_insert on public.dashboard_widgets;
drop policy if exists dashboard_widgets_update on public.dashboard_widgets;
drop policy if exists dashboard_widgets_delete on public.dashboard_widgets;

-- Readable exactly when the parent dashboard is readable.
create policy dashboard_widgets_select on public.dashboard_widgets for select to authenticated
  using (
    exists (
      select 1 from public.dashboards d
      where d.id = dashboard_id
        and private.is_workspace_member(d.workspace_id)
        and (d.visibility <> 'private' or d.owner_user_id = auth.uid())
    )
  );

-- Writable exactly when the parent dashboard is writable.
create policy dashboard_widgets_insert on public.dashboard_widgets for insert to authenticated
  with check (
    exists (
      select 1 from public.dashboards d
      where d.id = dashboard_id
        and private.is_workspace_member(d.workspace_id)
        and (d.owner_user_id = auth.uid() or private.has_permission(d.workspace_id, 'settings.manage'))
    )
  );

create policy dashboard_widgets_update on public.dashboard_widgets for update to authenticated
  using (
    exists (
      select 1 from public.dashboards d
      where d.id = dashboard_id
        and private.is_workspace_member(d.workspace_id)
        and (d.owner_user_id = auth.uid() or private.has_permission(d.workspace_id, 'settings.manage'))
    )
  )
  with check (
    exists (
      select 1 from public.dashboards d
      where d.id = dashboard_id
        and private.is_workspace_member(d.workspace_id)
        and (d.owner_user_id = auth.uid() or private.has_permission(d.workspace_id, 'settings.manage'))
    )
  );

create policy dashboard_widgets_delete on public.dashboard_widgets for delete to authenticated
  using (
    exists (
      select 1 from public.dashboards d
      where d.id = dashboard_id
        and private.is_workspace_member(d.workspace_id)
        and (d.owner_user_id = auth.uid() or private.has_permission(d.workspace_id, 'settings.manage'))
    )
  );

-- The UPDATE policy's WITH CHECK also blocks re-parenting a widget onto a
-- dashboard the caller may not edit, which the previous membership-only rule
-- permitted.
