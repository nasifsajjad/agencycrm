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
