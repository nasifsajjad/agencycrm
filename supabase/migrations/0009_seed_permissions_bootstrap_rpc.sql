-- AgencyOS — Migration 0009: Seed permission catalogue, default workspace bootstrap RPC, scheduled cleanup

-- Seed permissions catalogue (idempotent)
insert into public.permissions (key, description) values
  ('workspace.read', 'Read workspace'),
  ('workspace.update', 'Update workspace settings'),
  ('workspace.delete', 'Delete workspace'),
  ('members.read', 'List members'),
  ('members.invite', 'Invite members'),
  ('members.update', 'Update membership'),
  ('members.remove', 'Remove members'),
  ('roles.read', 'Read roles'),
  ('roles.manage', 'Manage roles and permissions'),
  ('teams.read', 'Read teams'),
  ('teams.manage', 'Manage teams'),
  ('audit.read', 'Read audit log'),
  ('crm.read', 'Read CRM records'),
  ('crm.create', 'Create CRM records'),
  ('crm.update', 'Update CRM records'),
  ('crm.delete', 'Delete CRM records'),
  ('crm.export', 'Export CRM data'),
  ('clients.read', 'Read clients'),
  ('clients.create', 'Create clients'),
  ('clients.update', 'Update clients'),
  ('clients.delete', 'Delete clients'),
  ('projects.read', 'Read projects'),
  ('projects.create', 'Create projects'),
  ('projects.update', 'Update projects'),
  ('projects.delete', 'Delete projects'),
  ('tasks.read', 'Read tasks'),
  ('tasks.create', 'Create tasks'),
  ('tasks.update', 'Update tasks'),
  ('tasks.delete', 'Delete tasks'),
  ('tasks.assign', 'Assign tasks'),
  ('campaigns.read', 'Read campaigns'),
  ('campaigns.manage', 'Manage campaigns'),
  ('content.read', 'Read content'),
  ('content.manage', 'Manage content'),
  ('files.read', 'Read files'),
  ('files.upload', 'Upload files'),
  ('files.delete', 'Delete files'),
  ('comments.read', 'Read comments'),
  ('comments.create', 'Create comments'),
  ('comments.moderate', 'Moderate comments'),
  ('approvals.read', 'Read approvals'),
  ('approvals.request', 'Request approvals'),
  ('approvals.decide', 'Decide approvals'),
  ('time.read_own', 'Read own time entries'),
  ('time.manage_own', 'Manage own time entries'),
  ('time.read_all', 'Read all time entries'),
  ('time.approve', 'Approve timesheets'),
  ('finance.read', 'Read finance'),
  ('finance.manage', 'Manage finance'),
  ('finance.export', 'Export finance'),
  ('reports.read', 'Read reports'),
  ('reports.create', 'Create reports'),
  ('reports.share', 'Share reports'),
  ('automations.read', 'Read automations'),
  ('automations.manage', 'Manage automations'),
  ('settings.read', 'Read settings'),
  ('settings.manage', 'Manage settings'),
  ('integrations.read', 'Read integrations'),
  ('integrations.manage', 'Manage integrations'),
  ('portal.manage', 'Manage client portal'),
  ('exports.create', 'Create exports')
on conflict (key) do nothing;

-- Default role → permission map (matches src/lib/permissions.ts ROLE_PERMISSIONS)
create or replace function private.bootstrap_default_workspace(p_workspace_id uuid, p_owner_id uuid, p_name text, p_slug text, p_currency text, p_timezone text)
returns void
language plpgsql
security definer set search_path = public, auth
as $$
declare
  owner_role_id uuid;
  admin_role_id uuid;
  ops_role_id uuid;
  sales_role_id uuid;
  am_role_id uuid;
  member_role_id uuid;
  contractor_role_id uuid;
  finance_role_id uuid;
  client_role_id uuid;
  guest_role_id uuid;
  owner_membership_id uuid;
  pipeline_id uuid;
  ws_settings jsonb;
begin
  -- Update workspace settings
  ws_settings := jsonb_build_object('density', 'comfortable', 'theme', 'system');
  update public.workspaces set currency = p_currency, timezone = p_timezone, settings_json = ws_settings where id = p_workspace_id;

  -- Create system roles
  insert into public.roles (workspace_id, name, description, is_system) values
    (p_workspace_id, 'Owner', 'Workspace owner', true),
    (p_workspace_id, 'Administrator', 'Workspace administrator', true),
    (p_workspace_id, 'Operations', 'Operations team', true),
    (p_workspace_id, 'Sales', 'Sales team', true),
    (p_workspace_id, 'Account Manager', 'Account management', true),
    (p_workspace_id, 'Team Member', 'Default team member', true),
    (p_workspace_id, 'Contractor', 'Restricted contractor', true),
    (p_workspace_id, 'Finance', 'Finance team', true),
    (p_workspace_id, 'Client', 'Client portal user', true),
    (p_workspace_id, 'Guest Reviewer', 'Limited reviewer', true)
  returning id into owner_role_id;

  select id into owner_role_id from public.roles where workspace_id = p_workspace_id and name = 'Owner';
  select id into admin_role_id from public.roles where workspace_id = p_workspace_id and name = 'Administrator';
  select id into ops_role_id from public.roles where workspace_id = p_workspace_id and name = 'Operations';
  select id into sales_role_id from public.roles where workspace_id = p_workspace_id and name = 'Sales';
  select id into am_role_id from public.roles where workspace_id = p_workspace_id and name = 'Account Manager';
  select id into member_role_id from public.roles where workspace_id = p_workspace_id and name = 'Team Member';
  select id into contractor_role_id from public.roles where workspace_id = p_workspace_id and name = 'Contractor';
  select id into finance_role_id from public.roles where workspace_id = p_workspace_id and name = 'Finance';
  select id into client_role_id from public.roles where workspace_id = p_workspace_id and name = 'Client';
  select id into guest_role_id from public.roles where workspace_id = p_workspace_id and name = 'Guest Reviewer';

  -- Owner: all permissions (minus workspace.delete per contract)
  insert into public.role_permissions (role_id, permission_id)
  select owner_role_id, id from public.permissions where key <> 'workspace.delete'
  on conflict do nothing;

  -- Administrator: all except workspace.delete
  insert into public.role_permissions (role_id, permission_id)
  select admin_role_id, id from public.permissions where key <> 'workspace.delete'
  on conflict do nothing;

  -- Operations: subset
  insert into public.role_permissions (role_id, permission_id)
  select ops_role_id, p.id from public.permissions p
  where p.key in ('workspace.read','members.read','roles.read','teams.read','audit.read',
    'crm.read','clients.read','clients.update','projects.read','projects.create','projects.update',
    'tasks.read','tasks.create','tasks.update','tasks.assign','campaigns.read','campaigns.manage',
    'content.read','content.manage','files.read','files.upload','comments.read','comments.create',
    'approvals.read','approvals.request','time.read_all','time.approve','finance.read',
    'reports.read','reports.create','settings.read')
  on conflict do nothing;

  -- Sales
  insert into public.role_permissions (role_id, permission_id)
  select sales_role_id, p.id from public.permissions p
  where p.key in ('workspace.read','members.read','crm.read','crm.create','crm.update','crm.export',
    'clients.read','clients.create','projects.read','tasks.read','tasks.create','tasks.update',
    'files.read','files.upload','comments.read','comments.create','approvals.read','approvals.request',
    'time.read_own','time.manage_own','reports.read')
  on conflict do nothing;

  -- Account Manager
  insert into public.role_permissions (role_id, permission_id)
  select am_role_id, p.id from public.permissions p
  where p.key in ('workspace.read','members.read','crm.read','crm.update','clients.read','clients.create',
    'clients.update','projects.read','projects.create','projects.update','tasks.read','tasks.create',
    'tasks.update','tasks.assign','campaigns.read','content.read','files.read','files.upload',
    'comments.read','comments.create','approvals.read','approvals.request','approvals.decide',
    'time.read_own','time.manage_own','finance.read','reports.read','reports.share')
  on conflict do nothing;

  -- Team Member
  insert into public.role_permissions (role_id, permission_id)
  select member_role_id, p.id from public.permissions p
  where p.key in ('workspace.read','members.read','crm.read','clients.read','projects.read','tasks.read',
    'tasks.create','tasks.update','campaigns.read','content.read','content.manage','files.read',
    'files.upload','comments.read','comments.create','approvals.read','approvals.request',
    'time.read_own','time.manage_own','reports.read')
  on conflict do nothing;

  -- Contractor (restricted)
  insert into public.role_permissions (role_id, permission_id)
  select contractor_role_id, p.id from public.permissions p
  where p.key in ('workspace.read','projects.read','tasks.read','tasks.update','files.read','files.upload',
    'comments.read','comments.create','approvals.read','time.read_own','time.manage_own')
  on conflict do nothing;

  -- Finance
  insert into public.role_permissions (role_id, permission_id)
  select finance_role_id, p.id from public.permissions p
  where p.key in ('workspace.read','members.read','clients.read','projects.read','finance.read',
    'finance.manage','finance.export','reports.read','reports.create','audit.read')
  on conflict do nothing;

  -- Client (portal)
  insert into public.role_permissions (role_id, permission_id)
  select client_role_id, p.id from public.permissions p
  where p.key in ('workspace.read','files.read','comments.read','comments.create','approvals.read','approvals.decide')
  on conflict do nothing;

  -- Guest Reviewer
  insert into public.role_permissions (role_id, permission_id)
  select guest_role_id, p.id from public.permissions p
  where p.key in ('approvals.read','approvals.decide','files.read','comments.read','comments.create')
  on conflict do nothing;

  -- Owner membership
  insert into public.workspace_memberships (workspace_id, user_id, status, title)
  values (p_workspace_id, p_owner_id, 'active', 'Owner')
  returning id into owner_membership_id;

  insert into public.membership_roles (membership_id, role_id) values (owner_membership_id, owner_role_id);

  -- Default pipeline
  insert into public.pipelines (workspace_id, name, entity_type, is_default)
  values (p_workspace_id, 'Sales Pipeline', 'deal', true)
  returning id into pipeline_id;

  insert into public.pipeline_stages (pipeline_id, name, position, probability, color, is_closed, is_won) values
    (pipeline_id, 'Lead', 0, 10, '#94a3b8', false, false),
    (pipeline_id, 'Qualified', 1, 25, '#3b82f6', false, false),
    (pipeline_id, 'Proposal', 2, 50, '#8b5cf6', false, false),
    (pipeline_id, 'Negotiation', 3, 75, '#f59e0b', false, false),
    (pipeline_id, 'Won', 4, 100, '#10b981', true, true),
    (pipeline_id, 'Lost', 5, 0, '#ef4444', true, false);

  -- Default project statuses
  insert into public.project_statuses (workspace_id, name, position, color, category) values
    (p_workspace_id, 'Planning', 0, '#64748b', 'planning'),
    (p_workspace_id, 'In Progress', 1, '#3b82f6', 'active'),
    (p_workspace_id, 'On Hold', 2, '#f59e0b', 'on_hold'),
    (p_workspace_id, 'Completed', 3, '#10b981', 'done'),
    (p_workspace_id, 'Cancelled', 4, '#ef4444', 'cancelled');

  -- Default task statuses
  insert into public.task_statuses (workspace_id, name, position, color, category) values
    (p_workspace_id, 'Backlog', 0, '#64748b', 'todo'),
    (p_workspace_id, 'To Do', 1, '#94a3b8', 'todo'),
    (p_workspace_id, 'In Progress', 2, '#3b82f6', 'in_progress'),
    (p_workspace_id, 'In Review', 3, '#8b5cf6', 'in_progress'),
    (p_workspace_id, 'Done', 4, '#10b981', 'done'),
    (p_workspace_id, 'Blocked', 5, '#ef4444', 'blocked');

  -- Default services
  insert into public.services (workspace_id, name, default_rate_minor, billing_unit) values
    (p_workspace_id, 'Strategy Consulting', 25000, 'hour'),
    (p_workspace_id, 'Creative Production', 18000, 'hour'),
    (p_workspace_id, 'Campaign Management', 15000, 'hour'),
    (p_workspace_id, 'SEO', 12000, 'hour'),
    (p_workspace_id, 'Paid Media', 14000, 'hour');

  -- Default feature flags
  insert into public.feature_flags (workspace_id, key, enabled) values
    (p_workspace_id, 'crm', true),
    (p_workspace_id, 'projects', true),
    (p_workspace_id, 'approvals', true),
    (p_workspace_id, 'time_tracking', true),
    (p_workspace_id, 'finance', true),
    (p_workspace_id, 'portal', true),
    (p_workspace_id, 'automations', false),
    (p_workspace_id, 'ai_assistant', false);
end;
$$;

revoke all on function private.bootstrap_default_workspace(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function private.bootstrap_default_workspace(uuid, uuid, text, text, text, text) to authenticated;

-- Public RPC: create_workspace (atomic, owner-invoked)
create or replace function public.create_workspace(p_name text, p_slug text, p_currency text, p_timezone text)
returns uuid
language plpgsql
security definer set search_path = public, auth
as $$
declare
  ws_id uuid;
  owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Not authenticated'; end if;
  if p_name is null or p_slug is null then raise exception 'Name and slug are required'; end if;
  if not regexp_match(p_slug, '^[a-z0-9-]{2,40}$') then raise exception 'Invalid slug'; end if;

  insert into public.workspaces (name, slug, owner_id, currency, timezone)
  values (p_name, p_slug, owner_id, coalesce(p_currency, 'USD'), coalesce(p_timezone, 'UTC'))
  returning id into ws_id;

  perform private.bootstrap_default_workspace(ws_id, owner_id, p_name, p_slug, coalesce(p_currency, 'USD'), coalesce(p_timezone, 'UTC'));

  perform private.record_audit(ws_id, 'workspace.created', 'workspace', ws_id, null, jsonb_build_object('name', p_name, 'slug', p_slug), null, null);

  return ws_id;
end;
$$;

revoke all on function public.create_workspace(text, text, text, text) from public, anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;

-- Scheduled cleanup: expired export jobs and orphaned outbox events.
-- Run via pg_cron in production (e.g. select cron.schedule('agencyos-cleanup', '0 * * * *', 'select public.cleanup_expired_jobs()');)
create or replace function public.cleanup_expired_jobs()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.export_jobs where expires_at is not null and expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_jobs() from public, anon;
grant execute on function public.cleanup_expired_jobs() to authenticated;

-- Revoke default privileges from anon/authenticated on private schema
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- Revoke all on audit schema (only select via policy)
revoke all on schema audit from anon;
grant usage on schema audit to authenticated;
grant select on audit.events to authenticated;
