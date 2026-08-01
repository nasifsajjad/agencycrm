-- A workspace owner is an authorization root. RLS cannot compare OLD and NEW
-- values, so enforce this invariant with a database trigger rather than a
-- self-referential policy expression.

create or replace function public.tg_workspace_identity_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Workspace ID cannot be changed';
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Workspace owner cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_identity_immutable on public.workspaces;
create trigger workspace_identity_immutable
  before update on public.workspaces
  for each row execute function public.tg_workspace_identity_immutable();

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
  using (private.has_permission(id, 'workspace.update'))
  with check (private.has_permission(id, 'workspace.update'));

-- User-initiated mutations enqueue their own tenant-scoped outbox events.
-- Processing remains service-role only because no update policy is granted.
create policy outbox_events_insert on public.outbox_events for insert to authenticated
  with check (private.is_workspace_member(workspace_id));
