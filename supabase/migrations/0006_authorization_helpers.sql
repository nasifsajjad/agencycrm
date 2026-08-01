-- AgencyOS — Migration 0006: Private security-definer authorization helpers
-- Each function: explicit safe search_path, schema-qualified, no user-controlled dynamic SQL,
-- owned by a privileged role (postgres), execution revoked from public, granted only to authenticated.

-- Helper: current user's active memberships (workspace_id list)
create or replace function private.active_workspace_ids()
returns uuid[]
language sql
security definer set search_path = public, auth
as $$
  select coalesce(array_agg(workspace_id), '{}')
  from public.workspace_memberships
  where user_id = auth.uid() and status = 'active';
$$;

-- Helper: is the current user an active member of the given workspace?
create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer set search_path = public, auth
as $$
  select exists(
    select 1 from public.workspace_memberships
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- Helper: does the current user hold a permission key in the given workspace?
-- Owner is implicitly granted all permissions.
create or replace function private.has_permission(target_workspace_id uuid, permission_key text)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  is_owner boolean;
  has_role boolean;
begin
  -- Owner of the workspace gets all permissions
  select w.owner_id = auth.uid() into is_owner
  from public.workspaces w where w.id = target_workspace_id;
  if is_owner then return true; end if;

  -- Otherwise check role_permissions via membership_roles
  select exists(
    select 1
    from public.workspace_memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.key = permission_key
  ) into has_role;
  return has_role;
end;
$$;

-- Helper: is the current user a member with a specific role name?
create or replace function private.has_role(target_workspace_id uuid, role_name text)
returns boolean
language sql
security definer set search_path = public, auth
as $$
  select exists(
    select 1
    from public.workspace_memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.roles r on r.id = mr.role_id
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and r.name = role_name
  );
$$;

-- Helper: can the current user access a given client (and via which portal, if any)?
create or replace function private.can_access_client(target_client_id uuid)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  ws uuid;
  is_member boolean;
  portal_count integer;
begin
  select workspace_id into ws from public.clients where id = target_client_id;
  if ws is null then return false; end if;

  -- If user is an active workspace member, they can access (subject to other policies)
  select private.is_workspace_member(ws) into is_member;
  if is_member then return true; end if;

  -- Otherwise: is there a client portal for this client whose contact has a portal_access link to this user's identity?
  -- The portal identity is stored on contacts.portal_identity_id (set when a portal user is provisioned).
  select count(*) into portal_count
  from public.client_portals cp
  join public.client_contacts cc on cc.client_id = cp.client_id
  join public.contacts c on c.id = cc.contact_id
  where cp.client_id = target_client_id
    and cc.portal_access = true
    and c.portal_identity_id = auth.uid();

  return portal_count > 0;
end;
$$;

-- Helper: can the current user access a given project?
create or replace function private.can_access_project(target_project_id uuid)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  ws uuid;
  visibility_val visibility;
  is_member boolean;
  portal_count integer;
begin
  select workspace_id, visibility into ws, visibility_val from public.projects where id = target_project_id;
  if ws is null then return false; end if;
  select private.is_workspace_member(ws) into is_member;
  if is_member then return true; end if;
  -- Non-members only see projects with visibility = 'client' that belong to a client they can access
  if visibility_val <> 'client' then return false; end if;
  select count(*) into portal_count
  from public.projects p
  join public.clients c on c.id = p.client_id
  where p.id = target_project_id and private.can_access_client(c.id);
  return portal_count > 0;
end;
$$;

-- Helper: can the current user access a generic entity?
-- Falls back to workspace membership for non-portal entities.
create or replace function private.can_access_entity(target_type text, target_id uuid)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  ws uuid;
begin
  -- Try to resolve workspace_id for common entity types
  case target_type
    when 'contact' then select workspace_id into ws from public.contacts where id = target_id;
    when 'company' then select workspace_id into ws from public.companies where id = target_id;
    when 'lead' then select workspace_id into ws from public.leads where id = target_id;
    when 'deal' then select workspace_id into ws from public.deals where id = target_id;
    when 'client' then return private.can_access_client(target_id);
    when 'project' then return private.can_access_project(target_id);
    when 'task' then select workspace_id into ws from public.tasks where id = target_id;
    when 'campaign' then select workspace_id into ws from public.campaigns where id = target_id;
    when 'deliverable' then select workspace_id into ws from public.deliverables where id = target_id;
    when 'approval' then select workspace_id into ws from public.approval_requests where id = target_id;
    when 'time_entry' then select workspace_id into ws from public.time_entries where id = target_id;
    when 'invoice' then select workspace_id into ws from public.invoices where id = target_id;
    else return false;
  end case;
  if ws is null then return false; end if;
  return private.is_workspace_member(ws);
end;
$$;

-- Helper: insert an audit event
create or replace function private.record_audit(
  p_workspace_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb,
  p_ip_hash text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer set search_path = audit, public, auth
as $$
declare
  ev_id uuid;
begin
  insert into audit.events (
    workspace_id, actor_user_id, action, entity_type, entity_id,
    before_json, after_json, ip_hash, user_agent_summary
  ) values (
    p_workspace_id, auth.uid(), p_action, p_entity_type, p_entity_id,
    p_before, p_after, p_ip_hash, p_user_agent
  ) returning id into ev_id;
  return ev_id;
end;
$$;

-- Revoke execution from public; grant only to authenticated
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant usage on schema private to authenticated;

-- Audit schema: grant select only to workspace members via RLS-equivalent helper (read-only to ordinary users)
revoke all on schema audit from public, anon;
grant usage on schema audit to authenticated;
grant select on audit.events to authenticated;
revoke insert, update, delete on audit.events from authenticated, anon;
