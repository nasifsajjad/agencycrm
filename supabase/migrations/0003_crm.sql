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
