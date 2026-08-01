-- AgencyOS — Migration 0019: suspended/revoked identities never retain owner bypass.

create or replace function private.has_permission(target_workspace_id uuid, permission_key text)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if exists (
    select 1
    from public.workspaces w
    join public.workspace_memberships m on m.workspace_id = w.id and m.user_id = auth.uid() and m.status = 'active'
    where w.id = target_workspace_id and w.owner_id = auth.uid()
  ) then return true; end if;
  return exists(
    select 1
    from public.workspace_memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.key = permission_key
  );
end;
$$;
