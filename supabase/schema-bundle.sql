-- ===========================================================================
-- AgencyOS — complete schema bundle
--
-- Generated from supabase/migrations/*.sql (28 files, in order).
-- Paste into the Supabase SQL Editor and run once, on a NEW project.
--
-- This is equivalent to `supabase db push`. It is written to be re-runnable:
-- every migration uses IF NOT EXISTS / CREATE OR REPLACE / drop-then-create,
-- so running it twice is safe.
--
-- After this succeeds, record the migrations as applied so a later
-- `supabase db push` does not try to re-run them — the final block does that
-- for you.
-- ===========================================================================


-- ===========================================================================
-- 0001_extensions_schemas.sql
-- ===========================================================================
-- AgencyOS — Migration 0001: Extensions, schemas, and enums
-- Forward-only migration. Applies to a fresh Supabase Postgres database.

-- Required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "btree_gin";

-- Schemas
create schema if not exists public;
create schema if not exists private;  -- security-definer helpers, internal tables
create schema if not exists audit;    -- append-only audit events
create schema if not exists storage;  -- Supabase Storage (managed)

-- Stable enums for genuinely stable states
do $$ begin
  create type membership_status as enum ('active', 'suspended', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending', 'approved', 'changes_requested', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type time_entry_status as enum ('open', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  -- This enum is used by both record sharing and user-configurable views.
  -- Keep every value used by the schema here; a narrower record-only enum
  -- made the fresh migration fail when saved views/dashboards were created.
  create type visibility as enum ('internal', 'client', 'restricted', 'private', 'workspace');
exception when duplicate_object then null; end $$;

do $$ begin
  create type import_job_status as enum ('pending', 'validating', 'running', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type automation_run_status as enum ('pending', 'running', 'succeeded', 'failed', 'dead_letter');
exception when duplicate_object then null; end $$;

-- Default privileges: revoke from anon/authenticated for private schema
revoke all on schema private from public, anon, authenticated;
revoke all on schema audit from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ===========================================================================
-- 0002_identity_tenancy.sql
-- ===========================================================================
-- AgencyOS — Migration 0002: Identity & tenancy
-- Forward-only.

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  email_normalized text not null unique,
  display_name text,
  avatar_path text,
  locale text not null default 'en',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

create index if not exists profiles_email_normalized_idx on public.profiles(email_normalized);

-- Trigger: auto-create profile when auth.users row is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, auth
as $$
begin
  insert into public.profiles (user_id, email, email_normalized, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    lower(trim(coalesce(new.email, ''))),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: auto-update updated_at
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'UTC',
  currency text not null default 'USD',
  locale text not null default 'en',
  logo_path text,
  settings_json jsonb,
  owner_id uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on public.workspaces(owner_id);
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.tg_set_updated_at();

-- Ownership is immutable after workspace creation. The previous RLS policy
-- attempted to compare against the table row with an unqualified `id = id`,
-- which is tautological and allowed a privileged editor to transfer ownership.
create or replace function public.tg_preserve_workspace_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Workspace owner cannot be changed';
  end if;
  return new;
end;
$$;
create trigger workspaces_owner_immutable before update on public.workspaces
  for each row execute function public.tg_preserve_workspace_owner();

-- Permissions catalogue (stable keys)
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text
);

-- Roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists roles_workspace_id_idx on public.roles(workspace_id);
create trigger roles_updated_at before update on public.roles
  for each row execute function public.tg_set_updated_at();

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Workspace memberships
create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  status membership_status not null default 'active',
  title text,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists memberships_user_id_idx on public.workspace_memberships(user_id);
create index if not exists memberships_workspace_id_idx on public.workspace_memberships(workspace_id);
create trigger memberships_updated_at before update on public.workspace_memberships
  for each row execute function public.tg_set_updated_at();

create table if not exists public.membership_roles (
  membership_id uuid not null references public.workspace_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (membership_id, role_id)
);

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create trigger teams_updated_at before update on public.teams
  for each row execute function public.tg_set_updated_at();

create table if not exists public.team_memberships (
  team_id uuid not null references public.teams(id) on delete cascade,
  membership_id uuid not null references public.workspace_memberships(id) on delete cascade,
  primary key (team_id, membership_id)
);

-- Invitations
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email_normalized text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invitations_workspace_email_idx on public.invitations(workspace_id, email_normalized);
create trigger invitations_updated_at before update on public.invitations
  for each row execute function public.tg_set_updated_at();

create table if not exists public.invitation_roles (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (invitation_id, role_id)
);

create table if not exists public.invitation_teams (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (invitation_id, team_id)
);

-- Feature flags
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  config_json jsonb,
  unique (workspace_id, key)
);

-- Workspace preferences (per user)
create table if not exists public.workspace_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  preferences_json jsonb,
  unique (workspace_id, user_id)
);

-- Audit events (in audit schema, append-only to ordinary users)
create table if not exists audit.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(user_id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip_hash text,
  user_agent_summary text,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_workspace_occurred_idx on audit.events(workspace_id, occurred_at desc);
create index if not exists audit_events_entity_idx on audit.events(entity_type, entity_id);

-- ===========================================================================
-- 0003_crm.sql
-- ===========================================================================
-- AgencyOS — Migration 0003: CRM tables
-- Forward-only. Every tenant-owned row has workspace_id.

-- Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  domain text,
  website text,
  industry text,
  size_band text,
  phone text,
  owner_user_id uuid references public.profiles(user_id),
  lifecycle_stage text not null default 'lead',
  address_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists companies_workspace_name_idx on public.companies(workspace_id, name);
create index if not exists companies_workspace_owner_idx on public.companies(workspace_id, owner_user_id);
create index if not exists companies_domain_trgm on public.companies using gin (domain gin_trgm_ops);
create trigger companies_updated_at before update on public.companies
  for each row execute function public.tg_set_updated_at();

-- Contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id),
  first_name text,
  last_name text,
  email text,
  phone text,
  job_title text,
  owner_user_id uuid references public.profiles(user_id),
  lifecycle_stage text not null default 'lead',
  marketing_consent boolean not null default false,
  portal_identity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists contacts_workspace_email_idx on public.contacts(workspace_id, email);
create index if not exists contacts_workspace_owner_idx on public.contacts(workspace_id, owner_user_id);
create index if not exists contacts_name_trgm on public.contacts using gin (first_name gin_trgm_ops, last_name gin_trgm_ops);
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.tg_set_updated_at();

-- Same-workspace guard: contact.company_id must belong to same workspace
create or replace function public.tg_contacts_same_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parent_ws uuid;
begin
  if new.company_id is not null then
    select workspace_id into parent_ws from public.companies where id = new.company_id;
    if parent_ws is null or parent_ws <> new.workspace_id then
      raise exception 'Cross-workspace company reference forbidden';
    end if;
  end if;
  return new;
end;
$$;

create trigger contacts_same_workspace
  before insert or update on public.contacts
  for each row execute function public.tg_contacts_same_workspace();

-- Leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id),
  company_id uuid references public.companies(id),
  source text,
  score integer not null default 0 check (score >= 0 and score <= 100),
  status text not null default 'new',
  owner_user_id uuid references public.profiles(user_id),
  qualified_at timestamptz,
  disqualified_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_workspace_status_idx on public.leads(workspace_id, status);
create index if not exists leads_workspace_owner_idx on public.leads(workspace_id, owner_user_id);
create trigger leads_updated_at before update on public.leads
  for each row execute function public.tg_set_updated_at();

-- Pipelines
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  entity_type text not null default 'deal',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create trigger pipelines_updated_at before update on public.pipelines
  for each row execute function public.tg_set_updated_at();

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  probability integer not null default 0 check (probability >= 0 and probability <= 100),
  color text,
  is_closed boolean not null default false,
  is_won boolean not null default false,
  unique (pipeline_id, name)
);

create index if not exists pipeline_stages_pipeline_position_idx on public.pipeline_stages(pipeline_id, position);

-- Deals
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id),
  primary_contact_id uuid references public.contacts(id),
  pipeline_id uuid references public.pipelines(id),
  stage_id uuid references public.pipeline_stages(id),
  name text not null,
  amount_minor bigint not null default 0,
  currency text not null default 'USD',
  probability integer not null default 0,
  expected_close_date date,
  owner_user_id uuid references public.profiles(user_id),
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_workspace_owner_idx on public.deals(workspace_id, owner_user_id);
create index if not exists deals_workspace_stage_idx on public.deals(workspace_id, stage_id);
create trigger deals_updated_at before update on public.deals
  for each row execute function public.tg_set_updated_at();

-- Cross-workspace guards for deals
create or replace function public.tg_deals_same_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c_ws uuid; p_ws uuid; s_ws uuid; pc_ws uuid;
begin
  if new.company_id is not null then
    select workspace_id into c_ws from public.companies where id = new.company_id;
    if c_ws is null or c_ws <> new.workspace_id then raise exception 'Cross-workspace company reference forbidden'; end if;
  end if;
  if new.primary_contact_id is not null then
    select workspace_id into pc_ws from public.contacts where id = new.primary_contact_id;
    if pc_ws is null or pc_ws <> new.workspace_id then raise exception 'Cross-workspace contact reference forbidden'; end if;
  end if;
  if new.pipeline_id is not null then
    select workspace_id into p_ws from public.pipelines where id = new.pipeline_id;
    if p_ws is null or p_ws <> new.workspace_id then raise exception 'Cross-workspace pipeline reference forbidden'; end if;
  end if;
  if new.stage_id is not null then
    select workspace_id into s_ws from public.pipeline_stages s join public.pipelines p on p.id = s.pipeline_id where s.id = new.stage_id;
    if s_ws is null or s_ws <> new.workspace_id then raise exception 'Cross-workspace stage reference forbidden'; end if;
  end if;
  return new;
end;
$$;

create trigger deals_same_workspace
  before insert or update on public.deals
  for each row execute function public.tg_deals_same_workspace();

-- Activities
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  activity_type text not null,
  subject text,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  owner_user_id uuid references public.profiles(user_id),
  contact_id uuid references public.contacts(id),
  deal_id uuid references public.deals(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_entity_idx on public.activities(workspace_id, entity_type, entity_id);
create index if not exists activities_owner_idx on public.activities(workspace_id, owner_user_id);
create trigger activities_updated_at before update on public.activities
  for each row execute function public.tg_set_updated_at();

-- Tags
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text,
  unique (workspace_id, name)
);

-- Notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  body_rich text not null,
  visibility visibility not null default 'internal',
  author_user_id uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_entity_idx on public.notes(workspace_id, entity_type, entity_id);
create trigger notes_updated_at before update on public.notes
  for each row execute function public.tg_set_updated_at();

-- ===========================================================================
-- 0004_clients_delivery_collaboration.sql
-- ===========================================================================
-- AgencyOS — Migration 0004: Clients, delivery, collaboration, files, approvals

-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) unique,
  name text not null,
  code text,
  status text not null default 'active',
  health_score integer not null default 70 check (health_score >= 0 and health_score <= 100),
  health_reason text,
  owner_user_id uuid references public.profiles(user_id),
  portal_slug text unique,
  portal_enabled boolean not null default false,
  onboarding_status text not null default 'pending',
  start_date date,
  renewal_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_workspace_status_idx on public.clients(workspace_id, status);
create index if not exists clients_workspace_owner_idx on public.clients(workspace_id, owner_user_id);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.tg_set_updated_at();

-- Same-workspace guard for client.company_id
create or replace function public.tg_clients_same_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_ws uuid;
begin
  if new.company_id is not null then
    select workspace_id into parent_ws from public.companies where id = new.company_id;
    if parent_ws is null or parent_ws <> new.workspace_id then raise exception 'Cross-workspace company reference forbidden'; end if;
  end if;
  return new;
end;
$$;

create trigger clients_same_workspace
  before insert or update on public.clients
  for each row execute function public.tg_clients_same_workspace();

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  relationship_role text,
  is_primary boolean not null default false,
  portal_access boolean not null default false,
  unique (client_id, contact_id)
);

-- Service catalog
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  default_rate_minor bigint not null default 0,
  billing_unit text not null default 'hour',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create trigger services_updated_at before update on public.services
  for each row execute function public.tg_set_updated_at();

create table if not exists public.retainers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date,
  amount_minor bigint not null default 0,
  currency text not null default 'USD',
  included_minutes integer not null default 0,
  rollover_policy text not null default 'none',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists retainers_client_idx on public.retainers(client_id);
create trigger retainers_updated_at before update on public.retainers
  for each row execute function public.tg_set_updated_at();

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  starts_on date,
  ends_on date,
  value_minor bigint not null default 0,
  currency text not null default 'USD',
  file_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contracts_updated_at before update on public.contracts
  for each row execute function public.tg_set_updated_at();

create table if not exists public.client_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'normal',
  status text not null default 'new',
  requester_contact_id uuid references public.contacts(id),
  assigned_user_id uuid references public.profiles(user_id),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_requests_client_status_idx on public.client_requests(client_id, status);
create trigger client_requests_updated_at before update on public.client_requests
  for each row execute function public.tg_set_updated_at();

create table if not exists public.client_health_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  score integer not null,
  reason text,
  source text,
  occurred_at timestamptz not null default now()
);

create index if not exists client_health_events_client_idx on public.client_health_events(client_id, occurred_at desc);

-- Delivery
create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  template_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create trigger project_templates_updated_at before update on public.project_templates
  for each row execute function public.tg_set_updated_at();

create table if not exists public.project_statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  color text,
  category text not null default 'active',
  unique (workspace_id, name)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  name text not null,
  code text,
  description text,
  status_id uuid references public.project_statuses(id),
  owner_user_id uuid references public.profiles(user_id),
  start_date date,
  due_date date,
  budget_minor bigint not null default 0,
  currency text not null default 'USD',
  budget_minutes integer not null default 0,
  visibility visibility not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_workspace_client_idx on public.projects(workspace_id, client_id);
create index if not exists projects_workspace_owner_idx on public.projects(workspace_id, owner_user_id);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.tg_set_updated_at();

-- Cross-workspace guards for projects
create or replace function public.tg_projects_same_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare c_ws uuid; s_ws uuid;
begin
  if new.client_id is not null then
    select workspace_id into c_ws from public.clients where id = new.client_id;
    if c_ws is null or c_ws <> new.workspace_id then raise exception 'Cross-workspace client reference forbidden'; end if;
  end if;
  if new.status_id is not null then
    select workspace_id into s_ws from public.project_statuses where id = new.status_id;
    if s_ws is null or s_ws <> new.workspace_id then raise exception 'Cross-workspace status reference forbidden'; end if;
  end if;
  return new;
end;
$$;

create trigger projects_same_workspace
  before insert or update on public.projects
  for each row execute function public.tg_projects_same_workspace();

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  membership_id uuid not null references public.workspace_memberships(id) on delete cascade,
  access_level text not null default 'viewer',
  unique (project_id, membership_id)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  due_date date,
  status text not null default 'planned'
);

create table if not exists public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  color text,
  category text not null default 'todo',
  unique (workspace_id, name)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id),
  parent_task_id uuid references public.tasks(id),
  milestone_id uuid references public.milestones(id),
  name text not null,
  description_rich text,
  status_id uuid references public.task_statuses(id),
  priority text not null default 'normal',
  owner_user_id uuid references public.profiles(user_id),
  assignee_user_id uuid references public.profiles(user_id),
  start_at timestamptz,
  due_at timestamptz,
  estimate_minutes integer not null default 0,
  billable boolean not null default true,
  position integer not null default 0,
  visibility visibility not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_workspace_project_idx on public.tasks(workspace_id, project_id);
create index if not exists tasks_workspace_assignee_idx on public.tasks(workspace_id, assignee_user_id);
create index if not exists tasks_workspace_status_idx on public.tasks(workspace_id, status_id);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.tg_set_updated_at();

-- Cross-workspace guard for tasks (project + status)
create or replace function public.tg_tasks_same_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare p_ws uuid; s_ws uuid;
begin
  if new.project_id is not null then
    select workspace_id into p_ws from public.projects where id = new.project_id;
    if p_ws is null or p_ws <> new.workspace_id then raise exception 'Cross-workspace project reference forbidden'; end if;
  end if;
  if new.status_id is not null then
    select workspace_id into s_ws from public.task_statuses where id = new.status_id;
    if s_ws is null or s_ws <> new.workspace_id then raise exception 'Cross-workspace status reference forbidden'; end if;
  end if;
  return new;
end;
$$;

create trigger tasks_same_workspace
  before insert or update on public.tasks
  for each row execute function public.tg_tasks_same_workspace();

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.task_watchers (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  primary key (task_id, user_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  name text not null,
  channel text,
  objective text,
  status text not null default 'planned',
  start_date date,
  end_date date,
  budget_minor bigint not null default 0,
  currency text not null default 'USD',
  owner_user_id uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_workspace_client_idx on public.campaigns(workspace_id, client_id);
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.tg_set_updated_at();

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id),
  campaign_id uuid references public.campaigns(id),
  task_id uuid references public.tasks(id),
  client_id uuid references public.clients(id),
  name text not null,
  type text,
  status text not null default 'draft',
  due_at timestamptz,
  owner_user_id uuid references public.profiles(user_id),
  current_version_id uuid,
  visibility visibility not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliverables_workspace_project_idx on public.deliverables(workspace_id, project_id);
create index if not exists deliverables_workspace_client_idx on public.deliverables(workspace_id, client_id);
create trigger deliverables_updated_at before update on public.deliverables
  for each row execute function public.tg_set_updated_at();

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id),
  deliverable_id uuid references public.deliverables(id),
  channel text,
  title text not null,
  body_rich text,
  publish_at timestamptz,
  status text not null default 'draft',
  owner_user_id uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_workspace_campaign_idx on public.content_items(workspace_id, campaign_id);
create trigger content_items_updated_at before update on public.content_items
  for each row execute function public.tg_set_updated_at();

-- Collaboration
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  parent_comment_id uuid references public.comments(id),
  body_rich text not null,
  visibility visibility not null default 'internal',
  author_user_id uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists comments_entity_idx on public.comments(workspace_id, entity_type, entity_id);
create trigger comments_updated_at before update on public.comments
  for each row execute function public.tg_set_updated_at();

create table if not exists public.comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(user_id) on delete cascade
);

create index if not exists comment_mentions_comment_idx on public.comment_mentions(comment_id);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(user_id),
  verb text not null,
  entity_type text not null,
  entity_id uuid,
  metadata_json jsonb,
  visibility visibility not null default 'internal',
  occurred_at timestamptz not null default now()
);

create index if not exists activity_events_workspace_occurred_idx on public.activity_events(workspace_id, occurred_at desc);
create index if not exists activity_events_entity_idx on public.activity_events(workspace_id, entity_type, entity_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx on public.notifications(user_id, read_at);

-- Files metadata
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  bucket text not null default 'workspace-assets',
  object_path text not null,
  original_name text not null,
  content_type text,
  size_bytes bigint not null default 0,
  checksum text,
  uploader_user_id uuid references public.profiles(user_id),
  visibility visibility not null default 'internal',
  scan_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists files_workspace_idx on public.files(workspace_id);

create table if not exists public.file_links (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null
);

create index if not exists file_links_file_idx on public.file_links(file_id);
create index if not exists file_links_entity_idx on public.file_links(entity_type, entity_id);

create table if not exists public.deliverable_versions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  version_number integer not null,
  file_id uuid references public.files(id),
  notes text,
  created_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  unique (deliverable_id, version_number)
);

-- Approvals
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  version_number integer not null default 1,
  title text not null,
  instructions text,
  status approval_status not null default 'pending',
  due_at timestamptz,
  requested_by uuid references public.profiles(user_id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approvals_workspace_status_idx on public.approval_requests(workspace_id, status);
create trigger approvals_updated_at before update on public.approval_requests
  for each row execute function public.tg_set_updated_at();

create table if not exists public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  position integer not null default 0,
  approver_type text not null,
  approver_id uuid,
  status text not null default 'pending',
  decided_at timestamptz,
  decision_note text,
  decided_by_user_id uuid references public.profiles(user_id)
);

create index if not exists approval_steps_request_idx on public.approval_steps(approval_request_id);

create table if not exists public.approval_events (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  actor_user_id uuid references public.profiles(user_id),
  action text not null,
  note text,
  occurred_at timestamptz not null default now()
);

create index if not exists approval_events_request_idx on public.approval_events(approval_request_id, occurred_at);

-- ===========================================================================
-- 0005_time_finance_customization_automation.sql
-- ===========================================================================
-- AgencyOS — Migration 0005: Time, capacity, finance, customization, automation

-- Time entries
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id),
  task_id uuid references public.tasks(id),
  client_id uuid references public.clients(id),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes integer not null default 0 check (minutes >= 0),
  description text,
  billable boolean not null default true,
  rate_minor bigint not null default 0,
  currency text not null default 'USD',
  status time_entry_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_entries_workspace_user_started_idx on public.time_entries(workspace_id, user_id, started_at desc);
create index if not exists time_entries_workspace_project_idx on public.time_entries(workspace_id, project_id);
create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function public.tg_set_updated_at();

create table if not exists public.timesheets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, period_start)
);

create trigger timesheets_updated_at before update on public.timesheets
  for each row execute function public.tg_set_updated_at();

create table if not exists public.capacity_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  project_id uuid references public.projects(id),
  starts_on date not null,
  ends_on date not null,
  allocated_minutes integer not null default 0
);

create index if not exists capacity_workspace_user_starts_idx on public.capacity_allocations(workspace_id, user_id, starts_on);

create table if not exists public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  service_id uuid references public.services(id),
  role_id uuid references public.roles(id),
  rate_minor bigint not null default 0,
  currency text not null default 'USD',
  starts_on date not null default current_date
);

create index if not exists rate_cards_workspace_client_idx on public.rate_cards(workspace_id, client_id);

-- Finance
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  category text not null,
  amount_minor bigint not null default 0,
  currency text not null default 'USD',
  incurred_on date not null default current_date,
  billable boolean not null default false,
  receipt_file_id uuid references public.files(id),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_workspace_client_idx on public.expenses(workspace_id, client_id);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.tg_set_updated_at();

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  status text not null default 'draft',
  currency text not null default 'USD',
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  total_minor bigint not null default 0,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger estimates_updated_at before update on public.estimates
  for each row execute function public.tg_set_updated_at();

create table if not exists public.estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  description text not null,
  quantity_decimal numeric(12,3) not null default 1,
  unit_price_minor bigint not null default 0,
  tax_rate_decimal numeric(5,4) not null default 0
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id),
  number text not null,
  status text not null default 'draft',
  currency text not null default 'USD',
  issued_on date not null default current_date,
  due_on date,
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  total_minor bigint not null default 0,
  paid_minor bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, number)
);

create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.tg_set_updated_at();

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity_decimal numeric(12,3) not null default 1,
  unit_price_minor bigint not null default 0,
  tax_rate_decimal numeric(5,4) not null default 0,
  project_id uuid references public.projects(id),
  time_entry_id uuid references public.time_entries(id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_reference text,
  amount_minor bigint not null default 0,
  currency text not null default 'USD',
  paid_at timestamptz not null default now(),
  status text not null default 'completed'
);

-- Customization
create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  key text not null,
  label text not null,
  data_type text not null,
  required boolean not null default false,
  options_json jsonb,
  validation_json jsonb,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, entity_type, key)
);

create trigger cf_def_updated_at before update on public.custom_field_definitions
  for each row execute function public.tg_set_updated_at();

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  value_json jsonb,
  unique (definition_id, entity_id)
);

create index if not exists cf_values_workspace_entity_idx on public.custom_field_values(workspace_id, entity_type, entity_id);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  name text not null,
  owner_user_id uuid references public.profiles(user_id),
  visibility visibility not null default 'private',
  query_json jsonb,
  columns_json jsonb,
  sort_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, entity_type, name)
);

create trigger saved_views_updated_at before update on public.saved_views
  for each row execute function public.tg_set_updated_at();

create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  owner_user_id uuid references public.profiles(user_id),
  visibility visibility not null default 'workspace',
  layout_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger dashboards_updated_at before update on public.dashboards
  for each row execute function public.tg_set_updated_at();

create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  widget_type text not null,
  query_json jsonb,
  display_json jsonb,
  position_json jsonb
);

create table if not exists public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  subject_type text not null,
  dimensions_json jsonb,
  measures_json jsonb,
  filters_json jsonb,
  visualization_json jsonb,
  visibility visibility not null default 'workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger report_def_updated_at before update on public.report_definitions
  for each row execute function public.tg_set_updated_at();

-- Automation
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_config_json jsonb,
  condition_tree_json jsonb,
  enabled boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger automations_updated_at before update on public.automations
  for each row execute function public.tg_set_updated_at();

create table if not exists public.automation_actions (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  position integer not null default 0,
  action_type text not null,
  config_json jsonb
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  trigger_event_id uuid,
  status automation_run_status not null default 'pending',
  idempotency_key text unique,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text
);

create index if not exists automation_runs_status_idx on public.automation_runs(status, started_at);

create table if not exists public.automation_action_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  action_id uuid not null references public.automation_actions(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  output_json jsonb,
  error_summary text
);

-- Transactional outbox
create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  actor_user_id uuid references public.profiles(user_id),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now()
);

create index if not exists outbox_unprocessed_idx on public.outbox_events(processed_at, next_attempt_at);

-- Webhooks
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null,
  secret_ciphertext text,
  event_types_json jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger webhook_endpoints_updated_at before update on public.webhook_endpoints
  for each row execute function public.tg_set_updated_at();

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_id uuid not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  response_code integer
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected',
  scopes_json jsonb,
  credential_reference text,
  connected_by uuid references public.profiles(user_id),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger integration_conn_updated_at before update on public.integration_connections
  for each row execute function public.tg_set_updated_at();

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  file_id uuid references public.files(id),
  mapping_json jsonb,
  status import_job_status not null default 'pending',
  totals_json jsonb,
  error_file_id uuid references public.files(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger import_jobs_updated_at before update on public.import_jobs
  for each row execute function public.tg_set_updated_at();

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null,
  query_json jsonb,
  status text not null default 'pending',
  object_path text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger export_jobs_updated_at before update on public.export_jobs
  for each row execute function public.tg_set_updated_at();

-- Client portal & knowledge
create table if not exists public.client_portals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  slug text not null unique,
  contact_id uuid references public.contacts(id),
  brand_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger client_portals_updated_at before update on public.client_portals
  for each row execute function public.tg_set_updated_at();

create table if not exists public.knowledge_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  slug text not null,
  body_rich text not null,
  client_id uuid references public.clients(id),
  project_id uuid references public.projects(id),
  visibility visibility not null default 'internal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create trigger knowledge_pages_updated_at before update on public.knowledge_pages
  for each row execute function public.tg_set_updated_at();

-- ===========================================================================
-- 0006_authorization_helpers.sql
-- ===========================================================================
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

-- ===========================================================================
-- 0007_rls_policies.sql
-- ===========================================================================
-- AgencyOS — Migration 0007: RLS policies on every exposed tenant-owned table
-- Pattern: caller must be active member of the row's workspace AND (for write) hold the required permission.
-- WITH CHECK prevents changing workspace_id, owner, or protected state to escape authorization.

-- Enable RLS on every tenant-owned table
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_roles enable row level security;
alter table public.invitation_teams enable row level security;
alter table public.feature_flags enable row level security;
alter table public.workspace_preferences enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.tags enable row level security;
alter table public.notes enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.services enable row level security;
alter table public.retainers enable row level security;
alter table public.contracts enable row level security;
alter table public.client_requests enable row level security;
alter table public.client_health_events enable row level security;
alter table public.project_templates enable row level security;
alter table public.project_statuses enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.task_statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_watchers enable row level security;
alter table public.campaigns enable row level security;
alter table public.deliverables enable row level security;
alter table public.content_items enable row level security;
alter table public.comments enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.files enable row level security;
alter table public.file_links enable row level security;
alter table public.deliverable_versions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_steps enable row level security;
alter table public.approval_events enable row level security;
alter table public.time_entries enable row level security;
alter table public.timesheets enable row level security;
alter table public.capacity_allocations enable row level security;
alter table public.rate_cards enable row level security;
alter table public.expenses enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_lines enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.saved_views enable row level security;
alter table public.dashboards enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.report_definitions enable row level security;
alter table public.automations enable row level security;
alter table public.automation_actions enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_action_runs enable row level security;
alter table public.outbox_events enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.integration_connections enable row level security;
alter table public.import_jobs enable row level security;
alter table public.export_jobs enable row level security;
alter table public.client_portals enable row level security;
alter table public.knowledge_pages enable row level security;
alter table audit.events enable row level security;

-- Supabase roles need table privileges in addition to RLS policies. Without
-- these grants every policy is unreachable and authenticated API calls fail
-- with "permission denied" before RLS is evaluated.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============ Workspaces ============
create policy workspaces_select on public.workspaces for select to authenticated
  using (private.is_workspace_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (private.has_permission(id, 'workspace.update'))
  with check (private.has_permission(id, 'workspace.update') and owner_id = (select owner_id from public.workspaces where id = id));
create policy workspaces_delete on public.workspaces for delete to authenticated
  using (private.has_permission(id, 'workspace.delete'));

-- ============ Profiles ============
create policy profiles_select on public.profiles for select to authenticated
  using (
    user_id = auth.uid()
    or user_id in (
      select m.user_id from public.workspace_memberships m
      where m.status = 'active'
        and m.workspace_id in (select unnest(private.active_workspace_ids()))
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============ Memberships ============
create policy memberships_select on public.workspace_memberships for select to authenticated
  using (private.is_workspace_member(workspace_id) or user_id = auth.uid());
create policy memberships_insert on public.workspace_memberships for insert to authenticated
  with check (private.has_permission(workspace_id, 'members.invite'));
create policy memberships_update on public.workspace_memberships for update to authenticated
  using (private.has_permission(workspace_id, 'members.update'))
  with check (private.has_permission(workspace_id, 'members.update'));
create policy memberships_delete on public.workspace_memberships for delete to authenticated
  using (private.has_permission(workspace_id, 'members.remove'));

-- ============ Roles ============
create policy roles_select on public.roles for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy roles_insert on public.roles for insert to authenticated
  with check (private.has_permission(workspace_id, 'roles.manage'));
create policy roles_update on public.roles for update to authenticated
  using (private.has_permission(workspace_id, 'roles.manage'))
  with check (private.has_permission(workspace_id, 'roles.manage'));
create policy roles_delete on public.roles for delete to authenticated
  using (private.has_permission(workspace_id, 'roles.manage'));

-- Permissions catalogue: read-only to authenticated
create policy permissions_select on public.permissions for select to authenticated using (true);

-- role_permissions: visible to workspace members
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (exists (
    select 1 from public.roles r where r.id = role_id and private.is_workspace_member(r.workspace_id)
  ));
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check (exists (
    select 1 from public.roles r where r.id = role_id and private.has_permission(r.workspace_id, 'roles.manage')
  ));
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (exists (
    select 1 from public.roles r where r.id = role_id and private.has_permission(r.workspace_id, 'roles.manage')
  ));

-- membership_roles: visible to workspace members
create policy membership_roles_select on public.membership_roles for select to authenticated
  using (exists (
    select 1 from public.workspace_memberships m
    join public.roles r on r.id = membership_roles.role_id
    where m.id = membership_roles.membership_id and private.is_workspace_member(r.workspace_id)
  ));
create policy membership_roles_insert on public.membership_roles for insert to authenticated
  with check (exists (
    select 1 from public.workspace_memberships m
    join public.roles r on r.id = membership_roles.role_id
    where m.id = membership_roles.membership_id and private.has_permission(r.workspace_id, 'roles.manage')
  ));
create policy membership_roles_delete on public.membership_roles for delete to authenticated
  using (exists (
    select 1 from public.workspace_memberships m
    join public.roles r on r.id = membership_roles.role_id
    where m.id = membership_roles.membership_id and private.has_permission(r.workspace_id, 'roles.manage')
  ));

-- ============ Teams ============
create policy teams_select on public.teams for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy teams_insert on public.teams for insert to authenticated
  with check (private.has_permission(workspace_id, 'teams.manage'));
create policy teams_update on public.teams for update to authenticated
  using (private.has_permission(workspace_id, 'teams.manage'))
  with check (private.has_permission(workspace_id, 'teams.manage'));
create policy teams_delete on public.teams for delete to authenticated
  using (private.has_permission(workspace_id, 'teams.manage'));

create policy team_memberships_select on public.team_memberships for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and private.is_workspace_member(t.workspace_id)));
create policy team_memberships_insert on public.team_memberships for insert to authenticated
  with check (exists (select 1 from public.teams t where t.id = team_id and private.has_permission(t.workspace_id, 'teams.manage')));
create policy team_memberships_delete on public.team_memberships for delete to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and private.has_permission(t.workspace_id, 'teams.manage')));

-- ============ Invitations ============
create policy invitations_select on public.invitations for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (private.has_permission(workspace_id, 'members.invite'));
create policy invitations_update on public.invitations for update to authenticated
  using (private.has_permission(workspace_id, 'members.invite'))
  with check (private.has_permission(workspace_id, 'members.invite'));
create policy invitations_delete on public.invitations for delete to authenticated
  using (private.has_permission(workspace_id, 'members.invite'));

create policy invitation_roles_select on public.invitation_roles for select to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and private.is_workspace_member(i.workspace_id)));
create policy invitation_roles_insert on public.invitation_roles for insert to authenticated
  with check (exists (select 1 from public.invitations i where i.id = invitation_id and private.has_permission(i.workspace_id, 'members.invite')));
create policy invitation_roles_delete on public.invitation_roles for delete to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and private.has_permission(i.workspace_id, 'members.invite')));

create policy invitation_teams_select on public.invitation_teams for select to authenticated
  using (exists (select 1 from public.invitations i where i.id = invitation_id and private.is_workspace_member(i.workspace_id)));

-- Feature flags
create policy feature_flags_select on public.feature_flags for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy feature_flags_update on public.feature_flags for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));

-- Workspace preferences
create policy workspace_prefs_select on public.workspace_preferences for select to authenticated
  using (private.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy workspace_prefs_upsert on public.workspace_preferences for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy workspace_prefs_update on public.workspace_preferences for update to authenticated
  using (private.is_workspace_member(workspace_id) and user_id = auth.uid())
  with check (private.is_workspace_member(workspace_id) and user_id = auth.uid());

-- Audit events: read-only to workspace members with audit.read
create policy audit_events_select on audit.events for select to authenticated
  using (private.has_permission(workspace_id, 'audit.read'));
-- No insert/update/delete policy on audit.events for authenticated — only service role + private.record_audit can write.

-- ============ Reusable macro-like policies for tenant-owned tables ============
-- Companies
create policy companies_select on public.companies for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy companies_insert on public.companies for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create') and workspace_id = workspace_id);
create policy companies_update on public.companies for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy companies_delete on public.companies for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

-- Contacts
create policy contacts_select on public.contacts for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy contacts_update on public.contacts for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy contacts_delete on public.contacts for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

-- Leads
create policy leads_select on public.leads for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy leads_insert on public.leads for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy leads_update on public.leads for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy leads_delete on public.leads for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

-- Pipelines + stages
create policy pipelines_select on public.pipelines for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy pipelines_insert on public.pipelines for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy pipelines_update on public.pipelines for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy pipelines_delete on public.pipelines for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

create policy pipeline_stages_select on public.pipeline_stages for select to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.is_workspace_member(p.workspace_id)));
create policy pipeline_stages_insert on public.pipeline_stages for insert to authenticated
  with check (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_permission(p.workspace_id, 'settings.manage')));
create policy pipeline_stages_update on public.pipeline_stages for update to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_permission(p.workspace_id, 'settings.manage')))
  with check (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_permission(p.workspace_id, 'settings.manage')));
create policy pipeline_stages_delete on public.pipeline_stages for delete to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and private.has_permission(p.workspace_id, 'settings.manage')));

-- Deals
create policy deals_select on public.deals for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy deals_insert on public.deals for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy deals_update on public.deals for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy deals_delete on public.deals for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

-- Activities, tags, notes (CRM)
create policy activities_select on public.activities for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy activities_insert on public.activities for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy activities_update on public.activities for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy activities_delete on public.activities for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

create policy tags_select on public.tags for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy tags_insert on public.tags for insert to authenticated
  with check (private.has_permission(workspace_id, 'crm.create'));
create policy tags_update on public.tags for update to authenticated
  using (private.has_permission(workspace_id, 'crm.update'))
  with check (private.has_permission(workspace_id, 'crm.update'));
create policy tags_delete on public.tags for delete to authenticated
  using (private.has_permission(workspace_id, 'crm.delete'));

create policy notes_select on public.notes for select to authenticated
  using (private.is_workspace_member(workspace_id) and (
    visibility = 'internal' or visibility = 'client' or visibility = 'restricted'
  ));
create policy notes_insert on public.notes for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'comments.create'));
create policy notes_update on public.notes for update to authenticated
  using (private.is_workspace_member(workspace_id) and (author_user_id = auth.uid() or private.has_permission(workspace_id, 'comments.moderate')))
  with check (private.is_workspace_member(workspace_id));
create policy notes_delete on public.notes for delete to authenticated
  using (private.is_workspace_member(workspace_id) and (author_user_id = auth.uid() or private.has_permission(workspace_id, 'comments.moderate')));

-- Clients (workspace members + portal access via can_access_client)
create policy clients_select on public.clients for select to authenticated
  using (private.can_access_client(id));
create policy clients_insert on public.clients for insert to authenticated
  with check (private.has_permission(workspace_id, 'clients.create'));
create policy clients_update on public.clients for update to authenticated
  using (private.has_permission(workspace_id, 'clients.update'))
  with check (private.has_permission(workspace_id, 'clients.update'));
create policy clients_delete on public.clients for delete to authenticated
  using (private.has_permission(workspace_id, 'clients.delete'));

-- Client contacts
create policy client_contacts_select on public.client_contacts for select to authenticated
  using (private.can_access_client(client_id));
create policy client_contacts_insert on public.client_contacts for insert to authenticated
  with check (private.has_permission((select workspace_id from public.clients where id = client_id), 'clients.update'));
create policy client_contacts_update on public.client_contacts for update to authenticated
  using (private.has_permission((select workspace_id from public.clients where id = client_id), 'clients.update'))
  with check (private.has_permission((select workspace_id from public.clients where id = client_id), 'clients.update'));
create policy client_contacts_delete on public.client_contacts for delete to authenticated
  using (private.has_permission((select workspace_id from public.clients where id = client_id), 'clients.update'));

-- Services
create policy services_select on public.services for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy services_insert on public.services for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy services_update on public.services for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy services_delete on public.services for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

-- Retainers, contracts, client_requests, client_health_events
create policy retainers_select on public.retainers for select to authenticated
  using (private.can_access_client(client_id));
create policy retainers_insert on public.retainers for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy retainers_update on public.retainers for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy retainers_delete on public.retainers for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy contracts_select on public.contracts for select to authenticated
  using (private.can_access_client(client_id));
create policy contracts_insert on public.contracts for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy contracts_update on public.contracts for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy contracts_delete on public.contracts for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy client_requests_select on public.client_requests for select to authenticated
  using (private.can_access_client(client_id));
create policy client_requests_insert on public.client_requests for insert to authenticated
  with check (private.has_permission(workspace_id, 'clients.update') or private.can_access_client(client_id));
create policy client_requests_update on public.client_requests for update to authenticated
  using (private.has_permission(workspace_id, 'clients.update'))
  with check (private.has_permission(workspace_id, 'clients.update'));
create policy client_requests_delete on public.client_requests for delete to authenticated
  using (private.has_permission(workspace_id, 'clients.update'));

create policy client_health_events_select on public.client_health_events for select to authenticated
  using (private.can_access_client(client_id));
create policy client_health_events_insert on public.client_health_events for insert to authenticated
  with check (private.has_permission(workspace_id, 'clients.update'));
create policy client_health_events_delete on public.client_health_events for delete to authenticated
  using (private.has_permission(workspace_id, 'clients.update'));

-- Projects
create policy projects_select on public.projects for select to authenticated
  using (private.can_access_project(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (private.has_permission(workspace_id, 'projects.create'));
create policy projects_update on public.projects for update to authenticated
  using (private.has_permission(workspace_id, 'projects.update'))
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy projects_delete on public.projects for delete to authenticated
  using (private.has_permission(workspace_id, 'projects.delete'));

-- Project members, milestones, tasks, task deps, watchers, campaigns, deliverables, content
create policy project_members_select on public.project_members for select to authenticated
  using (private.can_access_project(project_id));
create policy project_members_insert on public.project_members for insert to authenticated
  with check (private.has_permission((select workspace_id from public.projects where id = project_id), 'projects.update'));
create policy project_members_delete on public.project_members for delete to authenticated
  using (private.has_permission((select workspace_id from public.projects where id = project_id), 'projects.update'));

create policy milestones_select on public.milestones for select to authenticated
  using (private.can_access_project(project_id));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy milestones_update on public.milestones for update to authenticated
  using (private.has_permission(workspace_id, 'projects.update'))
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy milestones_delete on public.milestones for delete to authenticated
  using (private.has_permission(workspace_id, 'projects.update'));

create policy tasks_select on public.tasks for select to authenticated
  using (private.is_workspace_member(workspace_id) or private.can_access_project(project_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (private.has_permission(workspace_id, 'tasks.create'));
create policy tasks_update on public.tasks for update to authenticated
  using (private.has_permission(workspace_id, 'tasks.update'))
  with check (private.has_permission(workspace_id, 'tasks.update'));
create policy tasks_delete on public.tasks for delete to authenticated
  using (private.has_permission(workspace_id, 'tasks.delete'));

create policy task_deps_select on public.task_dependencies for select to authenticated
  using (private.is_workspace_member((select workspace_id from public.tasks where id = task_id)));
create policy task_deps_insert on public.task_dependencies for insert to authenticated
  with check (private.has_permission((select workspace_id from public.tasks where id = task_id), 'tasks.update'));
create policy task_deps_delete on public.task_dependencies for delete to authenticated
  using (private.has_permission((select workspace_id from public.tasks where id = task_id), 'tasks.update'));

create policy task_watchers_select on public.task_watchers for select to authenticated
  using (private.is_workspace_member((select workspace_id from public.tasks where id = task_id)) or user_id = auth.uid());
create policy task_watchers_insert on public.task_watchers for insert to authenticated
  with check (user_id = auth.uid() or private.has_permission((select workspace_id from public.tasks where id = task_id), 'tasks.update'));
create policy task_watchers_delete on public.task_watchers for delete to authenticated
  using (user_id = auth.uid() or private.has_permission((select workspace_id from public.tasks where id = task_id), 'tasks.update'));

create policy campaigns_select on public.campaigns for select to authenticated
  using (private.is_workspace_member(workspace_id) or (client_id is not null and private.can_access_client(client_id)));
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (private.has_permission(workspace_id, 'campaigns.manage'));
create policy campaigns_update on public.campaigns for update to authenticated
  using (private.has_permission(workspace_id, 'campaigns.manage'))
  with check (private.has_permission(workspace_id, 'campaigns.manage'));
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (private.has_permission(workspace_id, 'campaigns.manage'));

create policy deliverables_select on public.deliverables for select to authenticated
  using (private.is_workspace_member(workspace_id) or (client_id is not null and private.can_access_client(client_id) and visibility = 'client'));
create policy deliverables_insert on public.deliverables for insert to authenticated
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy deliverables_update on public.deliverables for update to authenticated
  using (private.has_permission(workspace_id, 'projects.update'))
  with check (private.has_permission(workspace_id, 'projects.update'));
create policy deliverables_delete on public.deliverables for delete to authenticated
  using (private.has_permission(workspace_id, 'projects.update'));

create policy content_items_select on public.content_items for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy content_items_insert on public.content_items for insert to authenticated
  with check (private.has_permission(workspace_id, 'content.manage'));
create policy content_items_update on public.content_items for update to authenticated
  using (private.has_permission(workspace_id, 'content.manage'))
  with check (private.has_permission(workspace_id, 'content.manage'));
create policy content_items_delete on public.content_items for delete to authenticated
  using (private.has_permission(workspace_id, 'content.manage'));

-- Comments: visibility-aware
create policy comments_select on public.comments for select to authenticated
  using (
    private.is_workspace_member(workspace_id) and (
      visibility = 'internal' or visibility = 'client' or visibility = 'restricted'
    )
    or (
    -- Portal users can see client-visible comments on entities they can access
    visibility = 'client' and private.can_access_entity(entity_type, entity_id)
    )
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'comments.create'));
create policy comments_update on public.comments for update to authenticated
  using (private.is_workspace_member(workspace_id) and (author_user_id = auth.uid() or private.has_permission(workspace_id, 'comments.moderate')))
  with check (private.is_workspace_member(workspace_id));
create policy comments_delete on public.comments for delete to authenticated
  using (private.is_workspace_member(workspace_id) and (author_user_id = auth.uid() or private.has_permission(workspace_id, 'comments.moderate')));

-- Activity events
create policy activity_events_select on public.activity_events for select to authenticated
  using (
    (private.is_workspace_member(workspace_id) and (
      visibility = 'internal' or visibility = 'client'
    )) or (visibility = 'client' and private.can_access_entity(entity_type, entity_id))
  );

-- Notifications: per-user
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or private.is_workspace_member(workspace_id));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- Files
create policy files_select on public.files for select to authenticated
  using (private.is_workspace_member(workspace_id) or (
    -- Portal users can see client-visible files linked to entities they can access
    visibility = 'client' and exists (
      select 1 from public.file_links fl
      where fl.file_id = files.id and private.can_access_entity(fl.entity_type, fl.entity_id)
    )
  ));
create policy files_insert on public.files for insert to authenticated
  with check (private.has_permission(workspace_id, 'files.upload'));
create policy files_update on public.files for update to authenticated
  using (private.has_permission(workspace_id, 'files.delete'))
  with check (private.has_permission(workspace_id, 'files.delete'));
create policy files_delete on public.files for delete to authenticated
  using (private.has_permission(workspace_id, 'files.delete'));

create policy file_links_select on public.file_links for select to authenticated
  using (private.is_workspace_member((select workspace_id from public.files where id = file_id)));
create policy file_links_insert on public.file_links for insert to authenticated
  with check (private.is_workspace_member((select workspace_id from public.files where id = file_id)));
create policy file_links_delete on public.file_links for delete to authenticated
  using (private.is_workspace_member((select workspace_id from public.files where id = file_id)));

-- Deliverable versions
create policy deliverable_versions_select on public.deliverable_versions for select to authenticated
  using (private.can_access_entity('deliverable', deliverable_id));
create policy deliverable_versions_insert on public.deliverable_versions for insert to authenticated
  with check (private.has_permission((select workspace_id from public.deliverables where id = deliverable_id), 'projects.update'));
create policy deliverable_versions_delete on public.deliverable_versions for delete to authenticated
  using (private.has_permission((select workspace_id from public.deliverables where id = deliverable_id), 'projects.update'));

-- Approvals
create policy approval_requests_select on public.approval_requests for select to authenticated
  using (private.is_workspace_member(workspace_id) or private.can_access_entity(entity_type, entity_id));
create policy approval_requests_insert on public.approval_requests for insert to authenticated
  with check (private.has_permission(workspace_id, 'approvals.request'));
create policy approval_requests_update on public.approval_requests for update to authenticated
  using (private.has_permission(workspace_id, 'approvals.decide') or private.can_access_entity(entity_type, entity_id))
  with check (private.has_permission(workspace_id, 'approvals.decide') or private.can_access_entity(entity_type, entity_id));

create policy approval_steps_select on public.approval_steps for select to authenticated
  using (exists (select 1 from public.approval_requests ar where ar.id = approval_request_id and (private.is_workspace_member(ar.workspace_id) or private.can_access_entity(ar.entity_type, ar.entity_id))));
create policy approval_steps_update on public.approval_steps for update to authenticated
  using (exists (select 1 from public.approval_requests ar where ar.id = approval_request_id and (private.has_permission(ar.workspace_id, 'approvals.decide') or private.can_access_entity(ar.entity_type, ar.entity_id))));

create policy approval_events_select on public.approval_events for select to authenticated
  using (exists (select 1 from public.approval_requests ar where ar.id = approval_request_id and (private.is_workspace_member(ar.workspace_id) or private.can_access_entity(ar.entity_type, ar.entity_id))));

-- Time entries: read_own / read_all
create policy time_entries_select on public.time_entries for select to authenticated
  using (
    private.is_workspace_member(workspace_id) and (
      user_id = auth.uid()
      or private.has_permission(workspace_id, 'time.read_all')
    )
  );
create policy time_entries_insert on public.time_entries for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and user_id = auth.uid() and private.has_permission(workspace_id, 'time.manage_own'));
create policy time_entries_update on public.time_entries for update to authenticated
  using (private.is_workspace_member(workspace_id) and (user_id = auth.uid() or private.has_permission(workspace_id, 'time.approve')))
  with check (private.is_workspace_member(workspace_id));
create policy time_entries_delete on public.time_entries for delete to authenticated
  using (private.is_workspace_member(workspace_id) and user_id = auth.uid());

-- Timesheets
create policy timesheets_select on public.timesheets for select to authenticated
  using (private.is_workspace_member(workspace_id) and (user_id = auth.uid() or private.has_permission(workspace_id, 'time.read_all')));
create policy timesheets_insert on public.timesheets for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy timesheets_update on public.timesheets for update to authenticated
  using (private.is_workspace_member(workspace_id) and (user_id = auth.uid() or private.has_permission(workspace_id, 'time.approve')));

-- Capacity
create policy capacity_allocations_select on public.capacity_allocations for select to authenticated
  using (private.is_workspace_member(workspace_id) and (user_id = auth.uid() or private.has_permission(workspace_id, 'time.read_all')));
create policy capacity_allocations_insert on public.capacity_allocations for insert to authenticated
  with check (private.has_permission(workspace_id, 'time.read_all'));
create policy capacity_allocations_update on public.capacity_allocations for update to authenticated
  using (private.has_permission(workspace_id, 'time.read_all'))
  with check (private.has_permission(workspace_id, 'time.read_all'));
create policy capacity_allocations_delete on public.capacity_allocations for delete to authenticated
  using (private.has_permission(workspace_id, 'time.read_all'));

-- Rate cards
create policy rate_cards_select on public.rate_cards for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy rate_cards_insert on public.rate_cards for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy rate_cards_update on public.rate_cards for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy rate_cards_delete on public.rate_cards for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

-- Expenses, estimates, estimate_lines, invoices, invoice_lines, payments
create policy expenses_select on public.expenses for select to authenticated
  using (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'finance.read'));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy expenses_update on public.expenses for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy expenses_delete on public.expenses for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy estimates_select on public.estimates for select to authenticated
  using (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'finance.read'));
create policy estimates_insert on public.estimates for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy estimates_update on public.estimates for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy estimates_delete on public.estimates for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy estimate_lines_select on public.estimate_lines for select to authenticated
  using (exists (select 1 from public.estimates e where e.id = estimate_id and private.is_workspace_member(e.workspace_id) and private.has_permission(e.workspace_id, 'finance.read')));

create policy invoices_select on public.invoices for select to authenticated
  using (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'finance.read'));
create policy invoices_insert on public.invoices for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy invoices_update on public.invoices for update to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'))
  with check (private.has_permission(workspace_id, 'finance.manage'));
create policy invoices_delete on public.invoices for delete to authenticated
  using (private.has_permission(workspace_id, 'finance.manage'));

create policy invoice_lines_select on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and private.is_workspace_member(i.workspace_id) and private.has_permission(i.workspace_id, 'finance.read')));

create policy payments_select on public.payments for select to authenticated
  using (private.is_workspace_member(workspace_id) and private.has_permission(workspace_id, 'finance.read'));
create policy payments_insert on public.payments for insert to authenticated
  with check (private.has_permission(workspace_id, 'finance.manage'));

-- Customization tables
create policy cf_def_select on public.custom_field_definitions for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy cf_def_insert on public.custom_field_definitions for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy cf_def_update on public.custom_field_definitions for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy cf_def_delete on public.custom_field_definitions for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

create policy cf_values_select on public.custom_field_values for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy cf_values_insert on public.custom_field_values for insert to authenticated
  with check (private.is_workspace_member(workspace_id));
create policy cf_values_update on public.custom_field_values for update to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));
create policy cf_values_delete on public.custom_field_values for delete to authenticated
  using (private.is_workspace_member(workspace_id));

-- Saved views
create policy saved_views_select on public.saved_views for select to authenticated
  using (private.is_workspace_member(workspace_id) and (visibility <> 'private' or owner_user_id = auth.uid()));
create policy saved_views_insert on public.saved_views for insert to authenticated
  with check (private.is_workspace_member(workspace_id) and owner_user_id = auth.uid());
create policy saved_views_update on public.saved_views for update to authenticated
  using (private.is_workspace_member(workspace_id) and (owner_user_id = auth.uid() or private.has_permission(workspace_id, 'settings.manage')))
  with check (private.is_workspace_member(workspace_id));
create policy saved_views_delete on public.saved_views for delete to authenticated
  using (private.is_workspace_member(workspace_id) and (owner_user_id = auth.uid() or private.has_permission(workspace_id, 'settings.manage')));

-- Dashboards, widgets, reports
create policy dashboards_select on public.dashboards for select to authenticated
  using (private.is_workspace_member(workspace_id) and (visibility <> 'private' or owner_user_id = auth.uid()));
create policy dashboards_insert on public.dashboards for insert to authenticated
  with check (private.is_workspace_member(workspace_id));
create policy dashboards_update on public.dashboards for update to authenticated
  using (private.is_workspace_member(workspace_id) and (owner_user_id = auth.uid() or private.has_permission(workspace_id, 'settings.manage')))
  with check (private.is_workspace_member(workspace_id));
create policy dashboards_delete on public.dashboards for delete to authenticated
  using (private.is_workspace_member(workspace_id) and (owner_user_id = auth.uid() or private.has_permission(workspace_id, 'settings.manage')));

create policy dashboard_widgets_select on public.dashboard_widgets for select to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and private.is_workspace_member(d.workspace_id)));
create policy dashboard_widgets_insert on public.dashboard_widgets for insert to authenticated
  with check (exists (select 1 from public.dashboards d where d.id = dashboard_id and private.is_workspace_member(d.workspace_id)));
create policy dashboard_widgets_update on public.dashboard_widgets for update to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and private.is_workspace_member(d.workspace_id)));
create policy dashboard_widgets_delete on public.dashboard_widgets for delete to authenticated
  using (exists (select 1 from public.dashboards d where d.id = dashboard_id and private.is_workspace_member(d.workspace_id)));

create policy report_def_select on public.report_definitions for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy report_def_insert on public.report_definitions for insert to authenticated
  with check (private.has_permission(workspace_id, 'reports.create'));
create policy report_def_update on public.report_definitions for update to authenticated
  using (private.has_permission(workspace_id, 'reports.create'))
  with check (private.has_permission(workspace_id, 'reports.create'));
create policy report_def_delete on public.report_definitions for delete to authenticated
  using (private.has_permission(workspace_id, 'reports.create'));

-- Automations
create policy automations_select on public.automations for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy automations_insert on public.automations for insert to authenticated
  with check (private.has_permission(workspace_id, 'automations.manage'));
create policy automations_update on public.automations for update to authenticated
  using (private.has_permission(workspace_id, 'automations.manage'))
  with check (private.has_permission(workspace_id, 'automations.manage'));
create policy automations_delete on public.automations for delete to authenticated
  using (private.has_permission(workspace_id, 'automations.manage'));

create policy automation_actions_select on public.automation_actions for select to authenticated
  using (exists (select 1 from public.automations a where a.id = automation_id and private.is_workspace_member(a.workspace_id)));
create policy automation_actions_insert on public.automation_actions for insert to authenticated
  with check (exists (select 1 from public.automations a where a.id = automation_id and private.has_permission(a.workspace_id, 'automations.manage')));
create policy automation_actions_update on public.automation_actions for update to authenticated
  using (exists (select 1 from public.automations a where a.id = automation_id and private.has_permission(a.workspace_id, 'automations.manage')));
create policy automation_actions_delete on public.automation_actions for delete to authenticated
  using (exists (select 1 from public.automations a where a.id = automation_id and private.has_permission(a.workspace_id, 'automations.manage')));

create policy automation_runs_select on public.automation_runs for select to authenticated
  using (private.is_workspace_member(workspace_id));

create policy automation_action_runs_select on public.automation_action_runs for select to authenticated
  using (exists (select 1 from public.automation_runs ar where ar.id = run_id and private.is_workspace_member(ar.workspace_id)));

-- Outbox, webhooks, integrations
create policy outbox_events_select on public.outbox_events for select to authenticated
  using (private.has_permission(workspace_id, 'automations.read'));

create policy webhook_endpoints_select on public.webhook_endpoints for select to authenticated
  using (private.has_permission(workspace_id, 'integrations.read'));
create policy webhook_endpoints_insert on public.webhook_endpoints for insert to authenticated
  with check (private.has_permission(workspace_id, 'integrations.manage'));
create policy webhook_endpoints_update on public.webhook_endpoints for update to authenticated
  using (private.has_permission(workspace_id, 'integrations.manage'))
  with check (private.has_permission(workspace_id, 'integrations.manage'));
create policy webhook_endpoints_delete on public.webhook_endpoints for delete to authenticated
  using (private.has_permission(workspace_id, 'integrations.manage'));

create policy integration_connections_select on public.integration_connections for select to authenticated
  using (private.has_permission(workspace_id, 'integrations.read'));

create policy import_jobs_select on public.import_jobs for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy export_jobs_select on public.export_jobs for select to authenticated
  using (private.is_workspace_member(workspace_id));

-- Portals + knowledge
create policy client_portals_select on public.client_portals for select to authenticated
  using (private.is_workspace_member(workspace_id) or private.can_access_client(client_id));
create policy client_portals_insert on public.client_portals for insert to authenticated
  with check (private.has_permission(workspace_id, 'portal.manage'));
create policy client_portals_update on public.client_portals for update to authenticated
  using (private.has_permission(workspace_id, 'portal.manage'))
  with check (private.has_permission(workspace_id, 'portal.manage'));
create policy client_portals_delete on public.client_portals for delete to authenticated
  using (private.has_permission(workspace_id, 'portal.manage'));

create policy knowledge_pages_select on public.knowledge_pages for select to authenticated
  using (
    (private.is_workspace_member(workspace_id) and (visibility = 'internal' or visibility = 'client'))
    or (visibility = 'client' and (client_id is null or private.can_access_client(client_id)))
  );

-- Project statuses, task statuses, project templates — workspace members can read; settings.manage for writes
create policy project_statuses_select on public.project_statuses for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy project_statuses_insert on public.project_statuses for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy project_statuses_update on public.project_statuses for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy project_statuses_delete on public.project_statuses for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

create policy task_statuses_select on public.task_statuses for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy task_statuses_insert on public.task_statuses for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy task_statuses_update on public.task_statuses for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy task_statuses_delete on public.task_statuses for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

create policy project_templates_select on public.project_templates for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy project_templates_insert on public.project_templates for insert to authenticated
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy project_templates_update on public.project_templates for update to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'))
  with check (private.has_permission(workspace_id, 'settings.manage'));
create policy project_templates_delete on public.project_templates for delete to authenticated
  using (private.has_permission(workspace_id, 'settings.manage'));

-- Webhook deliveries: visible via endpoint
create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated
  using (exists (select 1 from public.webhook_endpoints we where we.id = endpoint_id and private.has_permission(we.workspace_id, 'integrations.read')));

-- ===========================================================================
-- 0008_storage_buckets_policies.sql
-- ===========================================================================
-- AgencyOS — Migration 0008: Storage buckets and storage.objects policies

-- Buckets (private)
-- Keep this portable across supported Supabase Storage schema revisions. The
-- optional public/file-size/MIME columns are absent from older local images;
-- omitting them preserves the private default and lets deployment configure
-- limits through Storage without making migration execution version-specific.
insert into storage.buckets (id, name)
values
  ('workspace-assets', 'workspace-assets'),
  ('avatars', 'avatars'),
  ('imports', 'imports'),
  ('exports', 'exports')
on conflict (id) do nothing;

-- Helper: extract workspace id from storage path.
-- Path convention: "<workspace_id>/<entity>/<filename>" or "<workspace_id>/<...>/<filename>".
-- The first path segment is always the workspace_id (a uuid).
create or replace function private.workspace_id_from_path(path text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(path, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(path, '/', 1)::uuid
    else null
  end;
$$;

-- Helper: is the current user an active workspace member for the bucket object's path?
create or replace function private.can_access_storage_object(bucket_name text, object_path text)
returns boolean
language plpgsql
security definer set search_path = public, storage, auth
as $$
declare
  ws uuid;
begin
  -- Avatars: any authenticated user may read; only the owner may write to their own path
  if bucket_name = 'avatars' then
    if split_part(object_path, '/', 1) = auth.uid()::text then
      return true;
    end if;
    ws := private.workspace_id_from_path(object_path);
    if ws is null then return false; end if;
    return private.is_workspace_member(ws);
  end if;

  ws := private.workspace_id_from_path(object_path);
  if ws is null then return false; end if;
  return private.is_workspace_member(ws);
end;
$$;

revoke all on function private.can_access_storage_object(text, text) from public, anon;
grant execute on function private.can_access_storage_object(text, text) to authenticated;

-- Storage policies (applied to storage.objects)
-- SELECT: workspace members can read; exports bucket uses signed URLs (also gated by membership)
drop policy if exists storage_select on storage.objects;
create policy storage_select on storage.objects for select to authenticated
  using (private.can_access_storage_object(bucket_id, name));

-- INSERT: user must have files.upload in the workspace
drop policy if exists storage_insert on storage.objects;
create policy storage_insert on storage.objects for insert to authenticated
  with check (
    private.can_access_storage_object(bucket_id, name)
    and private.has_permission(private.workspace_id_from_path(name), 'files.upload')
  );

-- UPDATE: files.delete permission
drop policy if exists storage_update on storage.objects;
create policy storage_update on storage.objects for update to authenticated
  using (
    private.can_access_storage_object(bucket_id, name)
    and private.has_permission(private.workspace_id_from_path(name), 'files.delete')
  )
  with check (
    private.can_access_storage_object(bucket_id, name)
    and private.has_permission(private.workspace_id_from_path(name), 'files.delete')
  );

-- DELETE: files.delete permission
drop policy if exists storage_delete on storage.objects;
create policy storage_delete on storage.objects for delete to authenticated
  using (
    private.can_access_storage_object(bucket_id, name)
    and private.has_permission(private.workspace_id_from_path(name), 'files.delete')
  );

-- Exports bucket: any authenticated workspace member can read their workspace's exports
-- (handled by the same private.can_access_storage_object helper)

-- ===========================================================================
-- 0009_seed_permissions_bootstrap_rpc.sql
-- ===========================================================================
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
  ;

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
  if p_slug !~ '^[a-z0-9-]{2,40}$' then raise exception 'Invalid slug'; end if;

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

-- ===========================================================================
-- 0010_public_audit_rpc.sql
-- ===========================================================================
-- Public, authenticated wrapper for the append-only audit writer. Ordinary
-- users cannot insert audit rows directly; this function validates the actor
-- through auth.uid() and delegates to the security-definer implementation.
create or replace function public.record_audit(
  p_workspace_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before jsonb,
  p_after jsonb,
  p_ip_hash text default null,
  p_user_agent_summary text default null
)
returns void
language plpgsql
security definer set search_path = public, private, auth
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not private.is_workspace_member(p_workspace_id) then raise exception 'Not a workspace member'; end if;
  perform private.record_audit(
    p_workspace_id, p_action, p_entity_type, p_entity_id,
    p_before, p_after, p_ip_hash, p_user_agent_summary
  );
end;
$$;

revoke all on function public.record_audit(uuid, text, text, uuid, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.record_audit(uuid, text, text, uuid, jsonb, jsonb, text, text) to authenticated;

-- ===========================================================================
-- 0011_invitation_acceptance_rpc.sql
-- ===========================================================================
create or replace function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  current_user_id uuid := auth.uid();
  invitation_row public.invitations%rowtype;
  membership_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select * into invitation_row from public.invitations where id = p_invitation_id for update;
  if invitation_row.id is null or invitation_row.accepted_at is not null or invitation_row.revoked_at is not null or invitation_row.expires_at < now() then
    raise exception 'Invitation is no longer valid';
  end if;
  if lower(trim((select email from public.profiles where user_id = current_user_id))) <> invitation_row.email_normalized then
    raise exception 'Invitation email does not match authenticated user';
  end if;
  if exists (select 1 from public.workspace_memberships where workspace_id = invitation_row.workspace_id and user_id = current_user_id) then
    raise exception 'Already a workspace member';
  end if;
  insert into public.workspace_memberships (workspace_id, user_id, status, title)
  values (invitation_row.workspace_id, current_user_id, 'active', 'Member')
  returning id into membership_id;
  insert into public.membership_roles (membership_id, role_id)
  select membership_id, role_id from public.invitation_roles where invitation_id = invitation_row.id;
  update public.invitations set accepted_at = now() where id = invitation_row.id;
  perform private.record_audit(invitation_row.workspace_id, 'invitation.accepted', 'invitation', invitation_row.id, null, jsonb_build_object('user_id', current_user_id), null, null);
  return invitation_row.workspace_id;
end;
$$;

revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ===========================================================================
-- 0012_public_invitation_lookup.sql
-- ===========================================================================
create or replace function public.get_invitation(p_token_hash text)
returns table(invitation_id uuid, email_normalized text, workspace_name text, workspace_slug text, role_id uuid, role_name text)
language sql
security definer set search_path = public
as $$
  select i.id, i.email_normalized, w.name, w.slug, r.id, r.name
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  left join public.invitation_roles ir on ir.invitation_id = i.id
  left join public.roles r on r.id = ir.role_id
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now();
$$;

revoke all on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ===========================================================================
-- 0013_marketing_inquiries.sql
-- ===========================================================================
-- Public marketing forms persist to Supabase without exposing submissions.
create table if not exists public.marketing_inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'demo')),
  first_name text,
  last_name text,
  name text,
  email text not null check (length(email) between 3 and 320),
  agency text not null check (length(agency) between 1 and 200),
  message text,
  team_size text,
  created_at timestamptz not null default now(),
  check (
    (kind = 'contact' and first_name is not null and last_name is not null and message is not null and name is null and team_size is null)
    or
    (kind = 'demo' and name is not null and first_name is null and last_name is null and message is null)
  )
);

alter table public.marketing_inquiries enable row level security;
revoke all on public.marketing_inquiries from anon, authenticated;
grant insert on public.marketing_inquiries to anon, authenticated;

create policy marketing_inquiries_insert
on public.marketing_inquiries
for insert
to anon, authenticated
with check (
  kind in ('contact', 'demo')
  and length(email) between 3 and 320
  and length(agency) between 1 and 200
);

-- ===========================================================================
-- 0014_service_role_database_access.sql
-- ===========================================================================
-- The Supabase service role intentionally bypasses RLS for trusted server
-- workers only. It still needs database grants when PostgREST switches roles.
grant usage on schema public, audit, storage to service_role;
grant all privileges on all tables in schema public, audit, storage to service_role;
grant all privileges on all sequences in schema public, audit, storage to service_role;

-- ===========================================================================
-- 0015_workspace_owner_immutability.sql
-- ===========================================================================
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

-- ===========================================================================
-- 0016_adapter_transactions.sql
-- ===========================================================================
-- AgencyOS — Migration 0016: adapter transaction boundaries.
-- These functions are deliberately narrow. They are the only supported way
-- for the application adapter to perform the corresponding multi-write
-- workflows; each function authorizes the caller before changing state.

create or replace function public.create_invitation(
  p_workspace_id uuid,
  p_email_normalized text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_role_id uuid,
  p_team_ids uuid[] default '{}'
)
returns public.invitations
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  invitation_row public.invitations%rowtype;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if not private.has_permission(p_workspace_id, 'members.invite') then
    raise exception 'Not authorized to invite members';
  end if;
  if p_email_normalized is null or p_email_normalized = '' or p_token_hash is null or p_expires_at is null then
    raise exception 'Invitation email, token, and expiry are required';
  end if;
  if not exists (select 1 from public.roles r where r.id = p_role_id and r.workspace_id = p_workspace_id) then
    raise exception 'Invitation role does not belong to the workspace';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_team_ids, '{}')) team_id
    where not exists (select 1 from public.teams t where t.id = team_id and t.workspace_id = p_workspace_id)
  ) then
    raise exception 'Invitation team does not belong to the workspace';
  end if;

  insert into public.invitations (workspace_id, email_normalized, token_hash, expires_at, invited_by)
  values (p_workspace_id, lower(trim(p_email_normalized)), p_token_hash, p_expires_at, current_user_id)
  returning * into invitation_row;

  insert into public.invitation_roles (invitation_id, role_id)
  values (invitation_row.id, p_role_id);

  insert into public.invitation_teams (invitation_id, team_id)
  select invitation_row.id, team_id from unnest(coalesce(p_team_ids, '{}')) team_id;

  return invitation_row;
end;
$$;

revoke all on function public.create_invitation(uuid, text, text, timestamptz, uuid, uuid[]) from public, anon;
grant execute on function public.create_invitation(uuid, text, text, timestamptz, uuid, uuid[]) to authenticated;

create or replace function public.decide_approval(
  p_workspace_id uuid,
  p_approval_id uuid,
  p_step_id uuid,
  p_decision text,
  p_note text
)
returns public.approval_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  approval_row public.approval_requests%rowtype;
  step_row public.approval_steps%rowtype;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_decision not in ('approved', 'changes_requested') then raise exception 'Invalid approval decision'; end if;
  select * into approval_row from public.approval_requests where id = p_approval_id and workspace_id = p_workspace_id for update;
  if approval_row.id is null then raise exception 'Approval not found'; end if;
  if not (private.has_permission(p_workspace_id, 'approvals.decide') or private.can_access_entity(approval_row.entity_type, approval_row.entity_id)) then
    raise exception 'Not authorized to decide this approval';
  end if;
  if approval_row.status <> 'pending' then raise exception 'Approval is no longer pending'; end if;
  select * into step_row from public.approval_steps where id = p_step_id and approval_request_id = p_approval_id for update;
  if step_row.id is null or step_row.status <> 'pending' then raise exception 'Approval step is no longer pending'; end if;

  update public.approval_steps
  set status = p_decision, decided_at = now(), decision_note = p_note, decided_by_user_id = current_user_id
  where id = p_step_id;
  insert into public.approval_events (approval_request_id, actor_user_id, action, note)
  values (p_approval_id, current_user_id, p_decision, p_note);
  if not exists (select 1 from public.approval_steps where approval_request_id = p_approval_id and status = 'pending') then
    update public.approval_requests set status = p_decision::approval_status, decided_at = now() where id = p_approval_id;
  end if;
  select * into approval_row from public.approval_requests where id = p_approval_id;
  return approval_row;
end;
$$;

revoke all on function public.decide_approval(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.decide_approval(uuid, uuid, uuid, text, text) to authenticated;

create or replace function public.create_client_request(
  p_portal_slug text,
  p_title text,
  p_description text,
  p_priority text
)
returns public.client_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  portal_row public.client_portals%rowtype;
  request_row public.client_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into portal_row from public.client_portals where slug = p_portal_slug;
  if portal_row.id is null then raise exception 'Portal not found'; end if;
  if not (private.is_workspace_member(portal_row.workspace_id) or private.can_access_client(portal_row.client_id)) then
    raise exception 'Not authorized for this client portal';
  end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Title is required'; end if;
  insert into public.client_requests (workspace_id, client_id, title, description, priority, status)
  values (portal_row.workspace_id, portal_row.client_id, btrim(p_title), p_description, coalesce(p_priority, 'normal'), 'new')
  returning * into request_row;
  return request_row;
end;
$$;

revoke all on function public.create_client_request(text, text, text, text) from public, anon;
grant execute on function public.create_client_request(text, text, text, text) to authenticated;

create or replace function public.enqueue_outbox_event(
  p_workspace_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_user_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer set search_path = public, private, auth
as $$
declare event_id uuid;
begin
  if auth.uid() is null or not private.is_workspace_member(p_workspace_id) then
    raise exception 'Not authorized for this workspace';
  end if;
  if p_actor_user_id is not null and p_actor_user_id <> auth.uid() then
    raise exception 'Outbox actor must be the authenticated user';
  end if;
  insert into public.outbox_events (workspace_id, event_type, entity_type, entity_id, actor_user_id, payload)
  values (p_workspace_id, p_event_type, p_entity_type, p_entity_id, p_actor_user_id, coalesce(p_payload, '{}'::jsonb))
  returning id into event_id;
  return event_id;
end;
$$;

revoke all on function public.enqueue_outbox_event(uuid, text, text, uuid, uuid, jsonb) from public, anon;
grant execute on function public.enqueue_outbox_event(uuid, text, text, uuid, uuid, jsonb) to authenticated;

-- ===========================================================================
-- 0017_portal_scope_and_audit.sql
-- ===========================================================================
-- AgencyOS — Migration 0017: client portal entity scope and transactional audit events.
-- Portal users are authenticated Supabase identities linked to a client contact;
-- they are never treated as workspace members.

create or replace function private.can_access_entity(target_type text, target_id uuid)
returns boolean
language plpgsql
security definer set search_path = public, auth
as $$
declare
  ws uuid;
  entity_client uuid;
  entity_visibility visibility;
begin
  case target_type
    when 'contact' then select workspace_id into ws from public.contacts where id = target_id;
    when 'company' then select workspace_id into ws from public.companies where id = target_id;
    when 'lead' then select workspace_id into ws from public.leads where id = target_id;
    when 'deal' then select workspace_id into ws from public.deals where id = target_id;
    when 'client' then return private.can_access_client(target_id);
    when 'project' then return private.can_access_project(target_id);
    when 'task' then select workspace_id into ws from public.tasks where id = target_id;
    when 'campaign' then select workspace_id into ws from public.campaigns where id = target_id;
    when 'deliverable' then
      select workspace_id, client_id, visibility into ws, entity_client, entity_visibility
      from public.deliverables where id = target_id;
      if ws is null then return false; end if;
      return private.is_workspace_member(ws)
        or (entity_visibility = 'client' and entity_client is not null and private.can_access_client(entity_client));
    when 'approval' then select workspace_id into ws from public.approval_requests where id = target_id;
    when 'time_entry' then select workspace_id into ws from public.time_entries where id = target_id;
    when 'invoice' then select workspace_id into ws from public.invoices where id = target_id;
    else return false;
  end case;
  if ws is null then return false; end if;
  return private.is_workspace_member(ws);
end;
$$;

create or replace function public.create_client_request(
  p_portal_slug text,
  p_title text,
  p_description text,
  p_priority text
)
returns public.client_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  portal_row public.client_portals%rowtype;
  request_row public.client_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into portal_row from public.client_portals where slug = p_portal_slug;
  if portal_row.id is null then raise exception 'Portal not found'; end if;
  if not private.can_access_client(portal_row.client_id) then
    raise exception 'Not authorized for this client portal';
  end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Title is required'; end if;
  insert into public.client_requests (workspace_id, client_id, title, description, priority, status)
  values (portal_row.workspace_id, portal_row.client_id, btrim(p_title), p_description,
    coalesce(nullif(p_priority, ''), 'normal'), 'new')
  returning * into request_row;
  perform private.record_audit(
    portal_row.workspace_id, 'client_request.created', 'client_request', request_row.id,
    null, jsonb_build_object('client_id', portal_row.client_id, 'priority', request_row.priority), null, null
  );
  return request_row;
end;
$$;

create or replace function public.decide_approval(
  p_workspace_id uuid,
  p_approval_id uuid,
  p_step_id uuid,
  p_decision text,
  p_note text
)
returns public.approval_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  approval_row public.approval_requests%rowtype;
  step_row public.approval_steps%rowtype;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_decision not in ('approved', 'changes_requested') then raise exception 'Invalid approval decision'; end if;
  select * into approval_row from public.approval_requests
  where id = p_approval_id and workspace_id = p_workspace_id for update;
  if approval_row.id is null then raise exception 'Approval not found'; end if;
  if not (private.has_permission(p_workspace_id, 'approvals.decide')
    or private.can_access_entity(approval_row.entity_type, approval_row.entity_id)) then
    raise exception 'Not authorized to decide this approval';
  end if;
  if approval_row.status <> 'pending' then raise exception 'Approval is no longer pending'; end if;
  select * into step_row from public.approval_steps
  where id = p_step_id and approval_request_id = p_approval_id for update;
  if step_row.id is null or step_row.status <> 'pending' then raise exception 'Approval step is no longer pending'; end if;

  update public.approval_steps
  set status = p_decision, decided_at = now(), decision_note = p_note, decided_by_user_id = current_user_id
  where id = p_step_id;
  insert into public.approval_events (approval_request_id, actor_user_id, action, note)
  values (p_approval_id, current_user_id, p_decision, p_note);
  if not exists (select 1 from public.approval_steps where approval_request_id = p_approval_id and status = 'pending') then
    update public.approval_requests
    set status = p_decision::approval_status, decided_at = now()
    where id = p_approval_id;
  end if;
  perform private.record_audit(
    p_workspace_id, 'approval.' || p_decision, 'approval', p_approval_id,
    jsonb_build_object('status', approval_row.status),
    jsonb_build_object('status', case when exists (
      select 1 from public.approval_steps where approval_request_id = p_approval_id and status = 'pending'
    ) then 'pending' else p_decision end), null, null
  );
  select * into approval_row from public.approval_requests where id = p_approval_id;
  return approval_row;
end;
$$;

revoke all on function public.create_client_request(text, text, text, text) from public, anon;
grant execute on function public.create_client_request(text, text, text, text) to authenticated;
revoke all on function public.decide_approval(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.decide_approval(uuid, uuid, uuid, text, text) to authenticated;

-- ===========================================================================
-- 0018_deal_conversion.sql
-- ===========================================================================
-- AgencyOS — Migration 0018: atomic won-deal to client/onboarding conversion.

alter table public.deals add column if not exists converted_client_id uuid references public.clients(id);
alter table public.deals add column if not exists converted_at timestamptz;
alter table public.deals add column if not exists converted_by uuid references public.profiles(user_id);
create index if not exists deals_converted_client_idx on public.deals(converted_client_id);

create or replace function public.convert_deal_to_client(
  p_workspace_id uuid,
  p_deal_id uuid,
  p_client_name text default null,
  p_client_code text default null
)
returns jsonb
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  current_user_id uuid := auth.uid();
  deal_row public.deals%rowtype;
  client_row public.clients%rowtype;
  project_row public.projects%rowtype;
  task_row public.tasks%rowtype;
  planning_status uuid;
  todo_status uuid;
  display_name text;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if not (private.has_permission(p_workspace_id, 'crm.update') and private.has_permission(p_workspace_id, 'clients.create')) then
    raise exception 'Not authorized to convert deals';
  end if;

  select d.* into deal_row
  from public.deals d
  join public.pipeline_stages s on s.id = d.stage_id
  where d.id = p_deal_id and d.workspace_id = p_workspace_id and s.is_won = true
  for update;
  if deal_row.id is null then raise exception 'Only a won deal in this workspace can be converted'; end if;

  if deal_row.converted_client_id is not null then
    select * into client_row from public.clients where id = deal_row.converted_client_id;
    select * into project_row from public.projects
    where client_id = client_row.id and workspace_id = p_workspace_id
    order by created_at asc limit 1;
    select * into task_row from public.tasks
    where project_id = project_row.id and workspace_id = p_workspace_id
    order by created_at asc limit 1;
    return jsonb_build_object('clientId', client_row.id, 'projectId', project_row.id, 'taskId', task_row.id, 'replayed', true);
  end if;

  display_name := coalesce(nullif(btrim(p_client_name), ''), deal_row.name);
  if deal_row.company_id is not null then
    select * into client_row from public.clients where company_id = deal_row.company_id for update;
  end if;
  if client_row.id is null then
    insert into public.clients (workspace_id, company_id, name, code, status, owner_user_id, onboarding_status)
    values (p_workspace_id, deal_row.company_id, display_name, nullif(btrim(p_client_code), ''), 'active',
      coalesce(deal_row.owner_user_id, current_user_id), 'in_progress')
    returning * into client_row;
  end if;

  select id into planning_status from public.project_statuses
  where workspace_id = p_workspace_id and category = 'planning' order by position asc limit 1;
  insert into public.projects (workspace_id, client_id, name, owner_user_id, status_id, currency, visibility)
  values (p_workspace_id, client_row.id, 'Onboarding: ' || display_name,
    coalesce(deal_row.owner_user_id, current_user_id), planning_status, deal_row.currency, 'internal')
  returning * into project_row;

  select id into todo_status from public.task_statuses
  where workspace_id = p_workspace_id and category = 'todo' order by position asc limit 1;
  insert into public.tasks (workspace_id, project_id, name, owner_user_id, status_id, visibility)
  values (p_workspace_id, project_row.id, 'Kickoff and onboarding',
    coalesce(deal_row.owner_user_id, current_user_id), todo_status, 'internal')
  returning * into task_row;

  update public.deals
  set converted_client_id = client_row.id, converted_at = now(), converted_by = current_user_id
  where id = deal_row.id;

  perform private.record_audit(
    p_workspace_id, 'deal.converted_to_client', 'deal', deal_row.id,
    null, jsonb_build_object('client_id', client_row.id, 'project_id', project_row.id, 'task_id', task_row.id), null, null
  );
  return jsonb_build_object('clientId', client_row.id, 'projectId', project_row.id, 'taskId', task_row.id, 'replayed', false);
end;
$$;

revoke all on function public.convert_deal_to_client(uuid, uuid, text, text) from public, anon;
grant execute on function public.convert_deal_to_client(uuid, uuid, text, text) to authenticated;

-- ===========================================================================
-- 0019_active_membership_guards.sql
-- ===========================================================================
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

-- ===========================================================================
-- 0020_outbox_claiming.sql
-- ===========================================================================
-- AgencyOS — Migration 0020: service-worker outbox claiming.

alter table public.outbox_events add column if not exists locked_at timestamptz;
create index if not exists outbox_claimable_idx
  on public.outbox_events(processed_at, next_attempt_at, locked_at);

create or replace function public.claim_outbox_events(p_limit integer default 50)
returns setof public.outbox_events
language plpgsql
security definer set search_path = public
as $$
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'Worker role required'; end if;
  return query
  with candidates as (
    select id from public.outbox_events
    where processed_at is null
      and next_attempt_at <= now()
      and locked_at is null
    order by created_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  )
  update public.outbox_events e
  set locked_at = now()
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

revoke all on function public.claim_outbox_events(integer) from public, anon, authenticated;
grant execute on function public.claim_outbox_events(integer) to service_role;

-- ===========================================================================
-- 0021_restrict_private_schema.sql
-- ===========================================================================
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

-- ===========================================================================
-- 0022_dashboard_widget_scope_and_cleanup_grant.sql
-- ===========================================================================
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

-- ===========================================================================
-- 0023_outbox_lifecycle.sql
-- ===========================================================================
-- 0023 — Complete the outbox lifecycle.
--
-- 0020 implemented the claim half of a competing-consumer queue and stopped.
-- Four defects followed from that, all of them silent.
--
-- 1. Stranded events. claim_outbox_events selects `locked_at is null`, and the
--    only things that clear locked_at live in the application's per-event
--    try/catch. If the worker process dies between claiming a batch and
--    finishing it — OOM, deploy, request timeout, host restart — those rows
--    keep locked_at set forever. They are never retried, never dead-lettered,
--    and never appear in any failure count. They simply stop existing as far
--    as the queue is concerned.
--
-- 2. Poison events retry forever. `attempts` was only ever incremented by the
--    application's failure handler. An event that crashes the process rather
--    than throwing never reaches that handler, so its attempt count stays at
--    zero and it is re-claimed indefinitely once (1) is fixed.
--
-- 3. Dead-lettering was indistinguishable from success. On the fifth failure
--    the application set processed_at = now(), the same field it sets after a
--    successful run. A permanently failed event therefore looked processed,
--    and the error that killed it was never persisted anywhere.
--
-- 4. The role guard did not work. `current_user` inside a SECURITY DEFINER
--    function evaluates to the function owner, not the caller, so the
--    `current_user not in ('service_role','postgres')` check could never fire.
--    It was harmless because the GRANT already restricted execution, but it
--    read as a control that was not one. Removed rather than left to mislead.
--
-- The lifecycle now lives in SQL so that each transition is a single atomic
-- statement, rather than a read-modify-write split across the worker.

-- ---------------------------------------------------------------------------
-- Terminal failure state and the error that caused it.
-- ---------------------------------------------------------------------------
alter table public.outbox_events add column if not exists dead_lettered_at timestamptz;
alter table public.outbox_events add column if not exists last_error text;

-- Supports the claim predicate below, including the stale-lock reclaim.
drop index if exists outbox_claimable_idx;
create index if not exists outbox_claimable_idx
  on public.outbox_events (next_attempt_at, locked_at)
  where processed_at is null and dead_lettered_at is null;

-- Operator view: what is stuck and why.
create index if not exists outbox_dead_letter_idx
  on public.outbox_events (workspace_id, dead_lettered_at)
  where dead_lettered_at is not null;

-- ---------------------------------------------------------------------------
-- Claim. Reclaims locks older than p_lock_timeout, counts the attempt at claim
-- time, and never returns an event that has already terminated.
-- ---------------------------------------------------------------------------
-- The 0020 function is claim_outbox_events(integer). Adding a second parameter
-- produces a NEW function rather than replacing it, and because the new one
-- defaults its second argument, a one-argument call would then be ambiguous
-- ("function name is not unique") for both SQL callers and PostgREST. Drop the
-- old signature explicitly.
drop function if exists public.claim_outbox_events(integer);

create or replace function public.claim_outbox_events(
  p_limit integer default 50,
  p_lock_timeout interval default interval '10 minutes'
)
returns setof public.outbox_events
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  with candidates as (
    select id from public.outbox_events
    where processed_at is null
      and dead_lettered_at is null
      and next_attempt_at <= now()
      -- Either unclaimed, or claimed by a worker that has since disappeared.
      and (locked_at is null or locked_at < now() - p_lock_timeout)
    order by created_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  )
  update public.outbox_events e
  -- Counting the attempt here, rather than in the failure handler, is what
  -- stops a process-killing event from being retried forever.
  set locked_at = now(),
      attempts = e.attempts + 1
  from candidates c
  where e.id = c.id
  returning e.*;
end;
$$;

revoke all on function public.claim_outbox_events(integer, interval) from public, anon, authenticated;
grant execute on function public.claim_outbox_events(integer, interval) to service_role;

comment on function public.claim_outbox_events(integer, interval) is
  'Claims a batch of outbox events for one worker. Reclaims locks older than p_lock_timeout so a crashed worker does not strand its batch. Increments attempts at claim time.';

-- ---------------------------------------------------------------------------
-- Success.
-- ---------------------------------------------------------------------------
create or replace function public.complete_outbox_event(p_event_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.outbox_events
  set processed_at = now(),
      locked_at = null,
      last_error = null
  where id = p_event_id
    and processed_at is null
    and dead_lettered_at is null;
$$;

revoke all on function public.complete_outbox_event(uuid) from public, anon, authenticated;
grant execute on function public.complete_outbox_event(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Failure. Decides retry-with-backoff versus dead-letter in one statement,
-- using the attempt count the claim already recorded.
--
-- Returns 'retry', 'dead_letter', or 'missing' so the worker can report
-- honestly instead of inferring.
-- ---------------------------------------------------------------------------
create or replace function public.fail_outbox_event(
  p_event_id uuid,
  p_error text,
  p_max_attempts integer default 5
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_attempts integer;
  v_backoff_seconds double precision;
begin
  select attempts into v_attempts
  from public.outbox_events
  where id = p_event_id and processed_at is null and dead_lettered_at is null
  for update;

  if v_attempts is null then
    return 'missing';
  end if;

  if v_attempts >= greatest(1, coalesce(p_max_attempts, 5)) then
    update public.outbox_events
    set dead_lettered_at = now(),
        locked_at = null,
        last_error = left(coalesce(p_error, 'unknown error'), 2000)
    where id = p_event_id;
    return 'dead_letter';
  end if;

  -- 60s, 120s, 240s ... capped at one hour.
  v_backoff_seconds := least(60 * power(2, v_attempts), 3600);

  update public.outbox_events
  set locked_at = null,
      last_error = left(coalesce(p_error, 'unknown error'), 2000),
      next_attempt_at = now() + make_interval(secs => v_backoff_seconds)
  where id = p_event_id;

  return 'retry';
end;
$$;

revoke all on function public.fail_outbox_event(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.fail_outbox_event(uuid, text, integer) to service_role;

comment on function public.fail_outbox_event(uuid, text, integer) is
  'Records an outbox failure. Retries with exponential backoff until attempts reaches p_max_attempts, then moves the event to a dead-letter state that is distinct from processed. Returns retry | dead_letter | missing.';

-- ---------------------------------------------------------------------------
-- Anything already marked processed by the old dead-letter path is
-- indistinguishable from a genuine success and is deliberately left alone;
-- this migration does not guess. Events currently holding a stale lock are
-- picked up automatically by the reclaim above.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 0024_deal_conversion_replay_identity.sql
-- ===========================================================================
-- 0024 — Make deal conversion replay return the records it actually created.
--
-- Problem
-- -------
-- 0018 made conversion idempotent by marking the deal with converted_client_id
-- and short-circuiting on retry. The client half of that is exact. The project
-- and task halves were not persisted at all, so the replay branch re-derived
-- them heuristically (0018:42-47):
--
--   select * into project_row from public.projects
--   where client_id = client_row.id and workspace_id = p_workspace_id
--   order by created_at asc limit 1;
--
-- That returns the EARLIEST project for the client, which is only the one this
-- conversion created when the client had no prior projects. Two ordinary
-- situations break it:
--
--   * The client already existed and had projects. 0018:52 deliberately reuses
--     an existing client matched on company_id, so this is the normal path for
--     any established account, not an edge case.
--   * A second deal for the same company is converted later. Both conversions
--     then replay to the same first project, and the second one reports a
--     project it did not create.
--
-- release_behavior.sql did not catch it because its fixture has exactly one
-- company, deal, client and project, so "earliest" and "the one just created"
-- coincide.
--
-- Two further defects in the same function, found while fixing the above:
--
--   * The existing-client lookup (0018:52) filters only on company_id, with no
--     workspace_id predicate. The function is SECURITY DEFINER, so RLS does not
--     constrain it. Company ids are workspace-scoped in practice, which is the
--     only reason this has not crossed a tenant boundary; it should not depend
--     on that.
--   * The same lookup has no LIMIT. `SELECT INTO` in PL/pgSQL takes an
--     arbitrary row rather than raising when several match, so which client a
--     conversion reuses was unordered.

-- ---------------------------------------------------------------------------
-- Persist the full conversion result.
-- ---------------------------------------------------------------------------
alter table public.deals add column if not exists converted_project_id uuid references public.projects(id);
alter table public.deals add column if not exists converted_task_id uuid references public.tasks(id);

-- Backfill for deals converted before this migration. The heuristic below is
-- the same one the old replay branch applied at read time, so this records
-- what those deals already reported and changes no observable answer. It is
-- applied once here rather than being recomputed on every replay.
update public.deals d
set converted_project_id = (
  select pr.id from public.projects pr
  where pr.client_id = d.converted_client_id
    and pr.workspace_id = d.workspace_id
  order by pr.created_at asc
  limit 1
)
where d.converted_client_id is not null
  and d.converted_project_id is null;

update public.deals d
set converted_task_id = (
  select tk.id from public.tasks tk
  where tk.project_id = d.converted_project_id
    and tk.workspace_id = d.workspace_id
  order by tk.created_at asc
  limit 1
)
where d.converted_project_id is not null
  and d.converted_task_id is null;

create index if not exists deals_converted_project_idx on public.deals(converted_project_id);

-- ---------------------------------------------------------------------------
-- Replace the function.
-- ---------------------------------------------------------------------------
create or replace function public.convert_deal_to_client(
  p_workspace_id uuid,
  p_deal_id uuid,
  p_client_name text default null,
  p_client_code text default null
)
returns jsonb
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  current_user_id uuid := auth.uid();
  deal_row public.deals%rowtype;
  client_row public.clients%rowtype;
  project_row public.projects%rowtype;
  task_row public.tasks%rowtype;
  planning_status uuid;
  todo_status uuid;
  display_name text;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if not (private.has_permission(p_workspace_id, 'crm.update') and private.has_permission(p_workspace_id, 'clients.create')) then
    raise exception 'Not authorized to convert deals';
  end if;

  select d.* into deal_row
  from public.deals d
  join public.pipeline_stages s on s.id = d.stage_id
  where d.id = p_deal_id and d.workspace_id = p_workspace_id and s.is_won = true
  for update;
  if deal_row.id is null then raise exception 'Only a won deal in this workspace can be converted'; end if;

  -- Replay: return exactly what this conversion created, read back by id.
  if deal_row.converted_client_id is not null then
    select * into client_row from public.clients
    where id = deal_row.converted_client_id and workspace_id = p_workspace_id;

    if deal_row.converted_project_id is not null then
      select * into project_row from public.projects
      where id = deal_row.converted_project_id and workspace_id = p_workspace_id;
    end if;

    if deal_row.converted_task_id is not null then
      select * into task_row from public.tasks
      where id = deal_row.converted_task_id and workspace_id = p_workspace_id;
    end if;

    return jsonb_build_object(
      'clientId', client_row.id,
      'projectId', project_row.id,
      'taskId', task_row.id,
      'replayed', true
    );
  end if;

  display_name := coalesce(nullif(btrim(p_client_name), ''), deal_row.name);

  -- Reuse an existing client for the same company, scoped to this workspace and
  -- deterministically ordered.
  if deal_row.company_id is not null then
    select * into client_row from public.clients
    where company_id = deal_row.company_id
      and workspace_id = p_workspace_id
    order by created_at asc
    limit 1
    for update;
  end if;

  if client_row.id is null then
    insert into public.clients (workspace_id, company_id, name, code, status, owner_user_id, onboarding_status)
    values (p_workspace_id, deal_row.company_id, display_name, nullif(btrim(p_client_code), ''), 'active',
      coalesce(deal_row.owner_user_id, current_user_id), 'in_progress')
    returning * into client_row;
  end if;

  select id into planning_status from public.project_statuses
  where workspace_id = p_workspace_id and category = 'planning' order by position asc limit 1;
  insert into public.projects (workspace_id, client_id, name, owner_user_id, status_id, currency, visibility)
  values (p_workspace_id, client_row.id, 'Onboarding: ' || display_name,
    coalesce(deal_row.owner_user_id, current_user_id), planning_status, deal_row.currency, 'internal')
  returning * into project_row;

  select id into todo_status from public.task_statuses
  where workspace_id = p_workspace_id and category = 'todo' order by position asc limit 1;
  insert into public.tasks (workspace_id, project_id, name, owner_user_id, status_id, visibility)
  values (p_workspace_id, project_row.id, 'Kickoff and onboarding',
    coalesce(deal_row.owner_user_id, current_user_id), todo_status, 'internal')
  returning * into task_row;

  -- Record all three ids, not just the client, so replay is exact.
  update public.deals
  set converted_client_id = client_row.id,
      converted_project_id = project_row.id,
      converted_task_id = task_row.id,
      converted_at = now(),
      converted_by = current_user_id
  where id = deal_row.id;

  perform private.record_audit(
    p_workspace_id, 'deal.converted_to_client', 'deal', deal_row.id,
    null, jsonb_build_object('client_id', client_row.id, 'project_id', project_row.id, 'task_id', task_row.id), null, null
  );

  return jsonb_build_object(
    'clientId', client_row.id,
    'projectId', project_row.id,
    'taskId', task_row.id,
    'replayed', false
  );
end;
$$;

revoke all on function public.convert_deal_to_client(uuid, uuid, text, text) from public, anon;
grant execute on function public.convert_deal_to_client(uuid, uuid, text, text) to authenticated;

comment on function public.convert_deal_to_client(uuid, uuid, text, text) is
  'Atomically converts a won deal into a client, onboarding project and kickoff task. Idempotent: a retry replays the recorded converted_client_id / converted_project_id / converted_task_id rather than re-deriving them.';

-- ===========================================================================
-- 0025_mentions_and_approval_steps.sql
-- ===========================================================================
-- 0025 — Two tables with RLS enabled and no way to write to them.
--
-- Both fail closed, so neither is a leak. Both are unfinished wiring that makes
-- a shipped feature silently inert, which is its own kind of defect: the UI
-- offers the action and the database discards it.

-- ---------------------------------------------------------------------------
-- A. comment_mentions
--
-- RLS is enabled (0007:49) and NOT ONE policy is defined for it anywhere in the
-- migration set. Under RLS, no policy means deny-all, so @mentions can never be
-- written or read through the API. The table is inert.
--
-- A mention row is a fact about a comment, so it inherits the comment's
-- visibility exactly. Getting this wrong in the other direction would be a real
-- leak — a mention row names a user against a comment id, and comments carry
-- internal/client visibility — so both policies delegate to the comments
-- policies rather than restating them.
-- ---------------------------------------------------------------------------
drop policy if exists comment_mentions_select on public.comment_mentions;
drop policy if exists comment_mentions_insert on public.comment_mentions;
drop policy if exists comment_mentions_delete on public.comment_mentions;

-- Readable exactly when the parent comment is readable. `select 1 from
-- public.comments` is itself filtered by comments_select, so a comment the
-- caller cannot see yields no row here either.
create policy comment_mentions_select on public.comment_mentions for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));

-- Writable only by the author of the parent comment, and only while that
-- comment is theirs. Mentions are created alongside the comment.
create policy comment_mentions_insert on public.comment_mentions for insert to authenticated
  with check (
    exists (
      select 1 from public.comments c
      where c.id = comment_id
        and c.author_user_id = auth.uid()
        and private.is_workspace_member(c.workspace_id)
    )
  );

create policy comment_mentions_delete on public.comment_mentions for delete to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = comment_id
        and c.author_user_id = auth.uid()
        and private.is_workspace_member(c.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- B. approval_steps
--
-- 0007:567-570 defines SELECT and UPDATE only. There is no INSERT policy and no
-- RPC anywhere inserts into this table. Meanwhile approval_requests DOES have a
-- direct INSERT policy gated on approvals.request (0007:561-562).
--
-- So a user can create an approval request and then cannot create the steps
-- that constitute the actual review workflow — the request exists with no
-- approvers and can never be decided.
--
-- Steps are part of the request, so INSERT mirrors approval_requests_insert:
-- the caller must hold approvals.request in the request's workspace. DELETE is
-- allowed on the same basis but only while the step is still pending, so a
-- decided step cannot be removed to rewrite history. Decisions themselves stay
-- immutable via approval_events, which has no update or delete policy at all.
-- ---------------------------------------------------------------------------
drop policy if exists approval_steps_insert on public.approval_steps;
drop policy if exists approval_steps_delete on public.approval_steps;

create policy approval_steps_insert on public.approval_steps for insert to authenticated
  with check (
    exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id
        and private.has_permission(ar.workspace_id, 'approvals.request')
    )
  );

create policy approval_steps_delete on public.approval_steps for delete to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id
        and private.has_permission(ar.workspace_id, 'approvals.request')
    )
  );

-- The existing approval_steps_update policy has a USING clause but no WITH
-- CHECK, so a permitted caller could move a step onto a different approval
-- request — including one in another workspace, since the check is evaluated
-- against the row's current parent rather than its new one. Restate it with
-- both clauses.
drop policy if exists approval_steps_update on public.approval_steps;
create policy approval_steps_update on public.approval_steps for update to authenticated
  using (
    exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id
        and (private.has_permission(ar.workspace_id, 'approvals.decide')
             or private.can_access_entity(ar.entity_type, ar.entity_id))
    )
  )
  with check (
    exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id
        and (private.has_permission(ar.workspace_id, 'approvals.decide')
             or private.can_access_entity(ar.entity_type, ar.entity_id))
    )
  );

-- ===========================================================================
-- 0026_soft_delete.sql
-- ===========================================================================
-- 0026 — Soft deletion for user-restorable business records.
--
-- prd.md §12 ("Deletion strategy") requires soft deletion for user-restorable
-- business records, hard deletion only through controlled retention or tenant
-- deletion jobs. Today only `companies` and `contacts` carry archived_at, and
-- the one delete action that exists — deleteContactAction — calls a hard
-- DELETE anyway. A mis-click is unrecoverable, and the audit trail records
-- that a row was deleted without preserving what it contained.
--
-- This adds archived_at to the remaining user-facing CRM and delivery records,
-- plus the columns needed to say who archived a row and why.
--
-- Deliberately NOT given archived_at:
--   * approval_requests / approval_steps / approval_events — decisions are
--     immutable history (prd.md FR-10). Superseding one creates a new round.
--   * audit.events — append-only by definition.
--   * outbox_events — lifecycle is processed/dead-lettered, see 0023.
--   * join tables (record_tags, task_dependencies, membership_roles ...) —
--     these are edges, restored implicitly with their endpoints.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
  targets text[] := array[
    'leads', 'deals', 'activities', 'notes',
    'clients', 'projects', 'tasks', 'milestones',
    'campaigns', 'deliverables', 'content_items',
    'client_requests', 'retainers', 'contracts'
  ];
begin
  foreach target in array targets loop
    execute format('alter table public.%I add column if not exists archived_at timestamptz', target);
    execute format('alter table public.%I add column if not exists archived_by uuid references public.profiles(user_id)', target);
  end loop;
end $$;

-- companies and contacts already have archived_at (0003) but not the actor.
alter table public.companies add column if not exists archived_by uuid references public.profiles(user_id);
alter table public.contacts add column if not exists archived_by uuid references public.profiles(user_id);

-- ---------------------------------------------------------------------------
-- Indexes
--
-- Every list query filters `archived_at is null`, so a partial index on the
-- live rows keeps the common path cheap without carrying the archived tail.
-- The trash view needs the opposite, hence the second, much smaller index.
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
  targets text[] := array[
    'companies', 'contacts', 'leads', 'deals', 'activities', 'notes',
    'clients', 'projects', 'tasks', 'milestones',
    'campaigns', 'deliverables', 'content_items',
    'client_requests', 'retainers', 'contracts'
  ];
begin
  foreach target in array targets loop
    execute format(
      'create index if not exists %I on public.%I (workspace_id) where archived_at is null',
      target || '_live_idx', target
    );
    execute format(
      'create index if not exists %I on public.%I (workspace_id, archived_at desc) where archived_at is not null',
      target || '_archived_idx', target
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Retention
--
-- Archived rows are not kept forever. This function is the controlled
-- hard-deletion path prd.md calls for: it is maintenance-only, scoped by age,
-- and returns what it removed so a scheduled run can be audited.
--
-- It is NOT granted to application roles — same reasoning as
-- cleanup_expired_jobs in 0022, which was callable by any authenticated user
-- and deleted across every tenant.
-- ---------------------------------------------------------------------------
create or replace function public.purge_archived_records(p_older_than interval default interval '90 days')
returns table (table_name text, purged integer)
language plpgsql
security definer set search_path = public
as $$
declare
  target text;
  targets text[] := array[
    'activities', 'notes', 'tasks', 'milestones', 'deliverables',
    'content_items', 'campaigns', 'client_requests', 'projects',
    'leads', 'deals', 'contacts', 'companies', 'clients',
    'retainers', 'contracts'
  ];
  removed integer;
begin
  if p_older_than is null or p_older_than < interval '1 day' then
    raise exception 'Refusing to purge records archived less than a day ago';
  end if;

  -- Ordered child-before-parent so foreign keys do not block the delete.
  foreach target in array targets loop
    execute format(
      'delete from public.%I where archived_at is not null and archived_at < now() - $1',
      target
    ) using p_older_than;
    get diagnostics removed = row_count;
    table_name := target;
    purged := removed;
    return next;
  end loop;
end;
$$;

revoke all on function public.purge_archived_records(interval) from public, anon, authenticated;
grant execute on function public.purge_archived_records(interval) to service_role;

comment on function public.purge_archived_records(interval) is
  'Maintenance only. Permanently removes rows archived longer ago than p_older_than, across all workspaces, so it must never be callable by an application role. Run from pg_cron or a trusted worker.';

-- ===========================================================================
-- 0027_approval_requests.sql
-- ===========================================================================
-- 0027 — Let users actually request an approval, and stop a rejection being
--        overwritten by a later approval.
--
-- A. Nothing could create an approval request.
--
--    The decision flow, the step tracking and the immutable event log all work
--    (0017), and 0025 added the approval_steps INSERT policy. But no code path
--    anywhere creates a request with its approvers — only seed.ts does, for
--    demo data. The approvals list page even says "Approvals are requested from
--    deliverable pages or directly from project work", and no such control
--    exists. The feature was reachable only for records the seeder made.
--
--    Creating a request plus its steps is a multi-write, so per AGENTS.md it
--    belongs in an RPC rather than the PostgREST adapter, which has no
--    transaction.
--
-- B. A rejection could be overwritten by a later approval.
--
--    decide_approval settles the request when no steps remain pending, using
--    whichever decision came last:
--
--      if not exists (... status = 'pending') then
--        update public.approval_requests set status = p_decision::approval_status
--
--    With two approvers, if A requests changes and B then approves, the
--    request ends as 'approved' — the objection silently discarded. For a
--    client-facing approval workflow that is the worst possible direction to
--    fail in. A changes_requested now settles the request immediately.

-- ---------------------------------------------------------------------------
-- A. Creation
-- ---------------------------------------------------------------------------
create or replace function public.create_approval_request(
  p_workspace_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_title text,
  p_instructions text default null,
  p_due_at timestamptz default null,
  p_approver_ids uuid[] default '{}'::uuid[]
)
returns public.approval_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  current_user_id uuid := auth.uid();
  approval_row public.approval_requests%rowtype;
  approver uuid;
  next_position integer := 0;
  distinct_approvers uuid[];
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  -- Re-checked here rather than trusting the caller, because this function is
  -- SECURITY DEFINER and therefore runs outside RLS.
  if not private.has_permission(p_workspace_id, 'approvals.request') then
    raise exception 'Not authorized to request approvals';
  end if;

  if coalesce(btrim(p_title), '') = '' then
    raise exception 'An approval request needs a title';
  end if;

  if p_entity_type is null or p_entity_id is null then
    raise exception 'An approval request must reference a record';
  end if;

  -- The requester must be able to see the record they are routing for review,
  -- or an approval request becomes a way to probe for record existence across
  -- a workspace.
  if not private.can_access_entity(p_entity_type, p_entity_id) then
    raise exception 'Not authorized to request approval for this record';
  end if;

  select array_agg(distinct approver_id) into distinct_approvers
  from unnest(p_approver_ids) as approver_id
  where approver_id is not null;

  if distinct_approvers is null or array_length(distinct_approvers, 1) is null then
    raise exception 'An approval request needs at least one approver';
  end if;

  -- Every approver must be an active member of this workspace. Without this,
  -- a caller could name any user id and create a step naming someone outside
  -- the tenant.
  if exists (
    select 1 from unnest(distinct_approvers) as approver_id
    where not exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = p_workspace_id
        and m.user_id = approver_id
        and m.status = 'active'
    )
  ) then
    raise exception 'Every approver must be an active member of this workspace';
  end if;

  insert into public.approval_requests (
    workspace_id, entity_type, entity_id, title, instructions, status, due_at, requested_by
  ) values (
    p_workspace_id, p_entity_type, p_entity_id, btrim(p_title),
    nullif(btrim(p_instructions), ''), 'pending', p_due_at, current_user_id
  )
  returning * into approval_row;

  foreach approver in array distinct_approvers loop
    insert into public.approval_steps (
      approval_request_id, position, approver_type, approver_id, status
    ) values (
      approval_row.id, next_position, 'user', approver, 'pending'
    );
    next_position := next_position + 1;
  end loop;

  insert into public.approval_events (approval_request_id, actor_user_id, action, note)
  values (approval_row.id, current_user_id, 'requested', nullif(btrim(p_instructions), ''));

  perform private.record_audit(
    p_workspace_id, 'approval.requested', 'approval', approval_row.id,
    null,
    jsonb_build_object(
      'title', approval_row.title,
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'approver_count', array_length(distinct_approvers, 1)
    ),
    null, null
  );

  return approval_row;
end;
$$;

revoke all on function public.create_approval_request(uuid, text, uuid, text, text, timestamptz, uuid[])
  from public, anon;
grant execute on function public.create_approval_request(uuid, text, uuid, text, text, timestamptz, uuid[])
  to authenticated;

comment on function public.create_approval_request(uuid, text, uuid, text, text, timestamptz, uuid[]) is
  'Atomically creates an approval request and one pending step per approver. Requires approvals.request in the workspace and access to the referenced record; every approver must be an active member.';

-- ---------------------------------------------------------------------------
-- B. Decision settlement
--
-- Replaces 0017's version. The only behavioural change is the settlement rule:
-- changes_requested ends the request immediately instead of waiting for the
-- remaining approvers and then being overwritten by whoever answered last.
-- ---------------------------------------------------------------------------
create or replace function public.decide_approval(
  p_workspace_id uuid,
  p_approval_id uuid,
  p_step_id uuid,
  p_decision text,
  p_note text
)
returns public.approval_requests
language plpgsql
security definer set search_path = public, private, auth
as $$
declare
  approval_row public.approval_requests%rowtype;
  step_row public.approval_steps%rowtype;
  current_user_id uuid := auth.uid();
  settled_status approval_status;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_decision not in ('approved', 'changes_requested') then raise exception 'Invalid approval decision'; end if;

  select * into approval_row from public.approval_requests
  where id = p_approval_id and workspace_id = p_workspace_id for update;
  if approval_row.id is null then raise exception 'Approval not found'; end if;

  if not (private.has_permission(p_workspace_id, 'approvals.decide')
    or private.can_access_entity(approval_row.entity_type, approval_row.entity_id)) then
    raise exception 'Not authorized to decide this approval';
  end if;
  if approval_row.status <> 'pending' then raise exception 'Approval is no longer pending'; end if;

  select * into step_row from public.approval_steps
  where id = p_step_id and approval_request_id = p_approval_id for update;
  if step_row.id is null or step_row.status <> 'pending' then raise exception 'Approval step is no longer pending'; end if;

  update public.approval_steps
  set status = p_decision, decided_at = now(), decision_note = p_note, decided_by_user_id = current_user_id
  where id = p_step_id;

  insert into public.approval_events (approval_request_id, actor_user_id, action, note)
  values (p_approval_id, current_user_id, p_decision, p_note);

  -- A request for changes settles the request on its own: the work has to go
  -- back regardless of what the remaining approvers would have said. Approval
  -- still requires every step to have answered.
  if p_decision = 'changes_requested' then
    settled_status := 'changes_requested';
  elsif not exists (
    select 1 from public.approval_steps
    where approval_request_id = p_approval_id and status = 'pending'
  ) then
    settled_status := 'approved';
  else
    settled_status := null;
  end if;

  if settled_status is not null then
    update public.approval_requests
    set status = settled_status, decided_at = now()
    where id = p_approval_id;
  end if;

  perform private.record_audit(
    p_workspace_id, 'approval.' || p_decision, 'approval', p_approval_id,
    jsonb_build_object('status', approval_row.status),
    jsonb_build_object('status', coalesce(settled_status::text, 'pending')),
    null, null
  );

  select * into approval_row from public.approval_requests where id = p_approval_id;
  return approval_row;
end;
$$;

revoke all on function public.decide_approval(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.decide_approval(uuid, uuid, uuid, text, text) to authenticated;

comment on function public.decide_approval(uuid, uuid, uuid, text, text) is
  'Records one approver decision. Approval requires every step to approve; a single changes_requested settles the whole request so an objection cannot be overwritten by a later approval.';

-- ===========================================================================
-- 0028_health_check.sql
-- ===========================================================================
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


-- ===========================================================================
-- Register these migrations with the Supabase CLI's tracking table, so a
-- future `supabase db push` knows they are already applied and does not
-- attempt to run them a second time.
-- ===========================================================================
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

insert into supabase_migrations.schema_migrations (version, name)
values
  ('0001', 'extensions_schemas'),
  ('0002', 'identity_tenancy'),
  ('0003', 'crm'),
  ('0004', 'clients_delivery_collaboration'),
  ('0005', 'time_finance_customization_automation'),
  ('0006', 'authorization_helpers'),
  ('0007', 'rls_policies'),
  ('0008', 'storage_buckets_policies'),
  ('0009', 'seed_permissions_bootstrap_rpc'),
  ('0010', 'public_audit_rpc'),
  ('0011', 'invitation_acceptance_rpc'),
  ('0012', 'public_invitation_lookup'),
  ('0013', 'marketing_inquiries'),
  ('0014', 'service_role_database_access'),
  ('0015', 'workspace_owner_immutability'),
  ('0016', 'adapter_transactions'),
  ('0017', 'portal_scope_and_audit'),
  ('0018', 'deal_conversion'),
  ('0019', 'active_membership_guards'),
  ('0020', 'outbox_claiming'),
  ('0021', 'restrict_private_schema'),
  ('0022', 'dashboard_widget_scope_and_cleanup_grant'),
  ('0023', 'outbox_lifecycle'),
  ('0024', 'deal_conversion_replay_identity'),
  ('0025', 'mentions_and_approval_steps'),
  ('0026', 'soft_delete'),
  ('0027', 'approval_requests'),
  ('0028', 'health_check')
on conflict (version) do nothing;

-- Sanity check: this should report 28.
select count(*) as migrations_applied from supabase_migrations.schema_migrations;
