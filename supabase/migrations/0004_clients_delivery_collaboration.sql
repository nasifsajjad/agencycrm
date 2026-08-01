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
